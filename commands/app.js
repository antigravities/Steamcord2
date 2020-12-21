function formatStorage(value){
    return  (value > 1000 ? Math.round(value/100)/10 + " GB" : Math.round(value) + " MB");
}

module.exports = pkg => {
    if (pkg.args.length < 2) return "Please specify an AppID to fetch info for.";

    pkg.steam.getProductInfo([parseInt(pkg.args[1])], [], true, async (err, apps, packages) => {
        if (err) return pkg.message.channel.send("Error retrieving package information: " + err);

        if (!apps[pkg.args[1]]) {
            return pkg.message.channel.send("Could not find info for " + pkg.args[1] + ". Is it public, or do you own it?");
        }

        let app = apps[pkg.args[1]];

        if (!app.appinfo) {
            return pkg.message.channel.send("Could not find info for " + pkg.args[1] + ": Steam didn't send us any");
        }

        let embed = {};

        embed.title = (app.appinfo && app.appinfo.common && app.appinfo.common.name) ? app.appinfo.common.name : "App " + pkg.args[1];
        embed.url = "https://store.steampowered.com/app/" + pkg.args[1];

        if (!app.appinfo.common) {
            embed.description = "App is private or does not exist.";
            if (app.missingToken) embed.description += " If you acquire an entitlement for this app (i.e. via a CD-key), you may be able to see more information.";
        } else {
            embed.description = app.appinfo.common.type ? (app.appinfo.common.type[0].toUpperCase() + app.appinfo.common.type.substring(1) + ", ") : "Unknown, ";
            embed.description += (app.appinfo.common.releasestate || app.appinfo.common.releasestatesteamchina) ? (app.appinfo.common.releasestate || app.appinfo.common.releasestatesteamchina) : "unavailable";

            if ( ( ( ( app.appinfo.common.releasestate && app.appinfo.common.releasestate == "released" ) || (app.appinfo.common.releasestatesteamchina && app.appinfo.common.releasestatesteamchina == "released" ) ) || ( app.appinfo.state && app.appinfo.state.toLower().startsWith("estateavailable") ) ) && app.appinfo.common.steam_release_date) {
                embed.description += " " + pkg.util.formatDate(new Date(app.appinfo.common.steam_release_date * 1000));
            }

            embed.thumbnail = {
                url: "https://cdn.cloudflare.steamstatic.com/steam/apps/" + pkg.args[1] + "/header.jpg?t=" + Math.floor((Date.now() / 1000))
            }
        }

        embed.description += (app.appinfo.extended && app.appinfo.extended.developer ? "\nDeveloper: [" + app.appinfo.extended.developer + "](https://store.steampowered.com/search/?developer=" + encodeURIComponent(app.appinfo.extended.developer) + ")" : "");
        embed.description += (app.appinfo.extended && app.appinfo.extended.publisher ? "\nPublisher: [" + app.appinfo.extended.publisher + "](https://store.steampowered.com/search/?publisher=" + encodeURIComponent(app.appinfo.extended.publisher) + ")" : "");

        embed.description += (app.changenumber ? "\nLast updated as part of changelist [" + app.changenumber + "](https://steamdb.info/changelist/" + app.changenumber + ")" : "");

        let depotSize = app.appinfo.depots ? Math.round(Object.keys(app.appinfo.depots).map(i => app.appinfo.depots[i].maxsize || 0).map(i => parseInt(i)).reduce((p, c) => p += c)/1000000) : 0;
        if( depotSize > 0 ){
            embed.description += "\n" + Object.keys(app.appinfo.depots).filter(i => ! isNaN(parseInt(i))).length + " depot(s) totaling " + formatStorage(depotSize);

            let os = {
                windows: 0,
                macos: 0,
                linux: 0
            };

            let osSpecific = {
                windows: 0,
                macos: 0,
                linux: 0
            };

            let notOSSpecific = 0;

            for( let depot of Object.keys(app.appinfo.depots).filter(i => ! isNaN(parseInt(i))).map(i => app.appinfo.depots[i]) ){
                if( ! depot.config || ! depot.config.oslist ) notOSSpecific++;

                for( let i of Object.keys(os) ){
                    if( depot.maxsize && ( ( depot.config && depot.config.oslist && ( depot.config.oslist.split(",").indexOf(i) > -1 || depot.config.oslist.split(",").length == 0 ) ) || ! depot.config || ! depot.config.oslist ) ) {
                        os[i] += parseInt(depot.maxsize)/1000000;

                        if( depot.config && depot.config.oslist ) osSpecific[i]++;
                    }
                }
            }

            embed.description += " (" + Object.keys(os).filter(i => osSpecific[i] > 0).map(i => i + ": " + (osSpecific[i]+notOSSpecific) + " depot(s), " + formatStorage(os[i])).join("; ") + ")";
        }

        embed.description += "\n";

        embed.description += (pkg.steam.ownsApp(pkg.args[1]) ? "\n\u2705 You own this" : "");

        embed.description += (app.appinfo.common && app.appinfo.common.steamchinaapproved && app.appinfo.common.steamchinaapproved) ? "\n\uD83C\uDDE8\uD83C\uDDF3 Approved for Steam China" : "";

        embed.description += "\n\n[SteamDB](https://steamdb.info/app/" + pkg.args[1] + ") • [Barter.vg](https://barter.vg/steam/app/" + pkg.args[1] + ")";

        return pkg.message.channel.send("", { embed });
    });
}