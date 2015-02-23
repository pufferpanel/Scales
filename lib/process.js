/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 */
var log = require("./logger.js"),
	pty = require("pty.js"),
	plugin = require("./plugins.js").pluginLoader,
	fs = require("fs-extra"),
	async = require("async"),
	proc = require("child_process"),
	utils = require("./utilities.js"),
	userid = require("userid"),
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
	this.command = utils.merge(this.plugin.joined, this.config.variables);

}

Scales.prototype.setStatus = function(status) {

	this.status = status;

}

Scales.prototype.preflight = function() {

	var s = this;
	log.verbose("Running preflight for server " + s.config.name);

	async.series([
		function(callback) {
			proc.exec("chown -R " + s.config.user + ":" + s.config.user + " " + s.config.path, function(error, stdout, stdin) {

				if(error !== null) {
					log.error("Unable to complete preflight for server " + s.config.name + " due to a permissions error.", error);
					return;
				}

				log.verbose("Completed permissions preflight for server " + s.config.name);
				callback();

			});
		},
		function(callback) {
			log.verbose("Running plugin preflight for server " + s.config.name);
			s.plugin.preflight(s.config, callback);
		},
		function(callback) {
			log.verbose("Running power on function for server " + s.config.name);
			s.power(1, callback);
		}
	]);

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
Scales.prototype.power = function(status, callback) {

	if(status == 1) {
		this.powerOn(callback);
	}

	if(status == 2) {
		this.powerCycle(callback);
	}

}

Scales.prototype.powerOn = function(callback) {

	var s = this;

	if(this.status != 0) {
		return;
	}

	try {

		log.verbose("Attempting to spawn server process for " + this.config.name + "...");

		this.ps = pty.spawn(this.plugin.exe, this.command, {
			cwd: this.config.path,
			uid: userid.uid(this.config.user),
			gid: userid.gid(this.config.user)
		});

	} catch(ex) {

		log.error("Unable to start server for " + this.config.name + " due to an exception.", ex.stack);
		return;

	}

	this.setStatus(3);
	log.verbose("Starting " + this.config.plugin + " server for " + this.config.name + " (pid: " + this.ps.pid + ")...");

	try {

		this.cpu_limit = parseInt(this.config.build.cpu);

		if(this.cpu_limit > 0) {

			log.verbose("Starting CPU limiter for server " + this.config.name + " (pid " + this.ps.pid + ")");
			this.cpu = pty.spawn('cpulimit',  ['-p', this.ps.pid, '-z', '-l', this.cpu_limit]);

			this.cpu.on('close', function(code) {
				log.warn("CPU limit for server " + this.config.name + " (pid: " + this.ps.pid + ") was stopped.", code);
			});

		}

	} catch(ex) {
		log.warn("Server " + this.config.name + " seems to be missing a CPU limit variable. Running without a limit.", ex.stack);
	}

	callback();

	this.ps.on('data', function(data) {

		output = data.toString();
		console.log(data);

		if(s.status == 3) {

			// Only applies to MC Servers
			// Should consider adding a call here for s.plugin.postStart();
			if(s.plugin.trigger.eula) {

				if(output.indexOf(s.plugin.trigger.eula) !=-1) {

					s.setStatus(2);
					s.emit('off');

					log.warn("Server " + s.config.name + " has not yet accepted the EULA. Stopping server...");

				}

			}

			if(output.indexOf(self.plugin.trigger.started) !=-1){

				s.setStatus(1);
				s.emit('started');

				log.verbose("Server " + s.config.name + " successfully started.");

			}

		}

	});

	this.ps.on('exit', function() {

		if (s.status == 1 || s.status == 3){

			log.warn("Server "+ s.config.name + " detected as crashed. Attempting to reboot now...");
			s.setStatus(0);
			s.emit('crashed');

		}

		if (s.status == 2){

			log.verbose("Stopping server for "+ s.config.name);
			s.setStatus(0);
			s.emit('off');
			return;

		}

	});

	this.on('crashed', function() {

		if(s.status != 1) {
			s.power(2);
		}

	});

	this.on('off', function() {

		if(this.cpu) {
			this.cpu.kill();
		}

		log.verbose("Stopping server " + s.config.name);

		s.pid = undefined;
		s.cpu = undefined;

	});

}

Scales.prototype.powerCycle = function() {

	this.powerOff();
	this.preflight();

}

Scales.prototype.powerOff = function() {

}

Scales.prototype.kill = function(status) {

	if(this.status == 0) {
		return;
	}

}

/**
 * Queries a server using Gamedig
 * Results can be retrieved from this.plugin.settings.lastQuery
 */
Scales.prototype.query = function() {

	this.plugin.query(this.config);

}

module.exports = Scales;