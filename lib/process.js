/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 */
var log = require("./logger.js"),
	gconfig = require("../config.json"),
	pty = require("pty.js"),
	path = require("path"),
	plugin = require("./plugins.js").pluginLoader,
	fs = require("fs-extra"),
	async = require("async"),
	trim = require("trim"),
	proc = require("child_process"),
	events = require("events"),
	util = require("util"),
	utils = require("./utilities.js"),
	userid = require("userid"),
	usage = require("usage"),
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
	this.command = utils.merge(this.plugin.joined, this.config.variables);

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
			proc.exec("chown -R " + s.config.user + ":" + s.config.user + " " + s.config.path, function(error, stdout, stdin) {

				if(error !== null) {
					log.error("Unable to complete preflight for server " + s.config.name + " due to a permissions error.", error);
					return;
				}

				log.verbose("Completed permissions preflight for server " + s.config.name);
				callback();

			});
		},
		function(callback) {
			log.verbose("Running plugin preflight for server " + s.config.name);
			s.plugin.preflight(s.config, callback);
		},
		function(callback) {
			log.verbose("Running power on function for server " + s.config.name);
			s.power(1, callback);
		}
	]);

}

/**
 * Creates a server using supplied JSON string.
 */
Scales.prototype.create = function() {

	log.verbose("Creating base config file for " + this.config.name);
	fs.outputJson("data/" + this.config.name + ".json", this.config, function(err) {

		if(err) {

			log.error("Error occured while attempting to write server config to disk.", err);

		}

	});

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

		this.ps = pty.spawn(this.plugin.exe, this.command, {
			cwd: this.config.path,
			uid: userid.uid(this.config.user),
			gid: userid.gid(this.config.user)
		});

	} catch(ex) {

		log.error("Unable to start server for " + this.config.name + " due to an exception.", ex.stack);
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

			//Kill server and reboot
			async.series([
				function(callback) {
					log.warn("Attempting to kill crashed process (pid: " + s.ps.pid + ") for server " + s.config.name);
					s.kill(callback);
				},
				function(callback) {
					log.warn("Server process (pid: " + this.ps.pid + ") for " + this.config.name + " killed.");
					s.preflight();
				}
			]);

		}

	});

	this.on('off', function() {

		if(s.status != OFF) {
			log.verbose("Stopping server process for " + s.config.name);
			clearInterval(s.processStats);
			clearInterval(s.queryServer);
			s.setStatus(OFF);
		}

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

Scales.prototype.kill = function(callback) {

	if(this.ps.pid !== 'undefined') {

		this.setStatus(STOPPING);
		this.ps.kill();

	}

	this.on('off', function(){

		if(typeof callback !== 'undefined') {
			callback();
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

	var directory = path.join(this.config.path, path.normalize(base)),
		files = [];

	if(directory.indexOf(this.config.path) != 0) {

		log.error("API attempted to access a file outside of home directory of " + this.config.path + ". Request denied.");
		return false;

	}

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

	var filepath = path.join(this.config.path, path.normalize(querystring.unescape(base)));

	if(filepath.indexOf(this.config.path) != 0) {

		log.error("API attempted to access a file outside of home directory " + this.config.path + ". Request denied.");
		return false;

	}

	if(fs.existsSync(filepath) && fs.statSync(filepath).isFile()) {
		return fs.readFileSync(filepath, "UTF-8");
	} else {
		return false;
	}

}

Scales.prototype.writeFile = function(base, contents) {

	var filepath = path.join(this.config.path, path.normalize(querystring.unescape(base)));

	if(filepath.indexOf(this.config.path) != 0) {

		log.error("API attempted to write a file outside of home directory " + this.config.path + ". Request denied.");
		return false;

	}

	try {

		fs.outputFileSync(filepath, contents);
		return true;

	} catch(e) {

		log.error("An exception occured while trying to write a file to " + filepath, e.stack);
		return false;

	}

}

Scales.prototype.delete = function(base) {

	var filepath = path.join(this.config.path, path.normalize(querystring.unescape(base)));

	if(filepath.indexOf(this.config.path) != 0) {

		log.error("API attempted to delete a file outside of home directory " + this.config.path + ". Request denied.");
		return false;

	}

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
		l = fs.readFileSync(path.join(this.config.path, this.plugin.log)).toString().split('\n');
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
		result.cpu = (result.cpu).toFixed(2);
		s.usageStatistics = result;
		s.emit('stats');
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

module.exports = Scales;