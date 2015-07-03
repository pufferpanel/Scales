/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 *
 * pocketmine.js — Adds Pocketmine-MP server support to Scales.js
 */
var fs = require("fs-extra"),
	path = require('path'),
	log = require("../logger.js"),
	properties = require("properties"),
	gamedig = require("gamedig"),
	settings = {};

settings = {
	name: "Pocketmine-MP",
	stop: "stop",
	exe: "java",
	jar: "data/plugins/pocketmine/QuietPufferMine.jar",
	cfg: "server.properties",
	trigger: {
		started: ')! For help, type "help" or "?"',
		// eula: 'Go to eula.txt for more info.'
	},
	install_script: "pocketmine.sh",
	log: "logs/latest.log",
	lastQuery: {}
}

settings.query = function query(config) {

	gamedig.query({
		type: 'minecraft',
		host: config.gamehost,
		port: parseInt(config.gameport)
	}, function(res) {

		if(res.error) {

			log.verbose("Query error encountered for " + config.gamehost + ":" + config.gameport, res.error);

		} else {

			settings.lastQuery.hostname		= res['name'];
			settings.lastQuery.numplayers 	= res['players'].length;
			settings.lastQuery.maxplayers 	= res['maxplayers'];
			settings.lastQuery.map        	= res['map'];
			settings.lastQuery.players    	= res['players'];
			settings.lastQuery.plugins		= res['raw']['plugins'];
			settings.lastQuery.version		= res['raw']['version'];
			settings.lastQuery.type			= res['raw']['type'];
			settings.lastQuery.time 		= new Date().getTime();

		}

	});

}

/**
 * Check if the required jar file exists. If not, throw error and escape.
 * Check if we have a server settings file. If so; enable query, set server port, set query port, and set server ip.
 *    If we do NOT have a server settings file, throw error and escape.
 */
settings.preflight = function(config, basePath, callback) {

	propertiesPath = path.join(basePath, settings.cfg);

	if(config.startup.variables.jar == undefined) {

		log.error("No server jar is defined for " + config.name);
		callback("No startup file is defined for this server. Please contact support and let them know about this error.");
		return;

	}

	if(!fs.existsSync(path.join(basePath, config.startup.variables.jar))) {

			log.error(config.startup.variables.jar + " does not seem to be in the server directory for " + config.name);
			callback(config.startup.variables.jar + " does not seem to be in the server directory.");
			return;

	}

	if(fs.existsSync(propertiesPath)) {

		try{

			var rewrite = false;
			var serverConfig = properties.parse(propertiesPath, { path: true }, function (error, obj) {

				if(obj['enable-query'] != 'true') {
					obj['enable-query'] = 'true';
					rewrite = true;
				}

				if(obj['server-port'] != config.gameport) {
					obj['server-port'] = config.gameport;
					rewrite = true;
				}

				if(obj['query.port'] != config.gameport) {
					obj['query.port'] = config.gameport;
					rewrite = true;
				}

				if(obj['server-ip'] != config.gamehost) {
					obj['server-ip'] = config.gamehost;
					rewrite = true;
				}

				if(rewrite) {

					properties.stringify(obj, { path: propertiesPath }, function (error, obj) {

						if(error) {
							log.error("An error occured trying to update the " + settings.cfg + " file for " + config.name, error);
							return;
						} else {
							log.verbose("Completed plugin preflight for " + config.name);
							callback();
						}

					});

				}

			});

		} catch(ex) {
			log.error("An uncaught error occured trying to update server.properties for "+ config.name, ex.stack);
			console.log(ex.stack);
			return;
		}

	} else {

		log.warn("Completed plugin preflight for " + config.name + " but we need to restart the server right after because the server.properties file isn't generated yet.");
		callback(null, 1);

	}

}

module.exports = settings;
