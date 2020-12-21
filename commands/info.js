module.exports = pkg => {
    return "Up " + (Date.now() - pkg.cache.uptime)/1000 + "s on " + require("os").hostname;
}