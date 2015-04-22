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
	settings = {
		name: "SRCDS",
		stop: "quit",
		exe: "./srcds_run.sh",
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
settings.preflight = function(config, basePath, callback) {

	fs.remove(path.join(basePath, this.settings.log), function (error) {

		if(error) {
			log.error("An error occured while trying to remove the old log file for " + config.name + " during the plugin preflight.", error);
		} else {
			log.verbose("Completed plugin preflight for " + config.name);
			callback();
		}

	});

}

settings.onPtyData = function(serverPath, data) {

	fs.appendFile(path.join(serverPath, this.settings.log), data, function(error) {
		if(error) {
			log.error("An error occured trying to log data to file in srcds.onPtyData() [logging to: "+ path.join(serverPath, this.settings.log) + "]", error);
		}
	});

}

module.exports = settings;