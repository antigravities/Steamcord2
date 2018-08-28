(async() => {
  const fs = require("fs");

  if (!fs.existsSync("config.json")) {
    fs.writeFileSync("config.json", JSON.stringify({
      discord: {
        token: "",
        guild: "",
        master: ""
      },
      steam: {
        accountName: "",
        password: ""
      }
    }, null, 2));

    console.log("A sample configuration file has been written to config.json. Please edit it and run this again.");

    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync("config.json"));

  const Steam = require("steam-user");
  const Discord = require("discord.js");

  const discord = new Discord.Client();
  const steam = new Steam({ promptSteamGuardCode: false });

  const Commands = require("./commands.js");

  // -----------

  let cache = {};
  cache.loggedOn = false;
  cache.needs2FA = false;
  cache.discordReady = false;
  cache.steamReady = false;
  cache.typing = {};

  // -----------

  if (!fs.existsSync("database.json")) fs.writeFileSync("database.json", "{}");

  let database = JSON.parse(fs.readFileSync("database.json"));

  database.set = (item, value) => {
    database[item] = value;
    fs.writeFileSync("database.json", JSON.stringify(database));
  };
  database.get = (item, def = undefined) => {
    return database[item] || def;
  };

  // -----------

  let util = {};

  util.feedCache = [];
  util.sendToFeed = (feed, message) => {
    util.feedCache.push({ feed: feed, message: message });
  };

  setInterval(() => {
    if (!cache.discordReady) return;
    if (util.feedCache.length < 1) return;

    let item = util.feedCache.pop();

    if (database.get("feeds")[item.feed]) {
      discord.channels.get(database.get("feeds")[item.feed]).send(item.message);
    }
  }, 5000);

  util.waitUntilDiscordBack = () => {
    return new Promise(resolve => {
      if (cache.discordReady && cache.mGuild.available) return resolve();

      let int = setInterval(() => {
        if (!cache.discordReady || !cache.mGuild.available) return;

        clearInterval(int);
        resolve();

        return this;
      }, 1000);
    });
  };

  util.hasFriendChat = async steamid => {
    await util.waitUntilDiscordBack();

    if (!database.get("chats", false)) database.set("chats", {});

    let chats = database.get("chats");

    return chats[steamid] ? false : chats[steamid];
  }

  util.createOrGetFriendChat = async steamid => {
    await util.waitUntilDiscordBack();

    if (!database.get("chats", false)) database.set("chats", {});

    let chats = database.get("chats");

    if (chats[steamid]) {
      return {
        chan: discord.channels.get(chats[steamid].chan),
        hook: new Discord.WebhookClient(chats[steamid].hook.id, chats[steamid].hook.token)
      };
    }

    let chan = await cache.mGuild.createChannel(steamid);
    let hook = await chan.createWebhook("Steamcord");

    chats[steamid] = {
      chan: chan.id,
      hook: { id: hook.id, token: hook.token }
    };

    database.set("chats", chats);

    return { chan: chan, hook: hook };
  };

  util.getSteamIDFromChan = channel => {
    let chats = database.get("chats", {});
    let keys = Object.keys(chats);

    for (let i = 0; i < keys.length; i++) {
      if (chats[keys[i]].chan === channel.id) return keys[i];
    }

    return false;
  }

  util.sendFromFriend = async(steamid, message) => {
    let chan = await util.createOrGetFriendChat(steamid);
    if (cache.typing[steamid]) {
      clearTimeout(cache.typing[steamid]);
      chan.chan.stopTyping();
    }

    let emoticons = message.match(new RegExp("ː[A-Za-z0-9]*ː", "g"));

    if (emoticons && emoticons.length > 0) {
      for (let i = 0; i < emoticons.length; i++) {
        let name = emoticons[i].slice(1, -1);

        let emoji = cache.mGuild.emojis.find(x => x.name === name);

        if (!emoji) {
          if (cache.mGuild.emojis.array().length < 50) {
            for (let i = 0; i < emoticons.length; i++) {
              emoji = await cache.mGuild.createEmoji("https://steamcommunity-a.akamaihd.net/economy/emoticonlarge/" + name, name);

              message = message.replace(new RegExp("ː" + name + "ː", "g"), emoji.toString());
            }
          }
        }
        else {
          message = message.replace(new RegExp("ː" + name + "ː", "g"), emoji.toString());
        }
      }
    }

    return await chan.hook.send(message, { username: steam.users[steamid].player_name, avatarURL: steam.users[steamid].avatar_url_full });
  }

  util.notifications = {
    items: 0,
    comments: 0,
    invites: 0,
    offers: 0,
    community: 0,
    offline: 0
  }

  util.updateNotificationMessages = async(type, count) => {
    if (!database.get("notification", false)) return;

    let message;
    let mid = database.get("notification_message", false);
    let chan = await discord.channels.get(database.get("notification"));

    if (!mid) {
      message = await chan.send("", { embed: { title: "Steam Notifications", description: "Please wait..." } });
      database.set("notification_message", message.id);
    }
    else {
      message = (await chan.fetchMessages({ around: mid, limit: 1 })).get(mid);
    }

    util.notifications[type] = count;

    await message.edit("", {
      embed: {
        title: "Steam Notifications",
        description: (
          (util.notifications.comments > 0 ? "[" + util.notifications.comments + " new comments](https://steamcommunity.com/my/commentnotifications)\n" : "") +
          (util.notifications.items > 0 ? "[" + util.notifications.items + " new items](https://steamcommunity.com/my/inventory)\n" : "") +
          (util.notifications.invites > 0 ? "[" + util.notifications.invites + " new invites](https://steamcommunity.com/my/home/invites)\n" : "") +
          (util.notifications.offers > 0 ? "[" + util.notifications.offers + " new trade offers](https://steamcommunity.com/my/tradeoffers)\n" : "") +
          (util.notifications.offline > 0 ? util.notifications.offline + " unread messages\n" : "") +
          (util.notifications.community > 0 ? util.notifications.community + " community moderation messages" : "")
        )
      }
    });
  };

  // -----------

  discord.on("ready", () => {
    cache.discordReady = true;

    cache.mGuild = discord.guilds.get(config.discord.guild);

    util.sendToFeed("debug", "Connected to Discord.");

    if (!cache.loggedOn) {
      steam.logOn(config.steam);
    }
  });

  setInterval(async() => {
    if (!cache.discordReady) return;
    util.sendToFeed("debug", "polling status");

    let master = await cache.mGuild.members.get(config.discord.master);

    if (master.presence) {
      if (master.game) {
        steam.gamesPlayed(master.game.name);
      }
      else {
        steam.gamesPlayed(0);
      }

      let nick = master.displayName;

      switch (master.presence.status) {
      case "dnd":
        steam.setPersona(Steam.EPersonaState.Busy, nick);
        break;
      case "online":
        steam.setPersona(Steam.EPersonaState.Online, nick);
        break;
      case "idle":
        steam.setPersona(Steam.EPersonaState.Away, nick);
        break;
      case "offline":
        steam.setPersona(Steam.EPersonaState.Snooze, nick);
        break;
      default:
        steam.setPersona(Steam.EPersonaState.Online, nick);
      }
    }
  }, 5000);

  discord.on("message", async message => {
    message.reply = function (message) {
      this.channel.send(message);
    };

    if (message.author.bot) return;

    if (message.guild === null) {
      return message.reply("I can only be communicated with in my assigned guild.");
    }

    if (message.author.id != config.discord.master) {
      return message.reply("Only my master can communicate with me.");
    }

    if (message.content[0] === "~") {
      let command = message.content.slice(1).split(" ");

      let pkg = {
        message: message,
        discord: discord,
        steam: steam,
        args: command,
        database: database,
        cache: cache,
        util: util
      };

      let response = Commands[command[0]] ? (await Commands[command[0]](pkg)) : (await Commands.unknown(pkg));

      if (typeof response === 'string') message.reply(response);
    }
    else {
      let steamid = util.getSteamIDFromChan(message.channel);

      if (steamid === false) return;
      else {
        steam.chatMessage(steamid, message.content.replace(/\<\:([A-Za-z0-9]*)\:\d*\>/g, ":$1:"));
      }
    }
  });

  discord.on("channelCreate", channel => {
    channel.send("", { embed: { title: "Never tell your password to anyone.", url: "https://support.steampowered.com/kb_article.php?p_faqid=301", description: "Click [here](https://support.steampowered.com/kb_article.php?p_faqid=301) for more account security recommendations.", footer: "Only you can see this" } });
  });

  discord.on("typingStart", (channel, user) => {
    if (user.id !== config.discord.master) return;

    let steamid = util.getSteamIDFromChan(channel);
    if (steamid) steam.chatTyping(steamid);
  });

  // -----------

  steam.on("steamGuard", (domain, callback) => {
    cache.needs2FA = callback;
    util.sendToFeed("connect", "Please enter your Steam Guard code " + (domain ? "that was sent to your e-mail address at " + domain : "from your Mobile Authenticator") + " by typing ~2fa [code].");
  });

  steam.on("loggedOn", () => {
    cache.needs2FA = false;
    cache.steamReady = true;

    util.sendToFeed("debug", "Connected to Steam.");
  });

  steam.on("disconnected", () => {
    cache.steamReady = false;

    util.sendToFeed("debug", "Disconnected from Steam.");
  });

  steam.on("friendMessage", (steamid, message) => {
    util.sendFromFriend(steamid.toString(), message);
  });

  steam.on("friendTyping", async steamid => {
    if (util.hasFriendChat(steamid) && !cache.typing[steamid]) {

      let chan = (await util.createOrGetFriendChat(steamid));

      chan.chan.startTyping();

      cache.typing[steamid] = setTimeout(() => {
        chan.chan.stopTyping();
      }, 30000);
    }
  });

  steam.on("newItems", count => util.updateNotificationMessages("items", count));
  steam.on("newComments", count => util.updateNotificationMessages("comments", count));
  steam.on("tradeOffers", count => util.updateNotificationMessages("offers", count));
  steam.on("communityMessages", count => util.updateNotificationMessages("community", count));
  steam.on("offlineMessages", count => util.updateNotificationMessages("offline", count));

  steam.on("friendRelationship", (steamid, relationship) => {
    let status;

    if (relationship === Steam.EFriendRelationship.None) status = "removed";
    else if (relationship === Steam.EFriendRelationship.Blocked) status = "blocked";
    else if (relationship === Steam.EFriendRelationship.Friend || relationship === Steam.EFriendRelationship.RequestRecipient) status = "added";
    else status = "(unknown, " + relationship + ")";

    if (status === "") return;

    util.sendToFeed("relationship", (steam.users[steamid] ? (steam.users[steamid].player_name) : steamid) + " " + status + " you.");
  });

  // -----------

  discord.login(config.discord.token);
})();
