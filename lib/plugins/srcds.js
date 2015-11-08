/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 *
 * srcds.js — Adds Source Dedicated Server support to Scales.js
 */
require('date-utils');
var Rfr = require('rfr');
var Path = require('path');
var Logger = Rfr('lib/logger.js');
var Gamedig = require('gamedig');
var Util = require('util');

/**
 * Establishes the plguin function and makes constants avaliable across the entire function.
 * @param {object} preflight new Preflight();
 */
var Plugin = function (root, public, config) {

    this.serverConfig = config;
    this.rootPath = root;
    this.publicPath = public;

    this.settings = {
        name: 'SRCDS',
        stop: 'quit',
        exe: './srcds_run',
        pgrep_exe: 'srcds_linux',
        cfg: 'server.properties',
        trigger: {
            started: 'to Steam servers'
        },
        manual_log: true,
        log: 'scales_srcdslog.log',
        install_script: 'srcds_install.sh',
        ports: {
            listen: 27015
        }
    };

    this.query = {};
};

/**
 * Queries the specified server using Gamedig and returns the information in a standard format.
 * @return {bool}
 */
Plugin.prototype.queryServer = function (next) {

    var self = this;

    Gamedig.query({
        type: 'protocol-valve',
        host: this.serverConfig.gamehost.toString(),
        port: parseInt(this.serverConfig.gameport)
    }, function (res) {

        self.query.error = res.error;

        if (res.error) {
            self.query.error = res.error;
        } else {
            try {
                self.query.hostname = (res.name || null);
                self.query.numplayers = (res.players.length || null);
                self.query.maxplayers = (res.maxplayers || null);
                self.query.map = (res.map || null);
                self.query.players = (res.players || null);
                self.query.plugins = (res.raw.plugins || null);
                self.query.version = (res.raw.version || null);
                self.query.type = (res.query.type || null);
            } catch (ex) {
                Logger.warn(ex.stack);
            }
        }

        self.query.time = new Date().getTime();

        if (typeof next === 'function') {
            return next();
        }

    });

};

/**
 * Runs the plugin PreFlight before attempting to start the server.
 * Checks for basic mistakes in configuration or other issues with the files.
 * @param {callback}
 * @return {callback} Returns results in a callback next()
 */
Plugin.prototype.preflight = function (next) {

    return next();
};

Plugin.prototype.startup = function () {

    // ./srcds_run has an automatic restart built in. This conflicts with Scales and leads to many issues with the power controls.
    // Adding -norestart disables that functionality.
    if (!this.stringEndsWith(this.serverConfig.startup.command, '-norestart')) {
        this.serverConfig.startup.command = this.serverConfig.startup.command + ' -norestart';
    }

    var startupArray = Util.format('exec -it %s %s ', this.serverConfig.user, this.settings.exe) + this.serverConfig.startup.command
            .replace('${ip}', this.serverConfig.gamehost)
            .replace('${port}', this.serverConfig.gameport)
            .replace('${memory}', this.serverConfig.build.memory);

    for (var index in this.serverConfig.startup.variables) {
        startupArray = startupArray.replace('${' + index + '}', this.serverConfig.startup.variables[index]);
    }

    return startupArray;

};

Plugin.prototype.stringEndsWith = function (string, ending) {
    return string.indexOf(ending, string.length - ending.length) !== -1;
};

module.exports = Plugin;
