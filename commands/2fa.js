module.exports = pkg => {
    if( ! pkg.cache.needs2FA ) return "I don't need a 2FA token right now.";
    if( pkg.args.length < 2 ) return "Please specify the 2FA token.";

    pkg.cache.needs2FA(pkg.args[1]);
};