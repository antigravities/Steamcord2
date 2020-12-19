module.exports = pkg => {
    pkg.database.set("notification", pkg.message.channel.id);
    pkg.database.set("notification_message", false);
    pkg.util.updateNotificationMessages("a", 0);
};