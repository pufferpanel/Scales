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
var Gamedig = require('gamedig');
var Yaml = require('js-yaml');
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
        name: 'BungeeCord',
        stop: 'end',
        exe: 'java',
        pgrep_exe: 'java',
        cfg: 'config.yml',
        trigger: {
            started: '[INFO] Listening on '
        },
        install_script: 'bungeecord_install.sh',
        log: 'proxy.log.0',
        ports: {
            listen: 25565
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
        type: 'minecraftping',
        host: this.serverConfig.gamehost,
        port: parseInt(this.serverConfig.gameport)
    }, function (res) {

        self.query.error = res.error;

        if (res.error) {
            self.query.error = res.error;
        } else {
            try {
                self.query.hostname = (res.name || null);
                self.query.numplayers = (res.players ? res.players.length : null);
                self.query.maxplayers = (res.maxplayers || null);
                self.query.map = (res.map || null);
                self.query.players = (res.players || null);
                self.query.plugins = (res.raw.plugins || '');
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

    var self = this;
    configPath = Path.join(this.publicPath, this.settings.cfg);

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

    if (Fs.existsSync(configPath)) {
        try {
            var rewrite = false;
            var yml = Yaml.safeLoad(Fs.readFileSync(configPath));

            if (yml.listeners[0]) {
                if (yml.listeners[0].query_enabled !== true) {
                    yml.listeners[0].query_enabled = true;
                    rewrite = true;
                }

                if (yml.listeners[0].query_port !== self.serverConfig.gameport) {
                    yml.listeners[0].query_port = self.serverConfig.gameport;
                    rewrite = true;
                }

                if (yml.listeners[0].host !== Util.format('0.0.0.0:%s', self.serverConfig.gameport)) {
                    yml.listeners[0].host = Util.format('0.0.0.0:%s', self.serverConfig.gameport);
                    rewrite = true;
                }
            }

            // Allow only ONE listener per Bungee Instance
            for (var index in yml.listeners) {
                if (index > 0) {
                    rewrite = true;
                    yml.listeners[index] = undefined;
                }
            }

            if (rewrite === true) {
                Fs.writeFileSync(configPath, Yaml.safeDump(yml));
            }

            Logger.verbose('Completed plugin preflight for ' + self.serverConfig.name);
            return next();
        } catch (ex) {
            Logger.error('An uncaught error occured trying to update ' + self.settings.cfg + ' for ' + self.serverConfig.name, ex.stack);
            return next(ex.stack);
        }
    } else {
        // We need to make a very simple config.yml file in here
        Logger.warn('Completed plugin preflight for ' + self.serverConfig.name + ' but we need to restart the server right after because the config.yml file isn\'t generated yet.');
        return next(null, 1);
    }
};

module.exports = Plugin;
