/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 */
var fs = require("fs-extra"),
	log = require("./logger.js"),
	Scales = require("./process.js"),
	servers = {};

// Read all servers into memory.
fs.readdir('data/', function(error, files) {

	if(error) {
		log.error("An error occured while trying to load files into memory.", error);
		throw error;
	}

	files.forEach(function(file) {

		fs.readJson('data/' + file, function(error, json) {

			if(json != null) {

				/**
				 * Access this in other files with:
				 *
				 * var s = require("./initalize.js").servers;
				 * s[name].option();
				 *
				 * option(); should be a function from process.js
				 */
				initalize(json);

			} else {
				log.warn("File (" + file + ") detected as invalid JSON structure. Skipping...");
			}

		});

	});

});

function initalize(json) {

	servers[json.name] = new Scales(json);
	log.verbose("Loaded server configuration for " + json.name );

}

exports.initalize = initalize;
exports.servers = servers;