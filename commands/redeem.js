module.exports = async pkg => {
    if (pkg.args.length < 2) return "Specify the keys you want to redeem separated by a space.";

    pkg.args.shift();

    let resp = "";

    for (let arg of pkg.args) {
        try {
            await new Promise((resolve, reject) => {
                pkg.steam.redeemKey(arg, (err, purchaseResultDetails, packageList) => {
                    if (err) {
                        if (!err.purchaseResultDetails || !err.packageList) return reject(err);

                        if (err.purchaseResultDetails) purchaseResultDetails = err.purchaseResultDetails;
                        if (err.packageList) packageList = err.packageList;
                    }

                    if (purchaseResultDetails == pkg.Steam.EPurchaseResult.RateLimited) {
                        return reject(err);
                    }

                    resp += "Key: " + arg + " | Response: " + pkg.util.resolveEnum(pkg.Steam.EPurchaseResult, purchaseResultDetails) + " | Packages: " + Object.keys(packageList).map(i => packageList[i] + " (" + i + ")").join(", ") + "\n";

                    resolve();
                });
            });
        } catch (err) {
            resp += "Error: " + (err.purchaseResultDetails ? pkg.util.resolveEnum(pkg.Steam.EPurchaseResult, err.purchaseResultDetails) : err.toString()) + "\n";
            break;
        }
    }

    await pkg.util.splitMsg((msg) => {
        pkg.message.channel.send(msg);
    }, resp);

}