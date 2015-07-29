function Preflight(rootPath, publicPath, config, callback) {
    this.rootPath = rootPath;
    this.publicPath = publicPath;
    this.config = config;
    this.callback = callback;
}

Preflight.prototype.getRootPath = function() {
    return this.rootPath;
}

Preflight.prototype.getPublicPath = function() {
    return this.publicPath;
}

Preflight.prototype.getConfig = function() {
    return this.config;
}

Preflight.prototype.getCallBack = function() {
    return this.callback;
}

module.exports = Preflight;