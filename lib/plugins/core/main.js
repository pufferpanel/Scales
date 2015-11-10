/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 *
 * core.js — Core Plugin Functions Wrapper
 */
require('date-utils');
var Gamedig = require('gamedig');
var Util = require('util');
var Rfr = require('rfr');
var Logger = Rfr('lib/logger.js');

var Core = function (plugin) {

    this.serverConfig = plugin.serverConfig;
    this.rootPath = plugin.rootPath;
    this.publicPath = plugin.publicPath;
    this.settings = plugin.settings;

};

Core.prototype.startup = function () {

    var startupArray = Util.format('exec -it %s %s ', this.serverConfig.user, this.settings.exe) + this.serverConfig.startup.command
            .replace('${ip}', this.serverConfig.gamehost)
            .replace('${port}', this.serverConfig.gameport)
            .replace('${memory}', this.serverConfig.build.memory);

    for (var index in this.serverConfig.startup.variables) {
        startupArray = startupArray.replace('${' + index + '}', this.serverConfig.startup.variables[index]);
    }

    return startupArray.match(/\S+/g);

};

Core.prototype.query = function (next) {

    Gamedig.query({
        type: this.settings.query_type,
        host: this.serverConfig.gamehost,
        port: parseInt(this.serverConfig.gameport)
    }, function (res) {

        this.query = {};

        if (res.error) {
            this.query.error = res.error;
        } else {
            try {
                this.query.hostname = (res.name || null);
                this.query.numplayers = (res.players ? res.players.length : null);
                this.query.maxplayers = (res.maxplayers || null);
                this.query.map = (res.map || null);
                this.query.players = (res.players || null);
                this.query.plugins = (res.raw.plugins || '');
                this.query.version = (res.raw.version || null);
                this.query.type = (res.query.type || null);
            } catch (ex) {
                return next(ex);
            }
        }

        this.query.time = new Date().getTime();
        return next(null, this.query);

    });

};

Core.prototype.stringEndsWith = function (string, ending) {
    return string.indexOf(ending, string.length - ending.length) !== -1;
};

module.exports = Core;
