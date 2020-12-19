module.exports = async pkg => {
    if( pkg.args.length < 2 ) return "Please specify a friend to add.";
    pkg.steam.addFriend(pkg.args[1]);
    return "Sent a friend invite to or accepted a friend invite from <https://steamcommunity.com/profiles/" + pkg.args[1] + ">";
}