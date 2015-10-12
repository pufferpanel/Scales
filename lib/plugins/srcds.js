/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 *
 * srcds.js — Adds Source Dedicated Server support to Scales.js
 */
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
            started: 'Calling BreakpadMiniDumpSystemInit'
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
Plugin.prototype.queryServer = function () {

    var self = this;

    Gamedig.query({
        type: 'protocol-valve',
        host: this.serverConfig.gamehost,
        port: parseInt(this.serverConfig.gameport)
    }, function (res) {

        self.query.error          = res.error;
        self.query.hostname       = res.name;
        self.query.numplayers     = res.players.length;
        self.query.maxplayers     = res.maxplayers;
        self.query.map            = res.map;
        self.query.players        = res.players;
        self.query.plugins        = res.raw.plugins;
        self.query.version        = res.raw.version;
        self.query.type           = res.raw.type;
        self.query.time           = new Date().getTime();
        return true;

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

    var startupArray = Util.format('exec -it %s %s ', this.serverConfig.user, this.settings.exe) + this.serverConfig.startup.command
        .replace('${ip}', this.serverConfig.gamehost)
        .replace('${port}', this.serverConfig.gameport)
        .replace('${memory}', this.serverConfig.build.memory);

    for (var index in this.serverConfig.startup.variables) {
        startupArray = startupArray.replace('${' + index + '}', this.serverConfig.startup.variables[index]);
    }

    // ./srcds_run has an automatic restart built in. This conflicts with Scales and leads to many issues with the power controls.
    // Adding -norestart disables that functionality.
    if (startupArray.indexOf('-norestart') === -1) {
        startupArray += ' -norestart';
    }

    return startupArray;

};


module.exports = Plugin;
