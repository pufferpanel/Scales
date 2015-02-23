/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 */
var log = require("./logger.js"),
	pty = require("pty.js"),
	plugin = require("./plugins.js").pluginLoader,
	fs = require("fs-extra"),
	async = require("async");
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

Scales.prototype.start = function(){

	async.series([
		function(callback) {
			
			//TODO: Preflight server
			
		},
		function(callback) {
			
			//TODO: Start server
			
		}
	]);

}

Scales.prototype.setStatus = function(status) {
	
	this.status = status;
	
}

/**
 * Creates a server using supplied JSON string.
 */
Scales.prototype.create = function() {

	log.verbose("Creating base config file for " + this.config.name);
	fs.outputJson("data/" + this.config.name + ".json", this.config, function(err) {

		if(err) {

			log.error("Error occured while attempting to write server config to disk.", err);

		}

	});

}

/**
 * Deletes a server using server name.
 */
Scales.prototype.delete = function() {

	fs.remove("data/" + this.config.name + ".json", function(err) {

		if(err) {
			log.error("Error when deleting server config for " + this.config.name, err);
		}

	});

}

// status - 0-2 (0 = turn off, 1 = turn on, 2 = restart)
Scales.prototype.power = function(status) {


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

/**
 * Queries a server using Gamedig
 * Results can be retrieved from this.plugin.settings.lastQuery
 */
Scales.prototype.query = function() {

	this.plugin.query(this.config);

}

module.exports = Scales;