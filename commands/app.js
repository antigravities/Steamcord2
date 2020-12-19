module.exports = pkg => {
    if( pkg.args.length < 2 ) return "Please specify an AppID to fetch info for.";
  
    pkg.steam.getProductInfo([ parseInt(pkg.args[1]) ], [], true, async (err, apps, packages) => {
      if( err ) return pkg.message.channel.send("Error retrieving package information: " + err);
  
      if( ! apps[pkg.args[1]] ){
        return pkg.message.channel.send("Could not find info for " + pkg.args[1] + ". Is it public, or do you own it?");
      }
  
      let app = apps[pkg.args[1]];
  
      if( ! app.appinfo ){
        return pkg.message.channel.send("Could not find info for " + pkg.args[1] + ": Steam didn't send us any");
      }
  
      let embed = {};
  
      embed.title = (app.appinfo && app.appinfo.common && app.appinfo.common.name) ? app.appinfo.common.name : "App " + pkg.args[1];
      embed.url = "https://store.steampowered.com/app/" + pkg.args[1];
  
      if( ! app.appinfo.common ){
        embed.description = "App is private or does not exist.";
        if( app.missingToken ) embed.description += " If you acquire an entitlement for this app, you may be able to see more information.";
      } else {
        embed.description = app.appinfo.common.type ? (app.appinfo.common.type + ", ") : "Unknown, ";
        embed.description += app.appinfo.common.releasestate ? app.appinfo.common.releasestate : "unavailable";
  
        if( app.appinfo.common.releasestate && app.appinfo.common.releasestate == "released" && app.appinfo.common.steam_release_date ){
          embed.description += " " + pkg.util.formatDate(new Date(app.appinfo.common.steam_release_date * 1000));
        }
  
        embed.thumbnail = {
          url: "https://cdn.cloudflare.steamstatic.com/steam/apps/" + pkg.args[1] + "/header.jpg?t=" + Math.floor((Date.now()/1000))
        }
      }
  
      embed.description += (app.changenumber ? "\nLast updated as part of changelist [" + app.changenumber + "](https://steamdb.info/changelist/" + app.changenumber + ")" : "");
  
      return pkg.message.channel.send("", { embed });
    });
  }