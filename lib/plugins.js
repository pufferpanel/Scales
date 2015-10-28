/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 */
var Fs = require('fs-extra');
var Rfr = require('rfr');
var Path = require('path');
var Util = require('util');
var Logger = Rfr('lib/logger.js');
var pluginLoader = {};

Fs.readdirSync(Path.join(__dirname, 'plugins')).forEach(function (file) {

    if (file.slice(-3) === '.js') {
        path = Path.join(__dirname, 'plugins', file);

        if (Fs.lstatSync(path).isFile()){
            Logger.info(Util.format('Loaded plugin %s...', file));
            pluginLoader[file] = require(path);
        }
    }
});

exports.pluginLoader = pluginLoader;
