module.exports = async pkg => {
    if( pkg.database.get("friendchan", false) ){
        pkg.database.set("friendchan", false);
        pkg.database.set("friendmsg", false);
        return "Disabled friend list.";
    } else {
        pkg.database.set("friendchan", pkg.message.channel.id);
        pkg.database.set("friendmsg", (await pkg.message.channel.send("", { embed: { description: "Please wait..." } })).id);
    }
};