/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 *
 * mcserver.js — Adds MCServer (a C++ Minecraft Server) support to Scales.js
 */
var fs = require("fs-extra"),
	async = require("async"),
	path = require('path'),
	log = require("../logger.js"),
	gamedig = require("gamedig"),
	ini = require("ini"),
	settings = {};

settings = {
	name: "MCServer",
	stop: "stop",
	exe: "./MCServer",
	cfg: "settings.ini",
	webadmin: "webadmin.ini",
	trigger: {
		started: 'Startup complete, took'
	},
	install_script: "mcserver_install.sh",
	manual_log: true,
	log: "logs/latest.log",
	lastQuery: {}
}

settings.query = function query(config) {

	// Non-Functional

}

settings.preflight = function(config, basePath, callback) {

	settingsPath = path.join(basePath, settings.cfg);
	webadminPath = path.join(basePath, settings.webadmin);

	if(!fs.existsSync(path.join(basePath, settings.exe))) {

			log.error(settings.exe + " does not seem to be in the server directory for " + config.name);
			callback(settings.exe + " does not seem to be in the server directory.");
			return;

	}

	if(fs.existsSync(settingsPath) && fs.existsSync(webadminPath)) {

		try{

			var rewrite = false;
			var settingsConfig = ini.parse(fs.readFileSync(settingsPath, 'utf-8'));
			var webadminConfig = ini.parse(fs.readFileSync(webadminPath, 'utf-8'));

			if(settingsConfig.Server.Ports != config.gameport) {
				settingsConfig.Server.Ports = config.gameport;
				rewrite = true;
			}

			if(webadminConfig.WebAdmin.Enabled != 0) {
				webadminConfig.WebAdmin.Enabled = 0;
				rewrite = true;
			}

			if(rewrite) {

				async.series([
					function(cb) {
						fs.writeFile(settingsPath, ini.stringify(settingsConfig), function(error) {

							if(error) {
								log.error("An error occured trying to update the " + settings.cfg + " file for " + config.name, error);
								return;
							} else {
								log.verbose("Updated settings.ini file for " + config.name);
								cb();
							}

						});
					},
					function(cb) {
						fs.writeFile(webadminPath, ini.stringify(webadminConfig), function(error) {

							if(error) {
								log.error("An error occured trying to update the " + settings.webadmin + " file for " + config.name, error);
								return;
							} else {
								log.verbose("Updated webadmin.ini file for " + config.name);
								log.verbose("Completed plugin preflight for " + config.name);
								callback();
							}

						});
					}
				]);

			} else {
				log.verbose("Completed plugin preflight (no files updated) for " + config.name);
				callback();
			}

		} catch(ex) {
			log.error("An uncaught error occured trying to update webadmin.ini and settings.ini for "+ config.name, ex.stack);
			console.log(ex.stack);
			return;
		}

	} else {

		log.warn("Completed plugin preflight for " + config.name + " but we need to restart the server right after because settings.ini and webadmin.ini files aren't generated yet.");
		callback(null, 1);

	}

}

module.exports = settings;