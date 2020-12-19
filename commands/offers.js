module.exports = pkg => {
    if( pkg.database.get("offers", false) ){
        pkg.database.set("offers", false);
        return "Disabled offer notifications.";
    } else {
        pkg.database.set("offers", pkg.message.channel.id);
        return "Offer notifications will be sent to <#" + pkg.message.channel.id + ">.";
    }
};