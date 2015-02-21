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
	settings = {};

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
	log: "logs/latest.log"
}

settings.query = function query(server) {

	gamedig.query({
		type: 'minecraft',
		host: server.ip,
		port: parseInt(server.port)
	}, function(res) {
		if(res.error) {
			log.verbose("Query error encountered for " + server.ip + ":" + server.port, res.error);
		} else {

			self.hostname 	= res['name'];
			self.numplayers = res['players'].length;
			self.maxplayers = res['maxplayers'];
			self.map        = res['map'];
			self.players    = res['players'];
			self.plugins	= res['raw']['plugins'];
			self.version	= res['raw']['version'];
			self.type		= res['raw']['type'];
			self.lastquerytime = new Date().getTime();

		}
	});

}

module.exports = settings;