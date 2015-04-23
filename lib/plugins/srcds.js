/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 *
 * srcds.js — Adds SRCDS Server support to Scales.js
 */
var fs = require("fs-extra"),
	path = require('path'),
	log = require("../logger.js"),
	properties = require("properties"),
	path = require("path"),
	crypto = require("crypto"),
	async = require("async"),
	settings = {
		name: "SRCDS",
		stop: "quit",
		exe: "./srcds_run",
		trigger: {
			started: 'Assigned anonymous gameserver Steam ID'
		},
		log: "scales_srcds_log.log",
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
			fs.readFile(path.join(serverPath, 'srcds_run'), function (err, data) {
				userFile = crypto.createHash('sha1').update(data).digest('hex');
				callback2();
			});
		},
		function(callback2) {
			fs.readFile('/home/' + config.user + '/srcds_run', function (err, data) {
		    	storedFile = crypto.createHash('sha1').update(data).digest('hex');
				callback2();
			});
		},
		function(callback2) {

			log.verbose("Comparing file hash for srcds_run to ensure user has not modified it.");
			if(userFile !== storedFile) {

				// Tampered File
				log.warn("Detected srcds_run as being tampered with. Replacing this file now.");
				fs.move('/home/' + config.user + '/srcds_run', path.join(serverPath, 'srcds_run'), {'clobber': true}, function(error) {

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
			log.verbose("Completed plugin preflight for " + config.name);
			callback();
		}
	]);

	// fs.remove(path.join(serverPath, this.settings.log), function (error) {
	//
	// 	if(error) {
	// 		log.error("An error occured while trying to remove the old log file for " + config.name + " during the plugin preflight.", error);
	// 	} else {
	// 		log.verbose("Completed plugin preflight for " + config.name);
	// 		callback();
	// 	}
	//
	// });

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