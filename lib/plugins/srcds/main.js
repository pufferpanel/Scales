/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 *
 * srcds.js — Adds Source Dedicated Server support to Scales.js
 */
require('date-utils');
var Rfr = require('rfr');
var Logger = Rfr('lib/logger.js');
var Util = require('util');
var Core = Rfr('lib/plugins/core/main.js');
var StringUtils = Rfr('lib/utils/stringutils.js');

/**
 * Establishes the plugin function and makes constants available across the entire function.
 * @param {object} preflight new Preflight();
 */
var Plugin = function (root, public, config) {

    this.serverConfig = config;
    this.rootPath = root;
    this.publicPath = public;
    this.settings = Rfr('lib/plugins/srcds/config.json');
    this.query = {};

    this.CorePlugin = new Core(this);
};

/**
 * Queries the specified server using Gamedig and returns the information in a standard format.
 * @return {bool}
 */
Plugin.prototype.queryServer = function (next) {

    var self = this;
    this.CorePlugin.query(function (err, query) {

        if (err) {
            Logger.error(err.stack);
            return next(err);
        }

        self.query = query;
        return next();

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
    if (!this.CorePlugin.stringEndsWith(this.serverConfig.startup.command, '-norestart')) {
        this.serverConfig.startup.command = this.serverConfig.startup.command + ' -norestart';
    }

    var startupArray = Util.format('%s %s', this.settings.exe, this.serverConfig.startup.command
        .replace(new RegExp(StringUtils.escapeRegExp('${ip}'), 'gi'), this.serverConfig.gamehost.toString())
        .replace(new RegExp(StringUtils.escapeRegExp('${port}'), 'gi'), this.serverConfig.gameport.toString())
        .replace(new RegExp(StringUtils.escapeRegExp('${memory}'), 'gi'), this.serverConfig.build.memory.toString()));

    for (var index in this.serverConfig.startup.variables) {
        startupArray = startupArray.replace(new RegExp(StringUtils.escapeRegExp('${' + index + '}'), 'gi'), this.serverConfig.startup.variables[index]);
    }
};

module.exports = Plugin;
