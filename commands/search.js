const Fuse = require("fuse.js");
const request = require("request");

let fuse;
let ready = false;

request("http://api.steampowered.com/ISteamApps/GetAppList/v0002/", (e, r, b) => {
    if( e ){
        console.log("Could not fetch app list: " + e);
        return;
    }

    let applist = JSON.parse(b).applist.apps;
    fuse = new Fuse(applist, { keys: [ 'appid', 'name' ], shouldSort: true, minMatchCharLength: 2, threshold: 0.3 });
    ready = true;
});

module.exports = pkg => {
    if( ! ready ) return "One moment please, building search engine...";
    if( pkg.args.length < 2 ) return "Please specify a search query.";

    pkg.args.shift();
    
    let res = fuse.search(pkg.args.join(" "));

    if( res.length == 0 ) return "Found no results.";
    return ("Found " + res.length + " results:\n" + res.slice(0, 15).map(i => i.item.name + " (" + i.item.appid + ")").join("\n")).substring(0, 2000);
}