module.exports = {};

module.exports.unknown = () => {
  return "Unknown command.";
};

module.exports["2fa"] = pkg => {
  if( ! pkg.cache.needs2FA ) return "I don't need a 2FA token right now.";
  if( pkg.args.length < 2 ) return "Please specify the 2FA token.";

  pkg.cache.needs2FA(pkg.args[1]);
};

module.exports.create = async pkg => {
  if( pkg.args.length < 2 ) return "Please specify a SteamID64 to create a channel for.";
  let chan = await pkg.util.createOrGetFriendChat(pkg.args[1]);
  return "Created channel <#" + chan.chan.id + ">. Rename or reorganize it however you'd like.";
};

module.exports.delete = async pkg => {
  let soft = pkg.args.length > 1 && pkg.args[1] == "soft";

  let chans = pkg.database.get("chats", {});

  let link = pkg.util.getSteamIDFromChan(pkg.message.channel);

  if( ! link ) return "This channel is not linked to a chat.";

  if( ! soft ) await pkg.message.channel.delete( );

  delete chans[link];

  if( soft ) {
    (await pkg.message.channel.send("This channel has been soft-deleted and is unlinked from Steamcord. Messages sent here will not reach the other party.")).pin();
  }

  pkg.database.set("chats", chans);
};

module.exports.feed = pkg => {
  if( pkg.args.length < 2 ) return "Please specify a feed to assign.";

  if( ! pkg.database.get("feeds", false) ) pkg.database.set("feeds", {});

  let cfeeds = pkg.database.get("feeds");
  cfeeds[pkg.args[1]] = pkg.message.channel.id;
  pkg.database.set("feeds", cfeeds);

  return "Set <#" + pkg.message.channel.id + "> as the location for `" + pkg.args[1] + "` messages.";
};

module.exports.unfeed = pkg => {
  if( pkg.args.length < 2 ) return "Please specify a feed to unassign.";

  if( ! pkg.database.get("feeds", false) ) pkg.database.set("feeds", {});

  let cfeeds = pkg.database.get("feeds");
  delete cfeeds[pkg.args[1]];
  pkg.database.set("feeds", cfeeds);

  return "Unlinked feed `" + pkg.args[1] + "`.";
};

module.exports.notifications = pkg => {
  pkg.database.set("notification", pkg.message.channel.id);
  pkg.database.set("notification_message", false);
  pkg.util.updateNotificationMessages("a", 0);
};

module.exports.help = pkg => {
  return "Commands: " + Object.keys(module.exports).join(", ");
};

module.exports.friends = async pkg => {
  if( pkg.database.get("friendchan", false) ){
    pkg.database.set("friendchan", false);
    pkg.database.set("friendmsg", false);
    return "Disabled friend list.";
  } else {
    pkg.database.set("friendchan", pkg.message.channel.id);
    pkg.database.set("friendmsg", (await pkg.message.channel.send("", { embed: { description: "Please wait..." } })).id);
  }
};

module.exports.offers = pkg => {
  if( pkg.database.get("offers", false) ){
    pkg.database.set("offers", false);
    return "Disabled offer notifications.";
  } else {
    pkg.database.set("offers", pkg.message.channel.id);
    return "Offer notifications will be sent to <#" + pkg.message.channel.id + ">.";
  }
};

module.exports.logon = pkg => {
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

module.exports.ping = async pkg => {
  let msg = await pkg.message.channel.send("", { embed: { title: "Pong! 🏓" } });
  msg.edit("", { embed: { title: "Pong! 🏓", description: "Message received and responded to in " + (Date.now() - pkg.rcv) + "ms." } });
}

module.exports.add = async pkg => {
  if( pkg.args.length < 2 ) return "Please specify a friend to add.";
  pkg.steam.addFriend(pkg.args[1]);
  return "Sent a friend invite to or accepted a friend invite from <https://steamcommunity.com/profiles/" + pkg.args[1] + ">";
}

module.exports.app = pkg => {
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

module.exports.install = async pkg => {
  if( pkg.args.length < 2 ) return "Please specify an AppID to install.";
  
  pkg.steam.getProductInfo([ parseInt(pkg.args[1]) ], [], true, async (err, apps, packages) => {
    if( err ) return pkg.message.channel.send("Error retrieving package information: " + err);

    if( ! apps[pkg.args[1]] ){
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
      if( err ) return pkg.message.channel.send("Error downloading app: " + err);
      
      let json = JSON.parse(res.body);

      if( ! json.success ) return pkg.message.channel.send("Download not successful. Ensure your login details are correct and that you own the app you want to download.");

      await pkg.message.channel.send("Downloading " + (apps[pkg.args[1]] && apps[pkg.args[1]].appinfo && apps[pkg.args[1]].appinfo.common ? apps[pkg.args[1]].appinfo.common.name : "app " + pkg.args[1]) + ". You will be notified when the download is complete.");

      let interval = setInterval(async () => {
        await pkg.util.awaitWebLogon();

        community.httpRequestGet("https://steamcommunity.com/my/getchanging", {}, async (err, res) => {
          if( err ){
            await pkg.message.channel.send("Could not fetch status information: " + err + ". Your app may be downloaded. Check your client.");
            clearInterval(interval);
            return;
          }

          try {
            let inf = /UpdateChangingGames\((.*)\)/.exec(res.body);
            let sum = JSON.parse(inf[1]).summaries;

            if( ! sum[pkg.args[1]] ){
              return;
            }

            if( sum[pkg.args[1]] && sum[pkg.args[1]].state == "installed" ) {
              await pkg.message.channel.send("Installed! " + sum[pkg.args[1]].localContentSize + " downloaded.");
              clearInterval(interval);
              return;
            }
          } catch(e){
            await pkg.message.channel.send("Could not fetch status information: " + e + ". Your app may be downloaded. Check your client.");
            clearInterval(interval);
            return;
          }
        })
      }, 15000);
    });
  });
}

module.exports.redeem = async pkg => {
  if( pkg.args.length < 2 ) return "Specify the keys you want to redeem separated by a space.";

  pkg.args.shift();

  let resp = "";

  for( let arg of pkg.args ){
    try {
      await new Promise((resolve, reject) => {
        pkg.steam.redeemKey(arg, (err, purchaseResultDetails, packageList) => {
          if( err ) {
            if( ! err.purchaseResultDetails || ! err.packageList ) return reject(err);

            if( err.purchaseResultDetails ) purchaseResultDetails = err.purchaseResultDetails;
            if( err.packageList ) packageList = err.packageList;
          }

          if( purchaseResultDetails == pkg.Steam.EPurchaseResult.RateLimited ){
            return reject(err);
          }

          resp += "Key: " + arg + " | Response: " + pkg.util.resolveEnum(pkg.Steam.EPurchaseResult, purchaseResultDetails) + " | Packages: " + Object.keys(packageList).map(i => packageList[i] + " (" + i + ")").join(", ") + "\n";

          resolve();
        });
      });
    } catch(err){
      resp += "Error: " + (err.purchaseResultDetails ? pkg.util.resolveEnum(pkg.Steam.EPurchaseResult, err.purchaseResultDetails) : err.toString()) + "\n";
      break;
    }
  }

  await pkg.util.splitMsg((msg) => {
    pkg.message.channel.send(msg);
  }, resp);

}