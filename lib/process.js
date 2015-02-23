/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 */
var log = require("./logger.js"),
	pty = require("pty.js"),
	plugin = require("./plugins.js").pluginLoader,
	fs = require("fs-extra"),
	server = {};

/**
 * Server Status:
 * 0 - OFF
 * 1 - ON
 * 2 - STOPPING
 * 3 - STARTING
 */

function Scales(config) {

	this.status = 0;
	this.config = config;
	this.plugin = plugin[this.config.plugin + '.js'];

}

Scales.prototype.setStatus = function(status) {
	this.status = status;
}

/**
 * Creates a server using supplied JSON string.
 *
 * jsonConfig STRING JSON format of server config
 */
Scales.prototype.create = function(jsonConfig) {

	serverName = this.config.name;

	fs.outputJson("../data/" + serverName + ".json", jsonConfig, function(err) {

		if(err) {

			log.error("Error when creating a new server!",err);

		}

	});

}

/**
 * Deletes a server using server name.
 *
 * serverName STRING name of server
 */
Scales.prototype.delete = function(serverName) {

	serverName = this.config.name;

	fs.remove("../data/" + serverName + ".json", function(err) {

		if(err) {

			log.error("Error when deleting a server!",err);

		}

	});

}

// status - 0-2 (0 = turn off, 1 = turn on, 2 = restart)
Scales.prototype.power = function(status) {

	if(this.status == 0) {
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

	if(this.status == 0) {
		return;
	}

	log.warn("Server " + server.name + " has been killed by user.");
	this.setStatus(2);
	this.ps.write(this.plugin.stop+'\r');
	this.setStatus(0);
	this.emit('off');

}

Scales.prototype.test = function() {

	console.log(this.plugin);

}

module.exports = Scales;