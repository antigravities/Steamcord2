module.exports = pkg => {
    (async () => {
        try {
            await pkg.steam.logOn(pkg.config.steam);
        } catch (e) {
            console.log(e);
            return pkg.util.sendToFeed("connect", { title: "Steam error", description: e.toString().substring(0, 512) + "\n\nAttempt to log on again by typing ~logon." });
        }
    });
    return "Logging on...";
}