const getPositionsData = require('./getPositionsData');
const { Api, TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const puppeteer = require("puppeteer");

const DEBUG_MODE = false;
const peer = 'edwardmolasses';
// const peer = 'EdwardMolassesChannel';
// const peer = 'LeverageRatioAlerts';
// const peer = 'robertplankton';
const TG_API_ID = parseInt(process.env.TG_API_ID);
const TG_API_HASH = process.env.TG_API_HASH;
const TG_AUTH_KEY = process.env.TG_AUTH_KEY;
// const TG_AUTH_KEY = process.env.TG_BOT_AUTH_KEY;
const MSG_NO_ALERT = "NO ALERT";
const MSG_HEAVY_LONGS = "SUSTAINED HEAVY LONGS";
const MSG_HEAVY_SHORTS = "SUSTAINED HEAVY SHORTS";
const MSG_EXTREME_LONGS = "SUSTAINED EXTREME LONGS";
const MSG_EXTREME_SHORTS = "SUSTAINED EXTREME SHORTS";
const SL_DIFF_SIGN_FLIP = "SL DIFF SIGN FLIP";
const SL_1H_EXTREME_CHANGE = "SL 1H EXTREME CHANGE";

const alertEmoji = "\u26A0\uFE0F";
const suprisedEmoji = "\uD83D\uDE32";
const bearEmoji = "\uD83D\uDC3B";
const bullEmoji = "\uD83D\uDC02";

const millionMultiplier = 1000000;
const leverageThreshold = 50 * millionMultiplier;
const extremeLeverageThreshold = 70 * millionMultiplier;
const remoteChartUrl = 'floating-hamlet-81093.herokuapp.com';
const remoteChartWidth = 1030;
const remoteChartHeight = 675;
const chartFilename = 'chart.png';
const setLastMsg = (lastMsgStatusStr) => lastMsgStatus = lastMsgStatusStr;
let lastMsgStatus = MSG_NO_ALERT;

async function sendTelegramMessages() {
    const prettifyNum = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    const truncateTimestamp = (timestamp) => parseInt(timestamp / 1000);

    const sendMsgByBot = async function (msg) {
        if (msg) {
            const session = new StringSession(TG_AUTH_KEY); // You should put your string session here
            const client = new TelegramClient(session, TG_API_ID, TG_API_HASH, {});

            await client.connect();
            await client.sendFile(peer, {
                file: chartFilename,
                caption: msg,
                parseMode: 'html',
            });
        }
    }

    const getTelegramMsgBuildVars = function (allPositionsData) {
        const shortLongDiffPercentThreshold = 50;

        const lastPositionData = allPositionsData[allPositionsData.length - 1];
        const latestTimestamp = truncateTimestamp(allPositionsData[allPositionsData.length - 1].timestamp);
        const allPositionsDataReverse = allPositionsData.reverse();

        const hourAwayFromLatestItem =
            allPositionsData[allPositionsDataReverse.findIndex(item => ((latestTimestamp - truncateTimestamp(item.timestamp)) / 3600) > 1)];
        const shortLongDiffPercent1h = Math.ceil((lastPositionData.shortLongDiff - hourAwayFromLatestItem.shortLongDiff) / hourAwayFromLatestItem.shortLongDiff * 100);
        const isShortLongDiffPercentExtreme = Math.abs(shortLongDiffPercent1h) > shortLongDiffPercentThreshold;

        const dayAwayFromLatestItem =
            allPositionsData[allPositionsDataReverse.findIndex(item => ((latestTimestamp - truncateTimestamp(item.timestamp)) / 3600) > 24)];
        const latestTotalVolume = allPositionsData[allPositionsData.length - 1].shortVolume + allPositionsData[allPositionsData.length - 1].longVolume;
        const dayAwayTotalVolume = dayAwayFromLatestItem.shortVolume + dayAwayFromLatestItem.longVolume;
        const shortLongDiffPercent24h = Math.ceil(((lastPositionData.shortLongDiff - dayAwayFromLatestItem.shortLongDiff) / dayAwayFromLatestItem.shortLongDiff) * 100);
        const volumeTotalsPercent24h = Math.ceil(((latestTotalVolume - dayAwayTotalVolume) / dayAwayTotalVolume) * 100);
        const ratio = parseFloat(lastPositionData.shortVolume / lastPositionData.longVolume).toFixed(2);

        return {
            'lastPositionData': lastPositionData,
            'shortLongDiffPercent1h': shortLongDiffPercent1h,
            'isShortLongDiffPercentExtreme': isShortLongDiffPercentExtreme,
            'shortLongDiffPercent24h': shortLongDiffPercent24h,
            'volumeTotalsPercent24h': volumeTotalsPercent24h,
            'ratio': ratio
        }
    }

    const buildTelegramMsg = function (
        allPositionsData,
        isShortLongDiffFlippedSign,
        isSustainedHeavyLongs,
        isSustainedHeavyShorts,
        isExtremeLongs,
        isExtremeShorts
    ) {
        let msg = "";
        const { lastPositionData,
            shortLongDiffPercent1h,
            isShortLongDiffPercentExtreme,
            shortLongDiffPercent24h,
            volumeTotalsPercent24h,
            ratio } = getTelegramMsgBuildVars(allPositionsData);

        if (isShortLongDiffPercentExtreme || isShortLongDiffFlippedSign || isSustainedHeavyLongs || isSustainedHeavyShorts || isExtremeLongs || isExtremeShorts) {
            const debugModeMsg = DEBUG_MODE ? ` (this is a test please ignore)` : '';
            const shortLongDiffSignMsg =
                lastPositionData.shortVolume > lastPositionData.longVolume ? "Shorts are now outnumbering Longs" : "Longs are now outnumbering Shorts";

            const isShortLongDiffUnbalanced = allPositionsData.shortLongDiff > 30 * millionMultiplier || allPositionsData.shortLongDiff < -30 * millionMultiplier;
            const isSignNegative = (val) => Math.sign(val) === '-';
            const buildMsgTitle =
                (isExtremeLongs, isExtremeShorts) =>
                    `${alertEmoji} <b><u><i>${isExtremeLongs || isExtremeShorts ? `HIGH ` : ``}ALERT ${debugModeMsg}</i></u></b> ${alertEmoji}\n`;
            const addPercentageSign = (percentage) => `${!!~Math.sign(percentage) ? '+' : ''}${percentage}%`;
            const msgStats = (shortVolume, longVolume, shortLongDiff, ratio, volumeTotalsPercent24h, shortLongDiffPercent24h) => {
                let msg = '\n\n';
                msg += `<pre>`;
                msg += `Short Volume   $${prettifyNum(shortVolume)}   \n`;
                msg += `Long Volume    $${prettifyNum(longVolume)}    \n`;
                msg += `S/L Difference $${prettifyNum(shortLongDiff)} (${addPercentageSign(shortLongDiffPercent24h)}) ${isExtremeLongs ? suprisedEmoji : ''}  \n`;
                msg += `Total Volume   $${prettifyNum(shortVolume + longVolume)} (${addPercentageSign(volumeTotalsPercent24h)})    \n`;
                // msg += `S/L Diff Std Deviation  $${prettifyNum(parseInt(shortLongDiffStandardDeviation))}\n`;
                msg += `</pre>`

                return msg;
            }
            let msgTitle = '';
            let msgDetail = '';

            if (isShortLongDiffUnbalanced && isShortLongDiffPercentExtreme && lastMsgStatus !== SL_1H_EXTREME_CHANGE) {
                const biggerVol = isSignNegative(shortLongDiffPercent1h) ? 'long' : 'short';
                const smallerVol = isSignNegative(shortLongDiffPercent1h) ? 'short' : 'long';
                const feeling = isSignNegative(shortLongDiffPercent1h) ? 'bull' : 'bear';
                const emoji = isSignNegative(shortLongDiffPercent1h) ? bullEmoji : bearEmoji;

                msgTitle = buildMsgTitle(false, false);
                msgDetail += `\n<b><u><i>S/L DIFFERENCE VOLATILITY</i></u></b>:  ${addPercentageSign(shortLongDiffPercent1h)} in the past hour. `;
                msgDetail += `Traders are <b><i>${biggerVol}ing</i></b> more than <b><i>${smallerVol}ing</i></b>, meaning they are getting ${feeling}ish\n${emoji}${emoji}${emoji}`;
                setLastMsg(SL_1H_EXTREME_CHANGE);
            }
            if (isShortLongDiffFlippedSign && lastMsgStatus !== SL_DIFF_SIGN_FLIP) {
                msgTitle = buildMsgTitle(false, false);
                msgDetail += `\n<b><u><i>RATIO FLIPPED</i></u></b>:  ${shortLongDiffSignMsg}`;
                setLastMsg(SL_DIFF_SIGN_FLIP);
            }
            if (isSustainedHeavyLongs || isSustainedHeavyShorts) {
                if (isSustainedHeavyLongs && lastMsgStatus !== MSG_HEAVY_LONGS) {
                    msgTitle = buildMsgTitle(isExtremeLongs, isExtremeShorts);
                    msgDetail += `\nLeveraged Long positions on GMX are at high levels relative to Shorts`;
                    msgDetail += `\nTraders are feeling <b><i>bullish</i></b> ${bullEmoji}${bullEmoji}${bullEmoji}`;
                    setLastMsg(MSG_HEAVY_LONGS);
                }
                if (isSustainedHeavyShorts && lastMsgStatus !== MSG_HEAVY_SHORTS) {
                    msgTitle = buildMsgTitle(isExtremeLongs, isExtremeShorts);
                    msgDetail += `\nLeveraged Short positions on GMX are at high levels relative to Longs`;
                    msgDetail += `\nTraders are feeling <b><i>bearish</i></b> ${bearEmoji}${bearEmoji}${bearEmoji}`;
                    setLastMsg(MSG_HEAVY_SHORTS);
                }
            }
            if (isExtremeLongs || isExtremeShorts) {
                if (isExtremeLongs && lastMsgStatus !== MSG_EXTREME_LONGS) {
                    msgTitle = buildMsgTitle(isExtremeLongs, isExtremeShorts)
                    msgDetail += `\nLeveraged Long Positions on GMX have hit an extreme level relative to shorts in the past hour`;
                    msgDetail += `\nTraders are feeling <b><i>very bullish</i></b> ${bullEmoji}${bullEmoji}${bullEmoji}`;
                    setLastMsg(MSG_EXTREME_LONGS);
                }
                if (isExtremeShorts && lastMsgStatus !== MSG_EXTREME_SHORTS) {
                    msgTitle = buildMsgTitle(isExtremeLongs, isExtremeShorts)
                    msgDetail += `\nLeveraged Short Positions on GMX have hit an extreme level relative to longs in the past hour`;
                    msgDetail += `\nTraders are feeling <b><i>very bearish</i></b> ${bearEmoji}${bearEmoji}${bearEmoji}`;
                    setLastMsg(MSG_EXTREME_SHORTS);
                }
            }

            if (msgDetail) {
                msg += msgTitle;
                msg += msgDetail;
                msg += msgStats(
                    lastPositionData.shortVolume,
                    lastPositionData.longVolume,
                    lastPositionData.shortLongDiff,
                    ratio,
                    volumeTotalsPercent24h,
                    shortLongDiffPercent24h
                );
            }
        } else {
            if (lastMsgStatus === MSG_HEAVY_LONGS ||
                lastMsgStatus === MSG_HEAVY_SHORTS ||
                lastMsgStatus === MSG_EXTREME_LONGS ||
                lastMsgStatus === MSG_EXTREME_SHORTS) {
                msg += "UPDATE: LEVERAGED SHORTS/LONGS ARE NO LONGER AT AN ELEVATED LEVEL";
            }
            setLastMsg(MSG_NO_ALERT);
        }

        return msg;
    }

    const allPositionsData = await getPositionsData();
    const allPositionsShortLongDiffMean =
        allPositionsData
            .reduce((previousValue, currentValue) => previousValue + parseInt(currentValue.shortLongDiff), 0) / allPositionsData.length;
    const latestPositionData = allPositionsData.slice(allPositionsData.length - 10);

    /* standard deviation */
    const varianceDataPoints = allPositionsData.map(dataPoint => {
        const variance = parseInt(dataPoint.shortLongDiff - allPositionsShortLongDiffMean);
        return variance * variance;
    });
    const sumOfVariance = varianceDataPoints.reduce((previousValue, currentValue) => previousValue + currentValue, 0);
    const shortLongDiffStandardDeviation = Math.sqrt(sumOfVariance / (allPositionsData.length - 1));

    /* alert checks */
    const isSustainedHeavyLongs = latestPositionData.reduce(
        (numHeavyLongItems, currentItem) => currentItem.shortLongDiff < -leverageThreshold ? numHeavyLongItems + 1 : numHeavyLongItems, 0) >= 5;
    const isExtremeLongs = DEBUG_MODE ? true : latestPositionData.reduce(
        (numHeavyLongItems, currentItem) => currentItem.shortLongDiff < -extremeLeverageThreshold ? numHeavyLongItems + 1 : numHeavyLongItems, 0) >= 2;
    const isSustainedHeavyShorts = latestPositionData.reduce(
        (numHeavyLongItems, currentItem) => currentItem.shortLongDiff > leverageThreshold ? numHeavyLongItems + 1 : numHeavyLongItems, 0) >= 5;
    const isExtremeShorts = latestPositionData.reduce(
        (numHeavyLongItems, currentItem) => currentItem.shortLongDiff > extremeLeverageThreshold ? numHeavyLongItems + 1 : numHeavyLongItems, 0) >= 2;
    const latestFiftyData = allPositionsData.slice(1, 50);
    const isShortLongDiffFlippedSign = latestFiftyData
        .some(
            (item, index) => {
                const currentSign = Math.sign(item.shortLongDiff);
                const previousSign = !!latestFiftyData[index - 1] ? Math.sign(latestFiftyData[index - 1].shortLongDiff) : currentSign;

                return currentSign !== previousSign;
            }
        );

    const msg = buildTelegramMsg(
        allPositionsData,
        isShortLongDiffFlippedSign,
        isSustainedHeavyLongs,
        isSustainedHeavyShorts,
        isExtremeLongs,
        isExtremeShorts
    );

    // console.log('dayAwayShortLongDiff: ', dayAwayShortLongDiff);
    // console.log('shortLongDiffPercent24h: ', shortLongDiffPercent24h);
    // console.log('latestTotalVolume: ', latestTotalVolume);
    // console.log('dayAwayTotalVolume: ', dayAwayTotalVolume);
    // console.log('volumeTotalsPercent24h: ', volumeTotalsPercent24h);
    console.log('isShortLongDiffFlippedSign: ', isShortLongDiffFlippedSign);
    console.log('isSustainedHeavyLongs: ', isSustainedHeavyLongs);
    console.log('isExtremeLongs: ', isExtremeLongs);
    console.log('isSustainedHeavyShorts: ', isSustainedHeavyShorts);
    console.log('isExtremeShorts: ', isExtremeShorts);

    puppeteer
        .launch({
            defaultViewport: {
                width: remoteChartWidth,
                height: remoteChartHeight,
            },
        })
        .then(async (browser) => {
            const page = await browser.newPage();
            const url = `http://${remoteChartUrl}`;

            await page.goto(url, { waitUntil: 'networkidle0', timeout: 0 });
            setTimeout(async function () {
                await page.screenshot({ path: chartFilename });
                await browser.close();
                await sendMsgByBot(msg);
                console.log('LAST MSG STATUS : ', lastMsgStatus);
            }, 10000);
        });
}

module.exports = sendTelegramMessages;