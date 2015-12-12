/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 */
var Fs = require('fs-extra');
var Rfr = require('rfr');
var Path = require('path');
var Util = require('util');
var Logger = Rfr('lib/logger.js');
var Scales = Rfr('lib/process.js');
var servers = {};

// Read all servers into memory.
Fs.readdir('./data/', function (err, files) {

    if (err) {
        Logger.error('An error occurred while trying to load files into memory.', err);
        throw err;
    }

    files.forEach(function (file) {

        if (Path.extname(file) === '.json') {
            Fs.readJson('data/' + file, function (err, json) {

                if (json !== null) {
                    /**
                     * Access this in other files with:
                     *
                     * var s = require('./initalize.js').servers;
                     * s[name].option();
                     *
                     * option(); should be a function from process.js
                     */
                    initalize(json);
                } else {
                    Logger.warn(Util.format('File (%s) detected as invalid JSON structure. Skipping.', file));
                }
            });
        }
    });
});

var initalize = function (json) {

    servers[json.name] = new Scales(json);

    if (typeof servers[json.name].socketio === 'function') {
        servers[json.name].socketio();
    }

    if (typeof servers[json.name].binaryjs === 'function') {
        servers[json.name].binaryjs();
    }

    Logger.verbose(Util.format('Loaded server configuration for %s', json.name));

};

exports.initalize = initalize;
exports.servers = servers;
