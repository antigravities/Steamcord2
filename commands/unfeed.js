module.exports = pkg => {
    if( pkg.args.length < 2 ) return "Please specify a feed to unassign.";

    if( ! pkg.database.get("feeds", false) ) pkg.database.set("feeds", {});

    let cfeeds = pkg.database.get("feeds");
    delete cfeeds[pkg.args[1]];
    pkg.database.set("feeds", cfeeds);

    return "Unlinked feed `" + pkg.args[1] + "`.";
};