const getPositionsData = require('./getPositionsData');
const { DEBUG_MODE, THRESHOLDS } = require('./constants');

const isDebugMode = DEBUG_MODE['EXTREME_LONGS'] || DEBUG_MODE['HOURLY'] || DEBUG_MODE['EXTREME_SHORTS'];

const MSG_NO_ALERT = "NO ALERT";
const MSG_HEAVY_LONGS = "SUSTAINED HEAVY LONGS";
const MSG_HEAVY_SHORTS = "SUSTAINED HEAVY SHORTS";
const MSG_EXTREME_LONGS = "SUSTAINED EXTREME LONGS";
const MSG_EXTREME_SHORTS = "SUSTAINED EXTREME SHORTS";
const SL_DIFF_SIGN_FLIP = "SL DIFF SIGN FLIP";
const SL_1H_EXTREME_CHANGE = "SL 1H EXTREME CHANGE";
let lastMsgStatus = MSG_NO_ALERT;

const alertEmoji = "\u26A0\uFE0F";
const redEmoji = "\uD83D\uDD34";
const suprisedEmoji = "\uD83D\uDE32";
const bearEmoji = "\uD83D\uDC3B";
const bullEmoji = "\uD83D\uDC02";

const millionMultiplier = 1000000;
const leverageThreshold = THRESHOLDS.HIGH_LEVERAGE;
const extremeLeverageThreshold = THRESHOLDS.EXTREME_LEVERAGE;

const setLastMsg = (lastMsgStatusStr) => lastMsgStatus = lastMsgStatusStr;
const prettifyNum = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const truncateTimestamp = (timestamp) => parseInt(timestamp / 1000);

const getAlertMsgBuildVars = function (allPositionsData) {
    const findLastTrend = function (positionsData) {
        function diffHours(startTime, endTime) {
            const differenceInMiliseconds = endTime - startTime;
            const differenceInSeconds = differenceInMiliseconds / 1000;
            const differenceInMinutes = differenceInSeconds / 60;
            const differenceInHours = differenceInMinutes / 60;

            return differenceInHours;
        }
        let lastDirection = null;
        let lastLastDirection = null;
        let lastLastLastDirection = null;
        let trendStartIndex = null;
        let trendEndIndex = null;
        let trend = null;

        for (let step = 1; step < positionsData.length - 1; step++) {
            const index = positionsData.length - step;
            const currPositionData = positionsData[index];
            const prevPositionData = positionsData[index - 1];

            if (lastDirection && lastLastDirection && lastLastLastDirection) {
                if (!trendEndIndex) {
                    if (lastDirection < 0 && lastLastDirection < 0 && lastLastLastDirection < 0) {
                        trendEndIndex = index + 3;
                        trend = -1;
                    }
                    if (lastDirection > 0 && lastLastDirection > 0 && lastLastLastDirection > 0) {
                        trendEndIndex = index + 3;
                        trend = 1;
                    }
                } else {
                    if ((lastDirection < 0 && lastLastDirection < 0 && lastLastLastDirection < 0 && trend > 0) ||
                        (lastDirection > 0 && lastLastDirection > 0 && lastLastLastDirection > 0 && trend < 0)) {
                        console.log('setting end index');
                        trendStartIndex = index + 3;
                        break;
                    }
                }
            }

            lastLastLastDirection = lastLastDirection;
            lastLastDirection = lastDirection;
            lastDirection = currPositionData.movingAverage >= prevPositionData.movingAverage ? 1 : -1;
        }

        const startMovingAverage = positionsData[trendStartIndex].movingAverage;
        const endMovingAverage = positionsData[trendEndIndex].movingAverage;
        const percentChange = parseInt((endMovingAverage - startMovingAverage) / startMovingAverage * 100);
        const hoursDiff = diffHours(positionsData[trendStartIndex].timestamp, positionsData[trendEndIndex].timestamp).toFixed(1);

        return { trend, trendStartIndex, trendEndIndex, percentChange, hoursDiff };
    }
    const shortLongDiffPercentThreshold = DEBUG_MODE['HOURLY'] ? 1 : THRESHOLDS.SL_DIFF_EXTREME_PERCENT;
    const movingAverageRange = 5;
    const shortLongDiffMovingAverage = allPositionsData.map((element, index) => {
        let movingSum = 0;
        if (index > movingAverageRange - 2) {
            for (let step = 0; step < movingAverageRange; step++) {
                movingSum += allPositionsData[index - step].shortLongDiff;
            }
            return parseInt(movingSum / movingAverageRange);
        } else {
            return null;
        }
    });
    const updatedAllPositionsData = allPositionsData.map((element, index) => {
        element.movingAverage = shortLongDiffMovingAverage[index];
        return element;
    });

    const { trend, trendStartIndex, trendEndIndex, percentChange, hoursDiff } = findLastTrend(updatedAllPositionsData);
    console.log('trend: ', trend);
    console.log('trendStartIndex: ', trendStartIndex);
    console.log('trendEndIndex: ', trendEndIndex);
    console.log('percentChange: ', percentChange);
    console.log('hoursDiff: ', hoursDiff);
    // console.log(updatedAllPositionsData.map((element, index) => { element.index = index; return element; }).reverse());

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
        'updatedAllPositionsData': updatedAllPositionsData,
        'ratio': ratio
    }
}

