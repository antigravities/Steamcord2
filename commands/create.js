module.exports = async pkg => {
    if( pkg.args.length < 2 ) return "Please specify a SteamID64 to create a channel for.";
    let chan = await pkg.util.createOrGetFriendChat(pkg.args[1]);
    return "Created channel <#" + chan.chan.id + ">. Rename or reorganize it however you'd like.";
  };