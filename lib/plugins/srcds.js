/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 *
 * srcds.js — Adds SRCDS Server support to Scales.js
 */
var fs = require("fs-extra"),
	path = require('path'),
	log = require("../logger.js"),
	pty = require("pty.js"),
	gconfig = require("../../config.json"),
	userid = require("userid"),
	properties = require("properties"),
	path = require("path"),
	crypto = require("crypto"),
	async = require("async"),
	gamedig = require("gamedig"),
	settings = {
		name: "SRCDS",
		stop: "quit",
		exe: "bash",
		srcds_exe: "./srcds_run",
		trigger: {
			started: 'to Steam servers'
		},
		log: "scales_srcdslog.log",
		install_script: "srcds_install.sh",
		lastQuery: {}
	};

settings.query = function query(config) {

	gamedig.query({
		type: 'protocol-valve',
		host: config.gamehost,
		port: parseInt(config.gameport)
	}, function(res) {

		if(res.error) {

			log.verbose("Query error encountered for " + config.gamehost + ":" + config.gameport, res.error);

		} else {

			settings.lastQuery = {
				hostname: res['name'],
				numplayers: res['players'].length,
				maxplayers: res['maxplayers'],
				map: res['map'],
				players: res['players'],
				bots: res['bots'],
				notes: res['notes'],
				time: new Date().getTime()
			}

		}

	});

}

/**
 * Run Pre-Flight
 */
settings.preflight = function(config, serverPath, callback) {

	//callback();

	var storedFile, userFile;
	async.series([
		function(callback2) {

			async.parallel([
				function(callbackp) {

					fs.readFile(path.join(serverPath, 'srcds_run'), function (err, data) {

						if(err) {

							log.error("Error detected while trying to open and read /home/" + config.user + "/srcds_run", err);
							log.error(err.message);

						} else {

							userFile = crypto.createHash('sha1').update(data).digest('hex');
							callbackp();

						}

					});

				},
				function(callbackp) {

					fs.readFile('/home/' + config.user + '/srcds_run', function (err, data) {

						if(err) {

							log.error("Error detected while trying to open and read /home/" + config.user + "/srcds_run", err);
							log.error(err.message);

						} else {

							storedFile = crypto.createHash('sha1').update(data).digest('hex');
							callbackp();

						}

					});

				}
			], function(error, results) {

				if(error == null) {
					callback2();
				}

			});

		},
		function(callback2) {

			log.verbose("Comparing file hash for srcds_run to ensure user has not modified it.");

			if(userFile !== storedFile) {

				// Tampered File
				log.warn("Detected srcds_run as being tampered with. Replacing this file now.");
				fs.copy('/home/' + config.user + '/srcds_run', path.join(serverPath, 'srcds_run'), function(error) {

					if(error) {
						log.error("An error occured while trying to overwrite changes to srcds_run due to a file hash mismatch.", error);
					} else {
						callback2();
					}

				});

			} else {
				callback2();
			}

		},
		function(callback2) {
			fs.remove(path.join(serverPath, settings.log), function (error) {

				if(error) {
					log.error("An error occured while trying to remove the old log file for " + config.name + " during the plugin preflight.", error);
				} else {
					callback2();
				}

			});
		},
		function(callback2) {
			log.verbose("Completed plugin preflight for " + config.name);
			callback();
		}
	]);

}

settings.startup = function(config) {

	var startupArray = this.srcds_exe + " " + config.startup.command;

	startupArray = startupArray.replace("${ip}", config.gamehost);
	startupArray = startupArray.replace("${port}", config.gameport);
	startupArray = startupArray.replace("${memory}", config.build.memory);

	for(var index in config.startup.variables) {

		startupArray = startupArray.replace("${" + index + "}", config.startup.variables[index]);

	}

	// ./srcds_run has an automatic restart built in. This conflicts with Scales and leads to many issues with the power controls.
	// Adding -norestart disables that functionality.
	if(startupArray.indexOf("-norestart") == -1) {
		startupArray += " -norestart 2>&1 | tee " + settings.log;
	} else {
		startupArray += " 2>&1 | tee " + settings.log;
	}

	return pty.spawn(this.exe, startupArray.match(/\S+/g), {
		cwd: gconfig.basepath + config.user + "/public",
		uid: userid.uid(config.user),
		gid: userid.gid(config.user)
	});

}

settings.installer = function(config, serverPath) {

	// Run SRCDS File
	// config.variables.srcds_game_id
	// config.variables.installed should be set to true once finished.

}

settings.onPtyData = function(serverPath, data) {

	fs.appendFile(path.join(serverPath, this.settings.log), data, function(error) {
		if(error) {
			log.error("An error occured trying to log data to file in srcds.onPtyData() [logging to: "+ path.join(serverPath, this.settings.log) + "]", error);
		}
	});

}

module.exports = settings;