const buildAlertMsg = function (
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
        updatedAllPositionsData,
        ratio } = getAlertMsgBuildVars(allPositionsData);

    if (isShortLongDiffPercentExtreme || isShortLongDiffFlippedSign || isSustainedHeavyLongs || isSustainedHeavyShorts || isExtremeLongs || isExtremeShorts) {
        const debugModeMsg = isDebugMode ? ` (this is a test please ignore)` : '';
        const shortLongDiffSignMsg =
            lastPositionData.shortVolume > lastPositionData.longVolume ? "Shorts are now outnumbering Longs" : "Longs are now outnumbering Shorts";

        const isShortLongDiffUnbalanced =
            DEBUG_MODE['HOURLY'] ? true : allPositionsData.shortLongDiff > 30 * millionMultiplier || allPositionsData.shortLongDiff < -30 * millionMultiplier;
        const isSignNegative = (val) => Math.sign(val) === '-';
        const buildMsgTitle =
            (isExtremeLongs, isExtremeShorts) => {
                const highAlert = isExtremeLongs || isExtremeShorts;
                const alertTypeName = highAlert ? 'HIGH ALERT' : 'ALERT';
                const emoji = highAlert ? alertEmoji : redEmoji;

                return `${emoji} <b><u><i>${alertTypeName} ${debugModeMsg}</i></u></b> ${emoji}\n`;
            }
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
            const emptyBear = '   -   ';

            msgTitle = buildMsgTitle(false, false);
            msgDetail += `\n<b><u><i>S/L DIFFERENCE VOLATILITY</i></u></b>:  ${addPercentageSign(shortLongDiffPercent1h)} in the past hour. `;
            msgDetail += `Traders are <b><i>${biggerVol}ing</i></b> more than <b><i>${smallerVol}ing</i></b>, meaning they are getting <b><i>${feeling}ish</b></i>\n\n${emoji}${emoji}   -   -   - \n`;
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
                msgDetail += `\n\nTraders are feeling <b><i>bullish</i></b> ${bullEmoji}${bullEmoji}${bullEmoji}   -      -   `;
                msgDetail += DEBUG_MODE['GIRAFFLE_MODE'] ? '\n\n<b><u><i>HINT</i></u></b>: If this keeps up, prepare to <b><i>SHORT</b></i>' : '';
                setLastMsg(MSG_HEAVY_LONGS);
            }
            if (isSustainedHeavyShorts && lastMsgStatus !== MSG_HEAVY_SHORTS) {
                msgTitle = buildMsgTitle(isExtremeLongs, isExtremeShorts);
                msgDetail += `\nLeveraged Short positions on GMX are at high levels relative to Longs`;
                msgDetail += `\n\nTraders are feeling <b><i>bearish</i></b> ${bearEmoji}${bearEmoji}${bearEmoji}   -      -   `;
                msgDetail += DEBUG_MODE['GIRAFFLE_MODE'] ? '\n\n<b><u><i>HINT</i></u></b>: If this keeps up, prepare to <b><i>LONG</b></i>' : '';
                setLastMsg(MSG_HEAVY_SHORTS);
            }
        }
        if (isExtremeLongs || isExtremeShorts) {
            if (isExtremeLongs && lastMsgStatus !== MSG_EXTREME_LONGS) {
                msgTitle = buildMsgTitle(isExtremeLongs, isExtremeShorts)
                msgDetail += `\nLeveraged Long Positions on GMX have hit an extreme level relative to shorts in the past hour`;
                msgDetail += `\n\nTraders are feeling <b><i>very bullish</i></b> ${bullEmoji}${bullEmoji}${bullEmoji}${bullEmoji}${bullEmoji}`;
                msgDetail += DEBUG_MODE['GIRAFFLE_MODE'] ? '\n\n<b><u><i>HINT</i></u></b>: Take a <b><i>SHORT POSITION</b></i> soon' : '';
                setLastMsg(MSG_EXTREME_LONGS);
            }
            if (isExtremeShorts && lastMsgStatus !== MSG_EXTREME_SHORTS) {
                msgTitle = buildMsgTitle(isExtremeLongs, isExtremeShorts)
                msgDetail += `\nLeveraged Short Positions on GMX have hit an extreme level relative to longs in the past hour`;
                msgDetail += `\n\nTraders are feeling <b><i>very bearish</i></b> ${bearEmoji}${bearEmoji}${bearEmoji}${bearEmoji}${bearEmoji}`;
                msgDetail += DEBUG_MODE['GIRAFFLE_MODE'] ? '\n\n<b><u><i>HINT</i></u></b>: Take a <b><i>LONG POSITION</b></i> soon' : '';
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

function getStandardDeviation(allPositionsData) {
    const allPositionsShortLongDiffMean =
        allPositionsData
            .reduce((previousValue, currentValue) => previousValue + parseInt(currentValue.shortLongDiff), 0) / allPositionsData.length;
    const varianceDataPoints = allPositionsData.map(dataPoint => {
        const variance = parseInt(dataPoint.shortLongDiff - allPositionsShortLongDiffMean);
        return variance * variance;
    });
    const sumOfVariance = varianceDataPoints.reduce((previousValue, currentValue) => previousValue + currentValue, 0);
    const shortLongDiffStandardDeviation = Math.sqrt(sumOfVariance / (allPositionsData.length - 1));

    return shortLongDiffStandardDeviation;
}

async function sendTelegramMessage(remoteChartWidth, remoteChartHeight, remoteChartUrl, chartFilename, msg, lastMsgStatus) {
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

async function buildMessage() {
    const allPositionsData = await getPositionsData();
    const latestPositionData = allPositionsData.slice(allPositionsData.length - 10);
    const numSustainedOccurencesForRelevance = THRESHOLDS.HIGH_LEVEL_OCCURRENCES_FOR_RELEVANCE;
    const numExtremeOccurencesForRelevance = THRESHOLDS.EXTREME_LEVEL_OCCURRENCES_FOR_RELEVANCE;

    /* alert checks */
    const isSustainedHeavyLongs = latestPositionData.reduce(
        (numHeavyLongItems, currentItem) => currentItem.shortLongDiff < -leverageThreshold ? numHeavyLongItems + 1 : numHeavyLongItems, 0) >= numSustainedOccurencesForRelevance;
    const isExtremeLongs = DEBUG_MODE['EXTREME_LONGS'] ? true : latestPositionData.reduce(
        (numHeavyLongItems, currentItem) => currentItem.shortLongDiff < -extremeLeverageThreshold ? numHeavyLongItems + 1 : numHeavyLongItems, 0) >= numExtremeOccurencesForRelevance;
    const isSustainedHeavyShorts = latestPositionData.reduce(
        (numHeavyLongItems, currentItem) => currentItem.shortLongDiff > leverageThreshold ? numHeavyLongItems + 1 : numHeavyLongItems, 0) >= numSustainedOccurencesForRelevance;
    const isExtremeShorts = DEBUG_MODE['EXTREME_SHORTS'] ? true : latestPositionData.reduce(
        (numHeavyLongItems, currentItem) => currentItem.shortLongDiff > extremeLeverageThreshold ? numHeavyLongItems + 1 : numHeavyLongItems, 0) >= numExtremeOccurencesForRelevance;
    const latestFiftyData = allPositionsData.slice(1, 50);
    const isShortLongDiffFlippedSign = latestFiftyData
        .some(
            (item, index) => {
                const currentSign = Math.sign(item.shortLongDiff);
                const previousSign = !!latestFiftyData[index - 1] ? Math.sign(latestFiftyData[index - 1].shortLongDiff) : currentSign;

                return currentSign !== previousSign;
            }
        );

    const msg = buildAlertMsg(
        allPositionsData,
        isShortLongDiffFlippedSign,
        isSustainedHeavyLongs,
        isSustainedHeavyShorts,
        isExtremeLongs,
        isExtremeShorts
    );

    if (isDebugMode) {
        console.log('**************************');
        console.log('*   DEBUG MODE ENABLED   *');
        console.log('**************************');
    }
    console.table([
        ['isShortLongDiffFlippedSign', isShortLongDiffFlippedSign],
        ['isSustainedHeavyLongs', isSustainedHeavyLongs],
        ['isExtremeLongs', isExtremeLongs],
        ['isSustainedHeavyShorts', isSustainedHeavyShorts],
        ['isExtremeShorts', isExtremeShorts],
    ]);

    return msg;
}

module.exports = buildMessage;