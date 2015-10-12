/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 *
 * minecraft.js — Adds Minecraft Server support to Scales.js
 */
var Fs = require('fs-extra');
var Rfr = require('rfr');
var Path = require('path');
var Logger = Rfr('lib/logger.js');
var Properties = require('properties');
var Gamedig = require('gamedig');

/**
 * Establishes the plguin function and makes constants avaliable across the entire function.
 * @param {object} preflight new Preflight();
 */
var Plugin = function (root, public, config) {

    this.serverConfig = config;
    this.rootPath = root;
    this.publicPath = public;

    this.settings = {
        name: 'Minecraft',
        stop: 'stop',
        exe: 'java',
        pgrep_exe: 'java',
        cfg: 'server.properties',
        trigger: {
            started: ')! For help, type ',
            eula: 'Go to eula.txt for more info.'
        },
        install_script: 'minecraft_install.sh',
        log: 'logs/latest.log',
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
Plugin.prototype.queryServer = function () {

    var self = this;

    Gamedig.query({
        type: 'minecraftping',
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

    var self = this;
    propertiesPath = Path.join(this.publicPath, this.settings.cfg);

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

    if (Fs.existsSync(propertiesPath)) {
        try {

            var rewrite = false;
            Properties.parse(propertiesPath, { path: true }, function (err, obj) {

                if (err) {

                    Logger.error('An error occured while attempting to read the server.properties file for ' + this.serverConfig.name, err);
                    return next('An error occured while attempting to read the server.properties file.');
                }

                if (obj['enable-query'] !== 'true') {
                    obj['enable-query'] = 'true';
                    rewrite = true;
                }

                // Docker opens this port for the server internally.
                // We bind to an external port when running docker, for the sake of this plugin
                //         we should be binding to the default container port that is exposed.
                if (obj['server-port'] !== self.settings.ports.listen) {
                    obj['server-port'] = self.settings.ports.listen;
                    rewrite = true;
                }

                if (obj['query.port'] !== self.settings.ports.listen) {
                    obj['query.port'] = self.settings.ports.listen;
                    rewrite = true;
                }

                if (rewrite) {

                    Properties.stringify(obj, { path: propertiesPath }, function (err, object) {

                        if (err) {

                            Logger.error('An error occured trying to update the ' + self.settings.cfg + ' file for ' + self.serverConfig.name, err);
                            return next('An error occured trying to update the ' + self.settings.cfg + ' file');
                        }

                        Logger.verbose('Completed plugin preflight for ' + self.serverConfig.name);
                        return next();

                    });

                }

            });

        } catch (ex) {

            Logger.error('An uncaught error occured trying to update server.properties for ' + this.serverConfig.name, ex.stack);
            return next('An exception occured attempting to check and update the server.properties file.');
        }

    } else {

        Logger.warn('Completed plugin preflight for ' + this.serverConfig.name + ' but we need to restart the server right after because the server.properties file isn\'t generated yet.');
        return next(null, 1);
    }

};


module.exports = Plugin;
