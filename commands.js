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