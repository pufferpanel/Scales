/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 */
var log = require("./logger.js"),
	tar = require("tar-fs"),
	gconfig = require("../config.json"),
	pty = require("pty.js"),
	http = require("https"),
	path = require("path"),
	plugin = require("./plugins.js").pluginLoader,
	fs = require("fs-extra"),
	async = require("async"),
	trim = require("trim"),
	proc = require("child_process"),
	events = require("events"),
	util = require("util"),
	userid = require("userid"),
	usage = require("usage"),
	extend = require("node.extend"),
	querystring = require("querystring"),
	server = {};

var OFF = 0,
	ON = 1,
	STOPPING = 2,
	STARTING = 3;

function Scales(config) {

	this.status = 0;
	this.config = config;
	this.usageStatistics = {};
	this.plugin = plugin[this.config.plugin + '.js'];

}

util.inherits(Scales, events.EventEmitter);

Scales.prototype.hasPermission = function(key, permission) {

	if(gconfig.keys.indexOf(key) > -1) {
		return true;
	}

	if(typeof permission === 'undefined' || !(key in this.config.keys)) {
		return false;
	}

	if(this.config.keys[key].indexOf(permission) < 0) {
		return false;
	} else {
		return true;
	}

}

Scales.prototype.setStatus = function(status) {

	this.status = status;
	return this.status;

}

/**
 * Use Pre-Flight to start a server, do not call powerOn() directly.
 */
Scales.prototype.preflight = function() {

	var s = this;

	if(this.status != OFF) {
		return;
	}

	log.verbose("Running preflight for server " + s.config.name);

	async.series([
		function(callback) {
			proc.exec("chown -R " + s.config.user + ":scalesuser " + s.buildPath(null), function(error, stdout, stdin) {

				if(error !== null) {
					log.error("Unable to complete preflight for server " + s.config.name + " due to a permissions error.", stdout);
					return;
				}

				log.verbose("Completed permissions preflight for server " + s.config.name);
				callback();

			});
		},
		function(callback) {
			log.verbose("Running plugin preflight for server " + s.config.name);
			s.plugin.preflight(s.config, s.buildPath(null), callback);
		},
		function(callback) {
			log.verbose("Running power on function for server " + s.config.name);
			s.power(1, callback);
		}
	]);

}

/**
 * Deletes a server using server name.
 */
Scales.prototype.delete = function() {

	fs.remove("data/" + this.config.name + ".json", function(err) {

		if(err) {
			log.error("Error when deleting server config for " + this.config.name, err);
		}

	});

}

// status - 0-2 (0 = turn off, 1 = turn on, 2 = restart)
Scales.prototype.power = function(status, callback) {

	if(status == 1) {
		this.powerOn(callback);
	}

	if(status == 2) {
		this.powerCycle(callback);
	}

}

