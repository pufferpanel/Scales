/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 *
 * minecraft.js — Adds Minecraft Server support to Scales.js
 */
var fs = require("fs-extra"),
	log = require("../logger.js"),
	properties = require("properties"),
	gamedig = require("gamedig"),
	jarPath = "data/plugins/minecraft/minecraft.jar";
	settings = {}:

settings = {
	name: "Minecraft",
	stop: "stop",
	executable: "java",
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
 * Copy jar file IF it does not already exist in the server root directory.
 */
settings.preflight = function(serverPath) {
	
	fs.exists(jarPath, function(exists) {
		
		if(exists) {
			
			return;
			
		} else {
			
			fs.copy(jarPath, serverPath);
			
		}
		
	});
	
}

module.exports = settings;