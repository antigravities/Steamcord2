module.exports = pkg => {
    if( pkg.args.length < 2 ) return "Please specify a feed to assign.";

    if( ! pkg.database.get("feeds", false) ) pkg.database.set("feeds", {});

    let cfeeds = pkg.database.get("feeds");
    cfeeds[pkg.args[1]] = pkg.message.channel.id;
    pkg.database.set("feeds", cfeeds);

    return "Set <#" + pkg.message.channel.id + "> as the location for `" + pkg.args[1] + "` messages.";
};