// This function should be called by preflight, not directly.
Scales.prototype.powerOn = function(callback) {

	var s = this;

	if(this.status != OFF) {
		return;
	}

	try {

		log.verbose("Attempting to spawn server process for " + this.config.name + "...");

		var startupArray = this.config.startup.command;
		for(var index in this.config.startup.variables) {

			var startupArray = startupArray.replace("${" + index + "}", this.config.startup.variables[index]);

		}

		this.ps = pty.spawn(this.plugin.exe, startupArray.match(/\S+/g), {
			cwd: gconfig.basepath + this.config.user + "/public",
			uid: userid.uid(this.config.user),
			gid: userid.gid(this.config.user)
		});

	} catch(ex) {

		log.error("Unable to start server for " + this.config.name + " due to an exception.", ex.stack);
		console.log(ex.stack);
		return;

	}

	this.setStatus(3);
	log.verbose("Starting " + this.config.plugin + " server for " + this.config.name + " (pid: " + this.ps.pid + ")...");

	try {

		this.cpu_limit = parseInt(this.config.build.cpu);

		if(this.cpu_limit > 0) {

			log.verbose("Starting CPU limiter for server " + this.config.name + " (pid " + this.ps.pid + ")");
			this.cpu = pty.spawn('cpulimit',  ['-p', this.ps.pid, '-z', '-l', this.cpu_limit]);

			this.cpu.on('close', function(code) {
				log.warn("CPU limit for server " + this.config.name + " (pid: " + this.ps.pid + ") was stopped.", code);
			});

		}

	} catch(ex) {
		log.warn("Server " + this.config.name + " seems to be missing a CPU limit variable. Running without a limit.", ex.stack);
	}

	callback();

	this.ps.on('data', function(data) {

		output = data.toString();
		s.emit('console', output);

		if(s.status == STARTING) {

			// Only applies to MC Servers
			// Should consider adding a call here for s.plugin.postStart();
			if(s.plugin.trigger.eula) {

				if(output.indexOf(s.plugin.trigger.eula) != -1) {

					s.setStatus(STOPPING);
					s.emit('off');

					log.warn("Server " + s.config.name + " has not yet accepted the EULA. Stopping server...");

				}

			}

			if(output.indexOf(s.plugin.trigger.started) != -1){

				s.setStatus(ON);
				s.processStats = setInterval(s.statistics, 2000, s);
				s.queryServer = setInterval(s.query, 10000, s);
				log.verbose("Server " + s.config.name + " successfully started.");

			}

		}

	});

	this.ps.on('exit', function() {

		if(s.status == ON || s.status == STARTING) {

			log.warn("Server "+ s.config.name + " detected as crashed. Attempting to reboot now...");
			s.setStatus(OFF);
			s.emit('crashed');

		}

		if(s.status == STOPPING) {

			log.verbose("Server process stopped for "+ s.config.name);
			s.setStatus(OFF);
			s.emit('off');

		}

	});

	this.on('crashed', function() {

		if(s.status == OFF) {

			log.warn("Attempting to kill crashed process (pid: " + s.ps.pid + ") for server " + s.config.name);

			// @todo: prevent this from looping an endless number of times.
			s.kill(false);

		}

	});

	this.on('off', function() {

		if(s.status != OFF) {
			log.verbose("Stopping server process for " + s.config.name);
			s.setStatus(OFF);
		}

		clearInterval(s.processStats);
		clearInterval(s.queryServer);

		if(s.cpu) {
			s.cpu.kill();
		}

		s.usageStatistics = {};
		s.plugin.lastQuery = {};

	});

	this.on('stats', function() {


	});

}

Scales.prototype.powerCycle = function() {

	var s = this;
	async.series([
		function(callback) {
			s.powerOff(callback);
		},
		function(callback) {
			s.preflight();
		}
	]);

}

Scales.prototype.powerOff = function(callback) {

	if(this.status != OFF) {

		log.verbose("Stopping server process (pid: " + this.ps.pid + ") for " + this.config.name);
		this.setStatus(STOPPING);
		this.ps.write(this.plugin.stop + "\r");

	} else {

		// Allows the use of restart even if the server isn't on.
		if(typeof callback !== 'undefined') {
			callback();
		}

	}

	this.on('off', function(){

		if(typeof callback !== 'undefined') {
			callback();
		}

	});

}

Scales.prototype.kill = function(crashed) {

	var s = this;
	if(this.ps != undefined && this.ps.pid != undefined) {

		this.setStatus(STOPPING);
		this.ps.kill();

	}

	this.on('off', function(){

		if(typeof crashed != undefined && crashed === true) {

			log.warn("Server process (pid: " + s.ps.pid + ") for " + s.config.name + " killed.");
			s.preflight();

		}

	});

}

Scales.prototype.console = function(data) {

	if([OFF, STOPPING].indexOf(this.status)  >= 0) {
		return false;
	}

	// Prevent Scales from thinking server has crashed
	if(data == this.plugin.stop) {
		this.setStatus(STOPPING);
	}

	this.ps.write(data + "\r");

}

Scales.prototype.listDirectory = function(base) {

	var directory = this.buildPath(base),
		files = [];

	if(!fs.existsSync(directory)) {

		return false;

	}

	fs.readdirSync(directory).forEach(function(filename) {

		stat = fs.statSync(path.join(directory, filename));

		files.push({
			"name": filename,
			"created": stat.ctime,
			"modified": stat.mtime,
			"size": stat.size,
			"file": stat.isFile(),
			"symlink": stat.isSymbolicLink()
		});

	});

	return files;

}

Scales.prototype.returnFile = function(base) {

	var filepath = this.buildPath(base);

	if(fs.existsSync(filepath) && fs.statSync(filepath).isFile()) {
		return fs.readFileSync(filepath, "UTF-8");
	} else {
		return false;
	}

}

Scales.prototype.writeFile = function(base, contents) {

	var filepath = this.buildPath(base);

	try {

		fs.outputFileSync(filepath, contents);
		return true;

	} catch(e) {

		log.error("An exception occured while trying to write a file to " + filepath, e.stack);
		return false;

	}

}

