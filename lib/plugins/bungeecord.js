/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 *
 * bungeecord.js — Adds Bungee Server support to Scales.js
 */
var fs = require("fs-extra"),
	path = require('path'),
	log = require("../logger.js"),
	properties = require("properties"),
	gamedig = require("gamedig"),
	yaml = require("js-yaml"),
	settings = {};

settings = {
	name: "BungeeCord",
	stop: "end",
	exe: "java",
	jar: "data/plugins/bungeecord/bungeecord.jar",
	cfg: "config.yml",
	trigger: {
		started: '[INFO] Listening on '
	},
	install_script: "bungeecord_install.sh",
	log: "proxy.log.0",
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

	configPath = path.join(basePath, settings.cfg);

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

	if(fs.existsSync(configPath)) {

		try{

			var rewrite = false,
				yml = yaml.safeLoad(fs.readFileSync(configPath));

			if(yml.listeners[0]) {

				if(yml.listeners[0].host != config.gamehost + ":" + config.gameport) {

					yml.listeners[0].host = config.gamehost + ":" + config.gameport;
					rewrite = true;

				}

				if(yml.listeners[0].query_enabled != true) {

					yml.listeners[0].query_enabled = true;
					rewrite = true;

				}

				if(yml.listeners[0].query_port != config.gameport) {

					yml.listeners[0].query_port = config.gameport;
					rewrite = true;

				}

			}

			// Allow only ONE listener per Bungee Instance
			for(var index in yml.listeners) {

				if(index > 0) {

					rewrite = true;
					yml.listeners[index] = undefined;

				}

			}

			if(rewrite === true) {

				fs.writeFileSync(configPath, yaml.safeDump(yml));

			}

			log.verbose("Completed plugin preflight for " + config.name);
			callback();

		} catch(ex) {

			log.error("An uncaught error occured trying to update " + settings.cfg + " for "+ config.name, ex.stack);
			console.log(ex.stack);
			return;

		}

	} else {

		// We need to make a very simple config.yml file in here
		log.verbose("Completed plugin preflight for " + config.name + " but we need to restart the server right after because the config.yml file isn't generated yet.");
		callback(null, 1);

	}

}

module.exports = settings;