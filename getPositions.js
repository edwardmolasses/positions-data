const randomUserAgent = require('random-useragent');
const page_url = 'https://gmx-server-mainnet.uw.r.appspot.com/position_stats';
const fs = require('fs');
const fetch = require('node-fetch');

function getAcceptForBrowserVersion(browser, version) {
    const defaultAccept = "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/png,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9";
    const firefox92andLater = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8';
    const firefox72to91 = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8';
    const firefox66to71 = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
    const firefox65 = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8';
    const firefox64andEarlier = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
    const safariAndChrome = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8';
    const safari5 = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
    const ie8 = 'image/jpeg, application/x-ms-application, image/gif, application/xaml+xml, image/pjpeg, application/x-ms-xbap, application/x-shockwave-flash, application/msword, */*';
    const edge = 'text/html, application/xhtml+xml, image/jxr, */*';
    const opera = 'text/html, application/xml;q=0.9, application/xhtml+xml, image/png, image/webp, image/jpeg, image/gif, image/x-xbitmap, */*;q=0.1';
    let accept;

    browser = browser.toLowerCase();
    version = parseInt(version);

    if (browser === 'firefox') {
        if (version < 65) {
            accept = firefox64andEarlier;
        }
        if (version === 65) {
            accept = firefox65;
        }
        if (version >= 66 && version <= 71) {
            accept = firefox66to71;
        }
        if (version >= 72 && version <= 91) {
            accept = firefox72to91;
        }
        if (version >= 92 || !!!version) {
            accept = firefox92andLater;
        }
    } else if (browser === 'safari' || browser === 'chrome') {
        if (browser === 'safari' && !!version && version === 5) {
            accept = safari5;
        } else {
            accept = safariAndChrome;
        }
    } else if (browser === 'ie') {
        accept = ie8;
    } else if (browser === 'edge') {
        accept = edge;
    } else if (browser === 'opera') {
        accept = opera;
    } else {
        accept = defaultAccept;
    }

    return accept;
}


async function getPositionData() {
    // NOTES:
    // leaving out Host could allow bot detection
    // e.g. Host: 'www.amazon.com'
    const userAgentData = randomUserAgent.getRandomData();
    console.log(userAgentData.userAgent);
    console.log(getAcceptForBrowserVersion(userAgentData.browserName, userAgentData.browserMajor));
    const response = await fetch(page_url, {
        "headers": {
            "accept": getAcceptForBrowserVersion(userAgentData.browserName, userAgentData.browserMajor),
            "accept-language": "en-US,en;q=0.9,la;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Host": "gmx-server-mainnet.uw.r.appspot.com",
            "User-Agent": userAgentData.userAgent,
            "if-none-match": "W/\"131-hOwnr0C8nbILkIgUZkJoiOiWrXo\"",
            "Referer": "https://app.gmx.io/",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Dnt": "1",
            "Upgrade-Insecure-Requests": "1",
            "origin": "https://app.gmx.io",
        },
        "body": null,
        "method": "GET"
    });
    const text = await response.text();

    return JSON.parse(text);
}

async function getEthPrice() {
    const userAgentData = randomUserAgent.getRandomData();
    const response = await fetch("https://api.ethereumdb.com/v1/ticker?pair=ETH-USD&range=1h", {
        "User-Agent": userAgentData.userAgent,
        "referrerPolicy": "strict-origin-when-cross-origin",
        "mode": "cors",
        "body": null,
        "method": "GET"
    });
    const text = await response.text();

    return JSON.parse(text);
}

async function getPositions() {
    const positionData = await getPositionData();
    const ethPrice = await getEthPrice();

    if (!!positionData) {
        const volumeFactor = Math.pow(10, 30);
        const shortVolume = parseInt(positionData.totalShortPositionSizes / volumeFactor);
        const longVolume = parseInt(positionData.totalLongPositionSizes / volumeFactor);
        const shortLongDiff = shortVolume - longVolume;
        const datetime = Date.now();
        const row = `\r\n${datetime},${shortVolume},${longVolume},${shortLongDiff},${parseInt(ethPrice.price)}`;

        fs.appendFileSync("positions.csv", row);
    }
}

module.exports = getPositions;