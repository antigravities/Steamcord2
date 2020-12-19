const fs = require("fs");

module.exports = () => {
    let files = fs.readdirSync(__dirname);

    let commands = {};

    for( let file of files ){
        if( file == "index.js" || ! file.endsWith(".js") ) continue;

        commands[file.split(".")[0]] = require("./" + file);
    }

    commands.load = pkg => {
        if( pkg.args.length < 2 ) return "Please specify a command to (re)load.";

        let file = pkg.args[1];

        try {
            delete require.cache[require.resolve("./" + file + ".js")];
            commands[file] = require("./" + file + ".js");

            return "Command " + file + " was reloaded.";
        } catch(e) {
            return "Command " + file + " could not be loaded:\n```" + e.stack + "```";
        }
    }

    commands.unknown = () => "Unknown command. For help, type ~help.";

    commands.help = () => "Available commands: " + Object.keys(commands).join(", ");

    return commands;
};