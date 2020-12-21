module.exports = async pkg => {
    let msg = await pkg.message.channel.send("Pong! 🏓");
    msg.edit("Pong! 🏓 Message received and responded to in " + (Date.now() - pkg.rcv) + "ms.");
}