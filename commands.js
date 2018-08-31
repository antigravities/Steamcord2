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

module.exports.friends = async pkg => {
  let names = [];
  let friendsByState = {};

  pkg.util.personaStates.forEach((i, j) => friendsByState[j] = []);

  friendsByState.push(friendsByState.shift()); // put "Offline" (0) last

  Object.keys(pkg.steam.myFriends).forEach(i => {
    if (pkg.steam.myFriends[i] !== pkg.Steam.EFriendRelationship.Friend) return;
    friendsByState[(pkg.steam.users[i] && pkg.steam.users[i].persona_state) ? pkg.steam.users[i].persona_state : 0].push((pkg.steam.users[i] ? pkg.steam.users[i].player_name.replace(new RegExp("_", "g"), "\\_") : i));
  });

  let embed = {};
  embed.fields = [];

  Object.keys(friendsByState).forEach(i => {
    let final = friendsByState[i].join(", ");

    if (final.length < 1024) final = [final];
    else {
      let comb = [];

      while (final.length > 0) {
        let sect = final.substring(0, 1024);
        comb.push(sect);
        final = final.slice(1024);
      }

      final = comb;
    }

    final.forEach((j, k) => {
      embed.fields.push({
        name: pkg.util.personaStates[i] + (k > 0 ? " (continued)" : ""),
        value: j.length === 0 ? "(none)" : j
      });
    });
  });

  pkg.message.channel.send("", { embed: embed });
}

module.exports.offers = pkg => {
  pkg.database.set("offers", pkg.message.channel.id);
  return "Offers will be sent to this channel.";
}