Scales.prototype.deleteFile = function(base) {

	var filepath = this.buildPath(base);

	try {

		fs.removeSync(filepath);
		return true;

	} catch(e) {

		log.error("An error was encountered while trying to delete " + filepath, error);
		return false;

	}

}

Scales.prototype.logContents = function(lines) {

	var out = "",
		l = "";

	try {
		l = fs.readFileSync(this.buildPath(this.plugin.log)).toString().split('\n');
	} catch(ex) {
		return "No log was found to read from. ["+ this.plugin.log +"]";
	}

	lines = parseInt(lines) + parseInt(1);
	lines = (lines < 0) ? 1 : lines;
	for(i = l.length-lines; i<l.length; i++){

		if(l[i] != null) {
			out += l[i]+"\n";
		}

	}

	return trim.right(out) + "\n";

}

Scales.prototype.buildPath = function(base) {

	if(base !== null) {
		var filepath = path.join(gconfig.basepath, this.config.user, "/public", path.normalize(querystring.unescape(base)));
	} else {
		var filepath = path.join(gconfig.basepath, this.config.user, "/public");
	}

	if(filepath.indexOf(gconfig.basepath + this.config.user) != 0) {

		log.error("API attempted to delete a file outside of home directory " + gconfig.basepath + this.config.user + ". Request denied.");
		return null;

	}

	return filepath;

}

/**
 * Queries a server using Gamedig
 * Results can be retrieved from this.plugin.lastQuery
 */
Scales.prototype.query = function(s) {

	s.plugin.query(s.config);
	s.emit('query');

}

Scales.prototype.statistics = function(s) {

	usage.lookup(s.ps.pid, { keepHistory: true }, function(error, result) {

		if(error === null){

			result.cpu = parseInt((result.cpu).toFixed(2));
			s.usageStatistics = result;
			s.emit('stats');

		}

	});

}

Scales.prototype.coreInfo = function() {

	return {
		"status": this.status,
		"plugin": this.plugin.name,
		"query": this.plugin.lastQuery,
		"proc": this.usageStatistics
	}

}

Scales.prototype.install = function(res, hash, password) {

	var s = this;
	async.series([
		function(callback) {

			log.verbose("Creating base config file for " + s.config.name);
			fs.outputJson("data/" + s.config.name + ".json", s.config, function(err) {

				if(err) {
					log.error("Error occured while attempting to write server config to disk.", err);
					return callback("Error occured while attempting to write server config to disk.");
				} else {
					callback();
				}

			});

		},
		function(callback) {

			fs.ensureDir("./data/downloads", function(error) {
				if(error != null) {
					log.error("An error occured trying to create a download directory.", error);
					return callback("An error occured trying to create a download directory.");
				} else {
					callback();
				}
			});

		},
		function(callback) {

			// Add the User
			log.verbose("Creating user " + s.config.user + " on the server...");
			proc.exec("./lib/scripts/create_user.sh " + gconfig.basepath + " " + s.config.user + " " + password, function(error, stdout, stderr) {

				if(error !== null) {
					log.error("Error occured trying to execute a command to add a user.", stderr);
					return callback("Error occured trying to execute a command to add a user.");
				} else {
					log.verbose("User " + s.config.user + " created.");
					callback();
				}

			});

		},
		// function(callback) {
		//
		// 	if(hash !== null && !fs.existsSync('./data/downloads/unpack/' + hash)) {
		//
		// 		process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
		//
		// 		var file = fs.createWriteStream('./data/downloads/' + hash + '.tar.gz');
		// 		var request = http.get(gconfig.urls.repo + "/" + hash, function(response) {
		//
		// 			log.verbose("Beginning to download remote file (" + hash + ") from PufferPanel server at " + gconfig.urls.repo);
		// 			if(response.statusCode === 200){
		//
		// 				response.pipe(file);
		// 				file.on('finish', function() {
		//
		// 					file.close();
		// 					log.verbose("Finished downloading file to ./data/downloads/" + hash + ".tar.gz; beginning to unpack file...");
		//
		// 					async.series([
		// 						function(cb) {
		//
		// 							fs.ensureDir("./data/downloads/unpack/" + hash, function(error) {
		// 								if(error != null) {
		// 									log.error("An error occured trying to create a download directory.", error);
		// 								} else {
		// 									cb();
		// 								}
		// 							});
		//
		// 						},
		// 						function(cb) {
		//
		// 							fs.createReadStream('./data/downloads/' + hash + '.tar.gz').pipe(tar.extract('./data/download/unpack/' + hash));
		// 							log.verbose("Finished unpacking file to ./data/downloads/unpack" + hash + "...");
		// 							cb();
		//
		// 						},
		// 						function(cb) {
		// 							callback();
		// 						}
		// 					]);
		//
		// 				});
		//
		// 			} else {
		//
		// 				log.warn("Aborted attempting to download remote plugin file due to an error with the request.", response.statusCode);
		// 				request.abort();
		// 				return callback("aborted");
		//
		// 			}
		//
		// 		}).on('error', function(error) {
		//
		// 			fs.unlink('./data/downloads/' + hash + '.tar.gz');
		// 			log.error("An error occured while trying to save a remote file for installing a server.", error.message);
		// 			return callback("An error occured while trying to save a remote file for installing a server.");
		//
		// 		});
		//
		// 	} else {
		// 		log.verbose("Skipping file download, files already exist locally on server.");
		// 		callback();
		// 	}
		//
		// },
		// function(callback) {
		//
		// 	if(hash === null) {
		//
		// 		log.verbose("Server setup without any files being downloaded as requested.");
		// 		callback();
		//
		// 	} else {
		//
		// 		try {
		//
		// 			fs.copy('./data/downloads/unpack/' + hash, s.buildPath(null), function(error){
		// 				if(error) {
		// 					log.error("An error occured while trying to copy files to a newly created server.", error);
		// 					return callback("An error occured while trying to copy files to a newly created server.");
		// 				} else {
		// 					log.verbose("Copied files to user directory.");
		// 					callback();
		// 				}
		// 			});
		//
		// 		} catch(e) {
		// 			log.error("An error occured while trying to copy files to a newly created server.", e.stack);
		// 			return callback("An error occured while trying to copy files to a newly created server.");
		// 		}
		//
		// 	}
		//
		// },
		function(callback) {
			log.verbose("Finished install process for new server.");
			callback();
		}
	], function(error) {

		if(error) {

			if(error != "aborted") {
				res.send(500, {'error': error});
			} else {
				res.send(204);
			}

		} else {

			res.send(204);

		}

	});

}

