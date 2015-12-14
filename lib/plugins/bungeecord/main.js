/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 *
 * bungeecord.js — Adds BungeeCord Server support to Scales.js
 */
require('date-utils');
var Fs = require('fs-extra');
var Rfr = require('rfr');
var Path = require('path');
var Logger = Rfr('lib/logger.js');
var Yaml = require('js-yaml');
var Util = require('util');
var Core = Rfr('lib/plugins/core/main.js');

/**
 * Establishes the plguin function and makes constants available across the entire function.
 * @param {object} preflight new Preflight();
 */
var Plugin = function (root, public, config) {

    this.serverConfig = config;
    this.rootPath = root;
    this.publicPath = public;
    this.settings = Rfr('lib/plugins/bungeecord/config.json');
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

    var self = this;
    var configPath = Path.join(this.publicPath, this.settings.cfg);

    // Is a JAR file defined for this server?
    if (this.serverConfig.startup.variables.jar === undefined) {
        Logger.error('No server jar is defined for ' + this.serverConfig.name);
        return next('No startup jar is defined for this server.');
    }

    // Does the JAR file actually exist on the system?
    if (!Fs.existsSync(Path.join(this.publicPath, this.serverConfig.startup.variables.jar))) {
        Logger.error(this.serverConfig.startup.variables.jar + ' does not seem to be in the server directory for ' + this.serverConfig.name);
        return next(this.serverConfig.startup.variables.jar + ' does not seem to be in the server directory.');
    }

    Fs.stat(configPath, function (err, stats) {

        if (err) {
            if (err.code === 'ENOENT') {
                return next(null, 1);
            }
            return next(err);
        }

        if (stats.isFile()) {

            try {

                var yml = Yaml.safeLoad(Fs.readFileSync(configPath));

                if (yml.listeners[0]) {
                    yml.listeners[0].query_enabled = true;
                    yml.listeners[0].query_port = self.serverConfig.gameport;
                    yml.listeners[0].host = Util.format('0.0.0.0:%s', self.serverConfig.gameport.toString());
                }

                // Allow only ONE listener per Bungee Instance
                for (var index in yml.listeners) {
                    if (index > 0) {
                        yml.listeners[index] = undefined;
                    }
                }

                Fs.writeFile(configPath, Yaml.safeDump(yml), function (err) {

                    if (err) {
                        return next(err);
                    }

                    Logger.verbose('Completed plugin preflight for ' + self.serverConfig.name);
                    return next();

                });

            } catch (ex) {
                Logger.error('An uncaught error occurred trying to update ' + self.settings.cfg + ' for ' + self.serverConfig.name, ex.stack);
                return next(ex.stack);
            }

        } else {
            return next(new Error('The properties file (' + propertiesPath + ') is not a valid file.'));
        }

    });

};

Plugin.prototype.startup = function () {
    return this.CorePlugin.startup();
};

module.exports = Plugin;
