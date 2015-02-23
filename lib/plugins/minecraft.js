/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 *
 * minecraft.js — Adds Minecraft Server support to Scales.js
 */
var fs = require("fs-extra"),
	pathlib = require('path'),
	log = require("../logger.js"),
	properties = require("properties"),
	gamedig = require("gamedig"),
	settings = {}:

settings = {
	name: "Minecraft",
	stop: "stop",
	executable: "java",
	jar = "data/plugins/minecraft/minecraft.jar",
	joined: [
		"-Xms",
		"-Xmx",
		"-XX:PermSize=",
		"-Djline.terminal=",
		"-XX:ConcGCThreads="
	],
	log: "logs/latest.log",
	lastQuery: []
}

settings.query = function query(config) {

	gamedig.query({
		type: 'minecraft',
		host: config.ip,
		port: parseInt(config.port)
	}, function(res) {

		if(res.error) {
			
			log.verbose("Query error encountered for " + config.ip + ":" + config.port, res.error);
			
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
settings.preflight = function(config) {
	
	settingsPath = pathlib.join(cofnig.path,"server.properties");
	
	fs.exists(cofnig.path + "minecraft.jar", function(exists) {
		
		if(!exists) {
			
			throw new Error("Jar file is not found!")
			
		}
		
	});
	
	if(fs.existsSync(settingsPath)) {
		
		try{

			var rewrite = false;
			var serverConfig = properties.parse(settingsPath, {path:true}, function (error, obj) {

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
					properties.stringify(obj, {path:settingsPath}, function (error, obj) {
						
						if(error) {
							
							log.error("An error occured trying to update the server.properties file.", error);
							
						}
						
					});
					
				}

			});

		} catch(ex) {

			log.error("An uncaught error occured trying to update server.properties for "+ config.name, ex);

		}

	} else {

		log.error("Cannot boot server without a valid server.properties file.");

	}
	
}

settings.install = function(config) {
	
	//TODO: Copy files into server root dir
	
}

module.exports = settings;