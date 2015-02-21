/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 */
var fs = require("fs-extra"),
	log = require("./logger.js"),
	pluginLoader = {};

fs.readdirSync(__dirname + "/plugins").forEach(function(file) {

	if(file.slice(-3) == ".js"){

		path = __dirname + "/plugins/" + file;
		if (fs.lstatSync(path).isFile()){
			log.info("Loading plugin " + file + "...");
			pluginLoader[file] = require(path);
		}

	}

});

exports.pluginLoader = pluginLoader;