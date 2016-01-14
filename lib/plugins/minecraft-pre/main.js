/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 *
 * minecraft.js — Adds Minecraft Server support to Scales.js
 */
require('date-utils');
var Fs = require('fs-extra');
var Rfr = require('rfr');
var Path = require('path');
var Logger = Rfr('lib/logger.js');
var Properties = require('properties-parser');
var Core = Rfr('lib/plugins/core/main.js');
var GlobalConfig = Rfr('config.json');

/**
 * Establishes the plugin function and makes constants available across the entire function.
 * @param {object} preflight new Preflight();
 */
var Plugin = function (root, public, config) {

    this.serverConfig = config;
    this.rootPath = root;
    this.publicPath = public;
    this.settings = Rfr('lib/plugins/minecraft-pre/config.json');
    this.query = {};
    this.useDocker = ((typeof GlobalConfig.docker === 'undefined') || (GlobalConfig.docker == true));;

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
    var propertiesPath = Path.join(this.publicPath, this.settings.cfg);

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

    Fs.stat(propertiesPath, function (err, stats) {

        if (err) {
            if (err.code === 'ENOENT') {
                return next(null, 1);
            }
            return next(err);
        }

        if (stats.isFile()) {

            Properties.createEditor(propertiesPath, function (err, editor) {

                if (err) {
                    Logger.error('An error occurred while attempting to read the server.properties file for ' + this.serverConfig.name, err);
                    return next('An error occurred while attempting to read the server.properties file.');
                }

                editor.set('enable-query', 'true');
                editor.set('server-port', self.serverConfig.gameport.toString());
                editor.set('server-ip', self.useDocker ? '0.0.0.0' : self.serverConfig.gamehost.toString());
                editor.set('query.port', self.serverConfig.gameport.toString());

                editor.save(propertiesPath, function (err) {

                    if (err) {
                        Logger.error('An error occurred trying to update the ' + self.settings.cfg + ' file for ' + self.serverConfig.name, err);
                        return next(new Error('An error occurred trying to update the ' + self.settings.cfg + ' file'));
                    }

                    Logger.verbose('Completed plugin preflight for ' + self.serverConfig.name);
                    return next();

                });

            });

        } else {
            return next(new Error('The properties file (' + propertiesPath + ') is not a valid file.'));
        }

    });

};

Plugin.prototype.startup = function () {
    return this.CorePlugin.startup();
};

module.exports = Plugin;
