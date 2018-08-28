module.exports = {};

module.exports.unknown = () => {
  return "Unknown command.";
};

module.exports["2fa"] = pkg => {
  if (!pkg.cache.needs2FA) return "I don't need a 2FA token right now.";
  if (pkg.args.length < 2) return "Please specify the 2FA token.";

  pkg.cache.needs2FA(pkg.args[1]);
};

module.exports.create = async pkg => {
  if (pkg.args.length < 2) return "Please specify a SteamID64 to create a channel for.";
  let chan = await pkg.util.createOrGetFriendChat(pkg.args[1]);
  return "Created channel <#" + chan.chan.id + ">. Rename or reorganize it however you'd like.";
};

module.exports.delete = async pkg => {
  let soft = pkg.args.length > 1 && pkg.args[1] == "soft";

  let chans = pkg.database.get("chats", {});

  let link = pkg.util.getSteamIDFromChan(pkg.message.channel);

  if (!link) return "This channel is not linked to a chat.";

  if (!soft) await pkg.message.channel.delete();

  delete chans[link];

  if (soft) {
    (await pkg.message.channel.send("This channel has been soft-deleted and is unlinked from Steamcord. Messages sent here will not reach the other party.")).pin();
  }

  pkg.database.set("chats", chans);
};

module.exports.feed = pkg => {
  if (pkg.args.length < 2) return "Please specify a feed to assign.";

  if (!pkg.database.get("feeds", false)) pkg.database.set("feeds", {});

  let cfeeds = pkg.database.get("feeds");
  cfeeds[pkg.args[1]] = pkg.message.channel.id;
  pkg.database.set("feeds", cfeeds);

  return "Set <#" + pkg.message.channel.id + "> as the location for `" + pkg.args[1] + "` messages.";
};

module.exports.unfeed = pkg => {
  if (pkg.args.length < 2) return "Please specify a feed to unassign.";

  if (!pkg.database.get("feeds", false)) pkg.database.set("feeds", {});

  let cfeeds = pkg.database.get("feeds");
  delete cfeeds[pkg.args[1]];
  pkg.database.set("feeds", cfeeds);

  return "Unlinked feed `" + pkg.args[1] + "`.";
}

module.exports.notifications = pkg => {
  pkg.database.set("notification", pkg.message.channel.id);
  pkg.util.updateNotificationMessages("a", 0);
}

module.exports.help = pkg => {
  return "Commands: " + Object.keys(module.exports).join(", ");
}
