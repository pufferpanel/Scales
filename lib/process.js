/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 */
var log = require("./logger.js"),
	pty = require("pty.js"),
	pluginLoader = require("./plugins.js"),
	server = {};

/**
 * Server Status:
 * 0 - OFF
 * 1 - ON
 * 2 - STOPPING
 * 3 - STARTING
 */

function Scales(find) {

	this.config = require("../data/" + find + ".json");

}

// status - 0-2 (0 = turn off, 1 = turn on, 2 = restart)
Scales.prototype.power = function(status) {

	if(server.status == 0) {
		return;
	}

	if(status == 0) {

		this.setStatus(2);
		this.ps.write(this.plugin.stop+'\r');
		this.setStatus(0);
		this.emit('off');

	}

}

Scales.prototype.kill = function(status) {

	if(server.status == 0) {
		return;
	}

	log.warn("Server " + server.name + " has been killed by user.");
	this.setStatus(2);
	this.ps.write(this.plugin.stop+'\r');
	this.setStatus(0);
	this.emit('off');

}

Scales.prototype.test = function(action) {

	log.warn(this.config.name);

}

module.exports = Scales;