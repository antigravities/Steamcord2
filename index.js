(async () => {
  const fs = require("fs");

  if( ! fs.existsSync("config.json") ){
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
  const TradeOffers = require("steam-tradeoffer-manager");

  const discord = new Discord.Client();
  const steam = new Steam({ promptSteamGuardCode: false });

  const Commands = require("./commands.js");


  // -----------

  let cache = {};
  cache.loggedOn = false;
  cache.needs2FA = false;
  cache.discordReady = false;
  cache.steamReady = false;
  cache.webLoggingOn = false;
  cache.typing = {};
  cache.poffers = [];
  cache.aoffers = [];
  cache.feedLastMessages = {};

  // -----------

  if( ! fs.existsSync("database.json") ) fs.writeFileSync("database.json", "{}");

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

  setInterval(async () => {
    if( ! cache.discordReady ) return;
    if( util.feedCache.length < 1 ) return;

    let item = util.feedCache.shift();

    if( database.get("feeds", {})[item.feed] ){
      if( typeof item.message === "string" ){
        cache.feedLastMessages[item.feed] = await discord.channels.get(database.get("feeds")[item.feed]).send(item.message);
      }
      else {
        cache.feedLastMessages[item.feed] = await discord.channels.get(database.get("feeds")[item.feed]).send("", { embed: item.message });
      }
    }
  }, 1000);

  util.waitUntilDiscordBack = () => {
    return new Promise(resolve => {
      if( cache.discordReady && cache.mGuild.available ) return resolve( );

      let int = setInterval(() => {
        if( ! cache.discordReady || ! cache.mGuild.available ) return;

        clearInterval(int);
        resolve();

        return this;
      }, 1000);
    });
  };

  util.hasFriendChat = async steamid => {
    await util.waitUntilDiscordBack();

    if( ! database.get("chats", false) ) database.set("chats", {});

    let chats = database.get("chats");

    return chats[steamid] ? false : chats[steamid];
  };

  util.createOrGetFriendChat = async steamid => {
    await util.waitUntilDiscordBack();

    if( ! database.get("chats", false) ) database.set("chats", {});

    let chats = database.get("chats");

    if( chats[steamid] ){
      return {
        chan: discord.channels.get(chats[steamid].chan),
        hook: new Discord.WebhookClient(chats[steamid].hook.id, chats[steamid].hook.token)
      };
    }

    steamid = steamid.toString();

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

    for(let i = 0; i < keys.length; i++){
      if( chats[keys[i]].chan === channel.id ) return keys[i];
    }

    return false;
  };

  util.sendFromFriend = async (steamid, message) => {
    let chan = await util.createOrGetFriendChat(steamid);
    if( cache.typing[steamid] ){
      clearTimeout(cache.typing[steamid]);
      chan.chan.stopTyping();
    }

    let emoticons = message.match(new RegExp("ː[A-Za-z0-9]*ː", "g"));

    if( emoticons && emoticons.length > 0 ){
      for(let i = 0; i < emoticons.length; i++) {
        let name = emoticons[i].slice(1, -1);

        let emoji = cache.mGuild.emojis.find(x => x.name === name);

        if( ! emoji ){
          if( cache.mGuild.emojis.array().length < 50 ){
            for(let i = 0; i < emoticons.length; i++) {
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
  };

  util.notifications = {
    items: 0,
    comments: 0,
    invites: 0,
    offers: 0,
    community: 0,
    offline: 0
  };

  util.updateNotificationMessages = async (type, count) => {
    if( ! database.get("notification", false) ) return;

    let message;
    let mid = database.get("notification_message", false);
    let chan = await discord.channels.get(database.get("notification"));

    if( ! mid ) {
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

  util.personaStates = [ "Offline", "Online", "Busy", "Away", "Snooze", "Looking to Trade", "Looking to Play" ];
  util.personaOrbs = [ "⚫", "🔵", "🔴", "⚪", "⚪", "🔵", "🔵" ];
  util.relationshipIcons = [ "x", "x", "user_add", "heart", "", "x", "", "user_add" ];

  util.getFriendList = () => {
    let friendsByState = {};

    util.personaStates.forEach((i, j) => friendsByState[j] = []);

    Object.keys(steam.myFriends).forEach(i => {
      if( steam.myFriends[i] !== Steam.EFriendRelationship.Friend ) return;
      friendsByState[(steam.users[i] && steam.users[i].persona_state) ? steam.users[i].persona_state : 0].push((steam.users[i] ? steam.users[i].player_name.replace(new RegExp("_", "g"), "\\_") : i));
    });

    let embed = {};
    embed.fields = [];

    let states = Object.keys(friendsByState);
    states.push(states.shift());

    states.forEach(i => {
      let final = friendsByState[i].join(", ");

      if( final.length < 1024 ) final = [ final ];
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
          name: util.personaStates[i] + (k > 0 ? " (continued)" : ""),
          value: j.length === 0 ? "(none)" : j
        });
      });
    });

    return embed;
  };

  // because apparently we can get a web session before a client session?
  // I don't know anymore
  util.makeOrGetTradeoffers = () => {
    if( ! cache.tradeoffers ){
      cache.tradeoffers = new TradeOffers({
        steam: steam,
        domain: "steamcord.cutie.cafe",
        language: "en",
        pollInterval: 15000,
        pollData: database.get("tpoll", {})
      });
    }

    return cache.tradeoffers;
  };

  util.addIcon = (embed, name) => {
    if( ! embed.author ){
      embed.author = {};

      if( embed.title ){
        embed.author.name = embed.title;
        delete embed.title;
      }

      if( embed.url ){
        embed.author.url = embed.url;
        delete embed.url;
      }
    }

    embed.author.icon_url = "https://s3.cutie.cafe/steamcord2/" + name + ".png";
    return embed;
  }

  // -----------

  discord.on("ready", async () => {
    cache.discordReady = true;

    cache.mGuild = discord.guilds.get(config.discord.guild);

    util.sendToFeed("debug", "Connected to Discord.");

    if( ! cache.loggedOn ){
      steam.logOn(config.steam);
    }


    if( database.get("offers", false) ){
      let offers = Object.values(database.get("offerData", {}));

      // so that we get reactions
      offers.forEach(i => {
        discord.channels.get(database.get("offers")).fetchMessages({ around: i, limit: 1 });
      });
    }
  });

  setInterval(async () => {
    if( ! cache.discordReady ) return;
    util.sendToFeed("debug", "polling status");

    let master = await cache.mGuild.members.get(config.discord.master);

    if( master.presence ){
      if( master.presence.game ){
        steam.gamesPlayed(master.presence.game.name);
      }
      else {
        steam.gamesPlayed(0);
      }

      let nick = master.displayName;

      switch(master.presence.status){
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
    let rcv = Date.now();

    message.reply = function (message) {
      this.channel.send(message);
    };

    if( message.author.bot ) return;

    if( message.guild === null ){
      return message.reply("I can only be communicated with in my assigned guild.");
    }

    if( message.author.id != config.discord.master ){
      return message.reply("Only my master can communicate with me.");
    }

    if( message.content[0] === "~" ){
      let command = message.content.slice(1).split(" ");

      let pkg = {
        message: message,
        discord: discord,
        steam: steam,
        args: command,
        database: database,
        cache: cache,
        util: util,
        Steam: Steam,
        config: config,
        rcv: rcv
      };

      let response = Commands[command[0]] ? (await Commands[command[0]](pkg)) : (await Commands.unknown(pkg));

      if( typeof response === 'string' ) message.reply(response);
    } else {
      let steamid = util.getSteamIDFromChan(message.channel);

      if( steamid === false ) return;
      else {
        steam.chatMessage(steamid, message.content.replace(/\<\:([A-Za-z0-9]*)\:\d*\>/g, ":$1:"));
      }
    }
  });

  discord.on("channelCreate", channel => {
    if( typeof channel.send === "function" ) {
      channel.send("", { embed: util.addIcon({ title: "Never tell your password to anyone.", url: "https://support.steampowered.com/kb_article.php?p_faqid=301", description: "Click [here](https://support.steampowered.com/kb_article.php?p_faqid=301) for more account security recommendations.", footer: { text: "Only you can see this" } }, "tux") });
    }
  });

  discord.on("typingStart", (channel, user) => {
    if( user.id !== config.discord.master ) return;

    let steamid = util.getSteamIDFromChan(channel);
    if( steamid ) steam.chatTyping(steamid);
  });

  discord.on("messageReactionAdd", async (rxn, user) => {
    if( user.bot ) return;

    let offersdb = database.get("offerData", {});
    let offers = Object.keys(offersdb);

    for (let i = 0; i < offers.length; i++){
      if( offersdb[offers[i]] != rxn.message.id ) continue;

      if( ! cache.tradeoffers ){
        let embed = rxn.message.embeds[0];
        embed.title = "Waiting for trade offer session. Try again in a minute.";
        await rxn.message.edit("", { embed: embed });
      }

      cache.tradeoffers.getOffer(offers[i], async (err, offer) => {
        if( err ) rxn.remove();

        if( offer.state !== TradeOffers.ETradeOfferState.Active ) {
          //await rxn.remove();
          await rxn.message.edit("", {
            embed: {
              title: "Trade offer " + TradeOffers.ETradeOfferState[offer.state].toLowerCase(),
              description: "This trade offer can not be accepted or declined because it is no longer active."
            }
          });

          await rxn.message.clearReactions();

          delete offersdb[offers[i]];
        } else if( rxn.emoji.name === "✅" ){
          cache.aoffers.push([offer.id, rxn.message]);

          if( ! cache.webLoggingOn ){
            steam.webLogOn();
            cache.webLoggingOn = true;
          }

          delete offersdb[offers[i]];
        } else if( rxn.emoji.name === "❌" ){
          offer.decline(async err => {
            if( err ) return;

            let embed = new Discord.RichEmbed(rxn.message.embeds[0]);
            embed.setTitle("❌ Trade offer declined!");

            await rxn.message.edit("", { embed: embed });

            await rxn.message.clearReactions();
          });

          delete offersdb[offers[i]];
        }

        database.set("offerData", offersdb);
      });

      break;
    }
  });

  discord.on("error", err => {
    console.log(err);
    discord.login(config.discord.token);
  });

  // -----------

  steam.on("steamGuard", (domain, callback) => {
    cache.needs2FA = callback;
    discord.user.setActivity("Waiting for 2FA code");
    util.sendToFeed("connect", { title: "Waiting for 2FA code", description: "Please enter your Steam Guard code " + (domain ? "that was sent to your e-mail address at " + domain : "from your Mobile Authenticator") + " by typing ~2fa [code]." });
  });

  steam.on("loggedOn", async() => {
    discord.user.setActivity("Logged on to Steam");

    let tradeoffers = util.makeOrGetTradeoffers();

    if( cache.feedLastMessages.connect ) await cache.feedLastMessages.connect.edit("", { embed: { title: "2FA code accepted", description: "✅ Logged on!" } });

    cache.needs2FA = false;
    cache.steamReady = true;

    setInterval(() => {
      let chats = database.get("chats", {});

      Object.keys(chats).forEach((i, j) => {
        setTimeout(() => {
          let chan = discord.channels.get(chats[i].chan);
          chan.setTopic(util.personaOrbs[(steam.users[i] && steam.users[i].persona_state) ? steam.users[i].persona_state : 0] + " " + (steam.users[i] ? steam.users[i].player_name : i) + "\nhttps://steamcommunity.com/profiles/" + i);
        }, 2000 * j);
      });
    }, 30000);

    tradeoffers.on("pollData", data => {
      database.set("tpoll", data);
    });

    tradeoffers.on("newOffer", async offer => {
      if( ! database.get("offers", false) || offer.isGlitched() ) return;

      let data = database.get("offerData", {});

      if( data[offer.id] ) return;

      cache.poffers.push(offer);

      // force this every time so that we get a fresh session (unless we're already logging on)
      // apps like ASF like to get sessions randomly and screw us up
      if( ! cache.webLoggingOn ){
        steam.webLogOn();
        cache.webLoggingOn = true;
      }
    });

    setInterval(async () => {
      if( ! database.get("friendchan", false) ) return;

      let message = (await discord.channels.get(database.get("friendchan")).fetchMessages({ around: database.get("friendmsg"), limit: 1 })).first();

      message.edit("", { embed: util.getFriendList() });

    }, 15000);

    util.sendToFeed("debug", "Connected to Steam.");
  });

  steam.on("webSession", (sid, cookies) => {
    let tradeoffers = util.makeOrGetTradeoffers();

    tradeoffers.setCookies(cookies, err => {
      if( err ) return console.log("error getting api key");

      cache.webLoggingOn = false;

      let data = database.get("offerData", {});

      while (cache.poffers.length > 0) {
        // we shouldn't have more than a couple of offers at a time, so this should work
        // TODO: make this less garbaggio
        let offer = cache.poffers.shift();

        offer.getUserDetails(async(err, me, them) => {
          if( err ){
            them = {
              personaName: offer.partner.toString(),
              avatarFull: "https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/fe/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg",
              escrowDays: -1
            };
          }

          let escrowString = "";

          if( them.escrowDays === -1 ) escrowString = "Unable to obtain escrow information";
          else if( them.escrowDays > 0 ) escrowString = "This trade will be held for " + them.escrowDays + " days";

          let strs = [offer.itemsToGive, offer.itemsToReceive].map(i => {
            return i.map(j => {
              return (j.amount > 1 ? j.amount + " " : "") + j.name + " (" + j.type + ")";
            }).join(", ");
          });

          let msg = await discord.channels.get(database.get("offers")).send("", {
            embed: {
              title: them.personaName + " offered you a trade:",
              url: "https://steamcommunity.com/tradeoffer/" + offer.id,
              description: (escrowString.length > 0 ? escrowString + "\n\n" : "") + (offer.message.length > 0 ? offer.message : ""),
              fields: [{
                  "name": them.personaName + " offered:",
                  value: strs[1].length > 0 ? strs[1] : "*nothing*"
                },
                {
                  "name": "For your:",
                  value: strs[0].length > 0 ? strs[0] : "*nothing*"
                }
              ],
              thumbnail: {
                url: them.avatarFull
              }
            }
          });

          data[offer.id] = msg.id;

          msg.react("✅");
          msg.react("❌");

          database.set("offerData", data);
        });
      }

      while(cache.aoffers.length > 0){
        let aoffer = cache.aoffers.shift();

        tradeoffers.getOffer(aoffer[0], async (err, offer) => {
          if( err ) return console.log(err);

          offer.accept(false, async(err, status) => {
            if( err ) return console.log(err);

            let extraData = "";

            if( status === "pending" ) extraData = "Check your Mobile Authenticator or e-mail inbox to verify.";
            else if( status === "escrow" ) extraData = "This trade offer is in escrow.";

            let embed = new Discord.RichEmbed(aoffer[1].embeds[0]);
            embed.setTitle("✅ Trade offer accepted!");
            embed.setDescription((extraData.length > 0 ? "**" + extraData + "**\n\n" : "") + embed.description);

            await aoffer[1].edit("", { embed: embed });
            await aoffer[1].clearReactions();
          });
        });
      }
    });
  });

  steam.on("disconnected", () => {
    cache.steamReady = false;

    util.sendToFeed("debug", "Disconnected from Steam.");
  });

  steam.on("friendMessage", (steamid, message) => {
    util.sendFromFriend(steamid.toString(), message);
  });

  steam.on("friendTyping", async steamid => {
    if( util.hasFriendChat(steamid) && !cache.typing[steamid] ) {

      let chan = (await util.createOrGetFriendChat(steamid));

      chan.chan.startTyping();

      cache.typing[steamid] = setTimeout(() => {
        chan.chan.stopTyping();
      }, 30000);
    }
  });

  steam.on("error", error => {
    util.sendToFeed("connect", { title: "Steam error", description: error.toString().substring(0, 512) + "\n\nAttempt to log on again by typing ~logon." });
  });

  steam.on("newItems", count => util.updateNotificationMessages("items", count));
  steam.on("newComments", count => util.updateNotificationMessages("comments", count));
  steam.on("communityMessages", count => util.updateNotificationMessages("community", count));
  steam.on("offlineMessages", count => util.updateNotificationMessages("offline", count));
  steam.on("tradeOffers", count => util.updateNotificationMessages("offers", count));

  steam.on("friendRelationship", (steamid, relationship) => {
    if( relationship === Steam.EFriendRelationship.RequestInitiator ) return; // the user knows they added someone

    let action = "";

    if( relationship === Steam.EFriendRelationship.None ) action = "{{name}} removed you.";
    else if( relationship === Steam.EFriendRelationship.Blocked ) action = "You blocked {{name}}.";
    else if( relationship === Steam.EFriendRelationship.RequestRecipient ) action = "{{name}} sent a friend invite.";
    else if( relationship === Steam.EFriendRelationship.Friend ) action = "You are now friends with {{name}}.";
    else action = "{{name}} " + Steam.EFriendRelationship[relationship] + " you.";

    let name = steam.users[steamid] && steam.users[steamid].player_name ? steam.users[steamid].player_name : steamid.toString();
    let avatar = steam.users[steamid] && steam.users[steamid].avatar_url_full ? steam.users[steamid].avatar_url_full : "https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/fe/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg";

    util.sendToFeed("relationship", util.addIcon({ title: action.replace("{{name}}", name), description: "[Profile](https://steamcommunity.com/profile/" + steamid + ")", thumbnail: { url: avatar }, footer: { text: steamid.toString() } }, util.relationshipIcons[relationship]));
  });

  // -----------
  discord.login(config.discord.token);
})();
