module.exports = async pkg => {
    let msg = await pkg.message.channel.send("", { embed: { title: "Pong! 🏓" } });
    msg.edit("", { embed: { title: "Pong! 🏓", description: "Message received and responded to in " + (Date.now() - pkg.rcv) + "ms." } });
}