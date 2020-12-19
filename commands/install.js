module.exports = async pkg => {
    if (pkg.args.length < 2) return "Please specify an AppID to install.";

    pkg.steam.getProductInfo([parseInt(pkg.args[1])], [], true, async (err, apps, packages) => {
        if (err) return pkg.message.channel.send("Error retrieving package information: " + err);

        if (!apps[pkg.args[1]]) {
            return pkg.message.channel.send("Could not find info for " + pkg.args[1] + ". Is it public, or do you own it?");
        }

        await pkg.util.awaitWebLogon();

        let community = pkg.util.makeOrGetCommunity();
        community.httpRequestPost("https://steamcommunity.com/remoteactions/modifyappstate", {
            form: {
                sessionid: pkg.cache.sessionid,
                appid: pkg.args[1],
                operation: "install"
            }
        }, async (err, res) => {
            if (err) return pkg.message.channel.send("Error downloading app: " + err);

            let json = JSON.parse(res.body);

            if (!json.success) return pkg.message.channel.send("Download not successful. Ensure your login details are correct and that you own the app you want to download.");

            await pkg.message.channel.send("Downloading " + (apps[pkg.args[1]] && apps[pkg.args[1]].appinfo && apps[pkg.args[1]].appinfo.common ? apps[pkg.args[1]].appinfo.common.name : "app " + pkg.args[1]) + ". You will be notified when the download is complete.");

            let interval = setInterval(async () => {
                await pkg.util.awaitWebLogon();

                community.httpRequestGet("https://steamcommunity.com/my/getchanging", {}, async (err, res) => {
                    if (err) {
                        await pkg.message.channel.send("Could not fetch status information: " + err + ". Your app may be downloaded. Check your client.");
                        clearInterval(interval);
                        return;
                    }

                    try {
                        let inf = /UpdateChangingGames\((.*)\)/.exec(res.body);
                        let sum = JSON.parse(inf[1]).summaries;

                        if (!sum[pkg.args[1]]) {
                            return;
                        }

                        if (sum[pkg.args[1]] && sum[pkg.args[1]].state == "installed") {
                            await pkg.message.channel.send("Installed! " + sum[pkg.args[1]].localContentSize + " downloaded.");
                            clearInterval(interval);
                            return;
                        }
                    } catch (e) {
                        await pkg.message.channel.send("Could not fetch status information: " + e + ". Your app may be downloaded. Check your client.");
                        clearInterval(interval);
                        return;
                    }
                })
            }, 15000);
        });
    });
}