Scales.prototype.resetPassword = function(newPassword, res) {

	var s = this;
	log.warn("Resetting account SFTP password for " + this.config.user + "...");

	proc.exec("./lib/scripts/reset_password.sh " + s.config.user + " " + newPassword, function(error, stdout, stderr) {

		if(error !== null) {
			log.error("Error occured trying to reset account password for " + s.config.user + " on the server.", stderr);
			res.send(500);
		} else {
			log.verbose("SFTP password for " + s.config.user + " was reset.");
			res.send(204);
		}

	});

}

Scales.prototype.mergeJson = function(json, obj, overwrite, res) {

	var finalObject = this.config,
		self = this;

	if(obj !== null) {

		var object = obj.split(':');
		if(object[1] != undefined) {
			var finalObject = this.config[object[1]];
		}

		if(overwrite == false) {
			finalObject[object[0]] = extend({}, this.config[object[0]], JSON.parse(json));
		} else {
			finalObject[object[0]] = JSON.parse(json);
		}

	} else {
		if(overwrite == false) {
			finalObject = extend({}, this.config, JSON.parse(json));
		} else {
			finalObject = JSON.parse(json);
		}
	}

	fs.writeFile("./data/" + this.config.name + ".json", JSON.stringify(finalObject, null, 4), function(error) {

		if(error) {
			log.error("An error occured while trying to update the config for a server.", error);
			res.send(500);
		} else {
			log.verbose("Config for server " + self.config.name + " has been updated by a remote source.");
			self.config = finalObject;
			res.send(204);
		}

	});

}

Scales.prototype.delete = function(res) {

	if(this.status != OFF) {
		this.kill(false);
	}

	var s = this;

	async.series([
		function(cb) {
			proc.exec("./lib/scripts/remove_user.sh " + gconfig.basepath + " " + s.config.user, function(error, stdout, stderr) {

				if(error !== null) {
					log.error("Error occured trying to execute a command to remove a user.", stderr);
					return cb("Error occured trying to execute a command to remove a user.");
				} else {
					log.verbose("User " + s.config.user + " was deleted from the system.");
					cb();
				}

			});
		},
		function(cb) {

			fs.remove('./data/' + s.config.name + '.json', function (err) {

				if(err) {
					log.error("An error occured while trying to remove the server data JSON file.", err);
					return cb(err);
				}

				cb();

			});

		}
	], function(error) {

		if(error) {
			res.send(500, {"message": error });
		} else {
			res.send(204);
		}

	});

}

module.exports = Scales;