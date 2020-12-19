module.exports = async pkg => {
    let soft = pkg.args.length > 1 && pkg.args[1] == "soft";

    let chans = pkg.database.get("chats", {});

    let link = pkg.util.getSteamIDFromChan(pkg.message.channel);

    if( ! link ) return "This channel is not linked to a chat.";

    if( ! soft ) await pkg.message.channel.delete();

    delete chans[link];

    if( soft ) {
        (await pkg.message.channel.send("This channel has been soft-deleted and is unlinked from Steamcord. Messages sent here will not reach the other party.")).pin();
    }

    pkg.database.set("chats", chans);
};