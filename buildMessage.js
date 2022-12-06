const getPositionsData = require('./getPositionsData');
const { DEBUG_MODE, THRESHOLDS } = require('./constants');

const isDebugMode = DEBUG_MODE['EXTREME_LONGS'] || DEBUG_MODE['HOURLY'] || DEBUG_MODE['EXTREME_SHORTS'] || DEBUG_MODE['LOW_TF_LEVERAGE'];

const MSG_NO_ALERT = "NO ALERT";
const MSG_HEAVY_LONGS = "SUSTAINED HEAVY LONGS";
const MSG_HEAVY_SHORTS = "SUSTAINED HEAVY SHORTS";
const MSG_EXTREME_LONGS = "SUSTAINED EXTREME LONGS";
const MSG_EXTREME_SHORTS = "SUSTAINED EXTREME SHORTS";
const SL_DIFF_SIGN_FLIP = "SL DIFF SIGN FLIP";
const SL_1H_EXTREME_CHANGE = "SL 1H EXTREME CHANGE";
const LOW_TIMEFRAME_HIGH_LEVERAGE = "LOW TIMEFRAME HIGH LEVERAGE";
let lastMsgStatus = MSG_NO_ALERT;
let lastMsgTimestamp = null;

const alertEmoji = "\u26A0\uFE0F";
const redEmoji = "\uD83D\uDD34";
const suprisedEmoji = "\uD83D\uDE32";
const bearEmoji = "\uD83D\uDC3B";
const bullEmoji = "\uD83D\uDC02";
const whiteSquare = "\u2B1C";
const blackSquare = "\u2B1B";
const greenSquare = "\uD83D\uDFE9";
const yellowSquare = "\uD83D\uDFE8";
const orangeSquare = "\uD83D\uDFE7";
const redSquare = "\uD83D\uDFE5";
const blueSquare = "\uD83D\uDFE6";
const blackCircle = "\u26AB";

const millionMultiplier = 1000000;
const extremeLowTimeframeLeverageConvictionLevel = 5;
const leverageThreshold = THRESHOLDS.HIGH_LEVERAGE;
const extremeLeverageThreshold = THRESHOLDS.EXTREME_LEVERAGE;

const setLastMsg = (lastMsgStatusStr) => lastMsgStatus = lastMsgStatusStr;
const setLastMsgTimestamp = () => lastMsgTimestamp = Date.now();
const prettifyNum = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const truncateTimestamp = (timestamp) => parseInt(timestamp / 1000);
const isSignNegative = (val) => Math.sign(val) === '-';
const addPercentageSign = (percentage) => percentage !== 0 ? `${!!~Math.sign(percentage) ? '+' : ''}${percentage}%` : '0%';
const diffHours = function (startTime, endTime) {
    const differenceInMiliseconds = endTime - startTime;
    const differenceInSeconds = differenceInMiliseconds / 1000;
    const differenceInMinutes = differenceInSeconds / 60;
    const differenceInHours = differenceInMinutes / 60;

    return Math.abs(differenceInHours);
}
const diffMinutes = function (startTime, endTime) {
    const differenceInMiliseconds = endTime - startTime;
    const differenceInSeconds = differenceInMiliseconds / 1000;
    const differenceInMinutes = differenceInSeconds / 60;

    return Math.abs(differenceInMinutes);
}

const findLastTrend = function (positionsData) {
    let lastDirection = null;
    let lastLastDirection = null;
    let lastLastLastDirection = null;
    let trendStartIndex = null;
    let trendEndIndex = null;
    let latestTrend = null;

    for (let step = 1; step < positionsData.length - 1; step++) {
        const index = positionsData.length - step;
        const currPositionData = positionsData[index];
        const prevPositionData = positionsData[index - 1];

        if (lastDirection && lastLastDirection && lastLastLastDirection) {
            if (!trendEndIndex) {
                if (lastDirection < 0 && lastLastDirection < 0 && lastLastLastDirection < 0) {
                    trendEndIndex = index + 3;
                    latestTrend = -1;
                }
                if (lastDirection > 0 && lastLastDirection > 0 && lastLastLastDirection > 0) {
                    trendEndIndex = index + 3;
                    latestTrend = 1;
                }
            } else {
                if ((lastDirection < 0 && lastLastDirection < 0 && lastLastLastDirection < 0 && latestTrend > 0) ||
                    (lastDirection > 0 && lastLastDirection > 0 && lastLastLastDirection > 0 && latestTrend < 0)) {
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
    const latestTrendChange = endMovingAverage - startMovingAverage;
    const latestTrendPercentChange = Math.round(latestTrendChange / THRESHOLDS.HIGH_LEVERAGE * 100);
    const latestTrendHoursElapsed = diffHours(positionsData[trendStartIndex].timestamp, positionsData[trendEndIndex].timestamp).toFixed(1);

    return { latestTrend, trendStartIndex, trendEndIndex, latestTrendPercentChange, latestTrendHoursElapsed };
}

const getAlertMsgBuildVars = function (allPositionsData) {
    const longShortDiffPercentThreshold = DEBUG_MODE['HOURLY'] ? 1 : THRESHOLDS.SL_DIFF_EXTREME_PERCENT;
    const movingAverageRange = 5;
    const longShortDiffMovingAverage = allPositionsData.map((element, index) => {
        let movingSum = 0;
        if (index > movingAverageRange - 2) {
            for (let step = 0; step < movingAverageRange; step++) {
                movingSum += allPositionsData[index - step].longShortDiff;
            }
            return parseInt(movingSum / movingAverageRange);
        } else {
            return null;
        }
    });
    const updatedAllPositionsData = allPositionsData.map((element, index) => {
        element.movingAverage = longShortDiffMovingAverage[index];
        return element;
    });
    const lastPositionData = allPositionsData[allPositionsData.length - 1];
    const latestTimestamp = truncateTimestamp(allPositionsData[allPositionsData.length - 1].timestamp);
    const allPositionsDataReverse = allPositionsData.reverse();

    const hourAwayFromLatestItem =
        allPositionsData[allPositionsDataReverse.findIndex(item => ((latestTimestamp - truncateTimestamp(item.timestamp)) / 3600) > 1)];
    const longShortDiffPercent1h = Math.ceil((lastPositionData.longShortDiff - hourAwayFromLatestItem.longShortDiff) / hourAwayFromLatestItem.longShortDiff * 100);
    const isLongShortDiffPercentExtreme = Math.abs(longShortDiffPercent1h) > longShortDiffPercentThreshold;

    const dayAwayFromLatestItem =
        allPositionsData[allPositionsDataReverse.findIndex(item => ((latestTimestamp - truncateTimestamp(item.timestamp)) / 3600) > 24)];
    const latestTotalVolume = allPositionsData[allPositionsData.length - 1].shortVolume + allPositionsData[allPositionsData.length - 1].longVolume;
    const dayAwayTotalVolume = dayAwayFromLatestItem.shortVolume + dayAwayFromLatestItem.longVolume;
    const longShortDiffOver24h = lastPositionData.longShortDiff - dayAwayFromLatestItem.longShortDiff;
    const longShortDiffPercent24h = Math.round(longShortDiffOver24h / THRESHOLDS.HIGH_LEVERAGE * 100);
    const volumeTotalsPercent24h = Math.ceil(((latestTotalVolume - dayAwayTotalVolume) / dayAwayTotalVolume) * 100);
    const ratio = parseFloat(lastPositionData.shortVolume / lastPositionData.longVolume).toFixed(2);

    return {
        'lastPositionData': lastPositionData,
        'longShortDiffPercent1h': longShortDiffPercent1h,
        'isLongShortDiffPercentExtreme': isLongShortDiffPercentExtreme,
        'longShortDiffPercent24h': longShortDiffPercent24h,
        'volumeTotalsPercent24h': volumeTotalsPercent24h,
        'updatedAllPositionsData': updatedAllPositionsData,
        'ratio': ratio
    }
}

const getSentimentMeter = function (animal, level) {
    let meter = '';
    let animalEmoji = animal === 'bull' ? bullEmoji : bearEmoji;

    for (let step = 0; step < level; step++) {
        meter += animalEmoji;
    }
    for (let step = 0; step < 5 - level; step++) {
        meter += blackSquare;
    }

    return meter;
}

const buildConvictionMeter = function (convictionLevel) {
    const meterSquares = [
        greenSquare,
        greenSquare,
        yellowSquare,
        yellowSquare,
        orangeSquare,
        orangeSquare,
        orangeSquare,
        redSquare,
        redSquare,
        redSquare
    ];
    let meter = '';
    convictionLevel = convictionLevel > 10 ? 10 : convictionLevel;

    for (let step = 0; step < convictionLevel; step++) {
        meter += meterSquares[step] + ' ';
    }
    for (let step = 0; step < 10 - convictionLevel; step++) {
        meter += blackSquare + ' ';
    }

    return `\n\n<b><u><i>CONVICTION LEVEL (${convictionLevel} of 10):</i></u></b>\n${meter}\n\n`;
}

const getLeverageConviction = function (longShortDiff, minorLimit, majorLimit, rangeMin, rangeMax) {
    const convictionPercentage = ((longShortDiff - minorLimit) * 100) / (majorLimit - minorLimit);
    if (longShortDiff < minorLimit || longShortDiff > majorLimit) return 0;

    return rangeMin + (convictionPercentage / (100 / (rangeMax - rangeMin))).toFixed(2);
}

const getLowTimeframeChangeConviction = function (longShortDiff, latestTrendPercentChange, latestTrendHoursElapsed) {
    const checkPercentChange = Math.abs(latestTrendPercentChange) > THRESHOLDS.LOW_TF_EXTREME_PERCENT;
    const checkTrendHoursElapsed = Math.abs(latestTrendHoursElapsed) < THRESHOLDS.LOW_TF_EXTREME_MAX_HOURS;
    const convictionPercentage = (Math.abs(longShortDiff) / THRESHOLDS.LOW_TF_EXTREME_SL_DIFF * 100 / 33.3) +
        (Math.abs(latestTrendPercentChange / THRESHOLDS.LOW_TF_EXTREME_PERCENT) * 100 / 33.3) +
        (1 - Math.abs(latestTrendHoursElapsed - THRESHOLDS.LOW_TF_EXTREME_MAX_HOURS) / THRESHOLDS.LOW_TF_EXTREME_MAX_HOURS) * 100 / 33.3;

    if (convictionPercentage > 0 && checkPercentChange && checkTrendHoursElapsed) {
        if (convictionPercentage > 100) {
            return 10;
        } else {
            return (convictionPercentage / 10).toFixed(2);
        }
    } else {
        return 0;
    }
}

const getHeavyLeverageMessage = function (isHeavyLongs, isHeavyShorts, sentimentLevel) {
    const extremeBullishSentiment = 5;
    const isExtreme = sentimentLevel >= extremeBullishSentiment ? true : false;
    let msg = '';
    let biggerVol;
    let smallerVol;
    let feeling;

    if (isHeavyLongs && !isHeavyShorts) {
        biggerVol = 'long';
        smallerVol = 'short';
        feeling = 'bull';
    }
    if (!isHeavyLongs && isHeavyShorts) {
        biggerVol = 'short';
        smallerVol = 'long';
        feeling = 'bear';
    }

    msg += isExtreme
        ? `\nLeveraged ${biggerVol.toUpperCase()} Positions on GMX have hit an extreme level relative to ${smallerVol.toUpperCase()} in the past hour`
        : `\nLeveraged ${biggerVol.toUpperCase()} positions on GMX are at high levels relative to ${smallerVol.toUpperCase()}`;
    msg += `\n\nTraders are feeling <b><i>${feeling}ish</i></b> \n${getSentimentMeter(feeling, sentimentLevel)}`;
    msg += isExtreme && DEBUG_MODE['GIRAFFLE_MODE']
        ? `\n\n<b><u><i>HINT</i></u></b>: Take a <b><i>${smallerVol.toUpperCase()} POSITION</b></i> soon`
        : `\n\n<b><u><i>HINT</i></u></b>: If this keeps up, prepare to <b><i>${smallerVol.toUpperCase()}</b></i>`;

    return msg;
}

const getFlippedSignMessage = function (isLongShortDiffFlippedSign, shortVolume, longVolume) {
    const longShortDiffSignMsg = shortVolume > longVolume ? "Shorts are now outnumbering Longs" : "Longs are now outnumbering Shorts";
    return isLongShortDiffFlippedSign ? `\n<b><u><i>RATIO FLIPPED</i></u></b>:  ${longShortDiffSignMsg}` : '';
}

const getLowTimeframeMessage = function (latestTrend, percentChange, timeElapsed, convictionLevel) {
    const highConvictionLevel = 7;
    const latestTrendSign = latestTrend > 0 ? '+' : '-';
    const biggerVol = isSignNegative(percentChange) ? 'long' : 'short';
    const smallerVol = isSignNegative(percentChange) ? 'short' : 'long';
    const feeling = isSignNegative(percentChange) ? 'bull' : 'bear';
    const isHighConviction = convictionLevel > highConvictionLevel || (DEBUG_MODE['GIRAFFLE_MODE'] && convictionLevel > highConvictionLevel);
    let msg = '';

    msg += `\n<b><u><i>L/S DIFFERENCE VOLATILITY</i></u></b>:  ${percentChange}% in the past ${timeElapsed} hour${timeElapsed > 0 ? 's' : ''}. `;
    msg += `Traders are <b><i>${biggerVol}ing</i></b> more than <b><i>${smallerVol}ing</i></b>, meaning they are <b><i>${feeling}ish</b></i>\n\n${getSentimentMeter(feeling, 4)}\n`;
    msg += isHighConviction ? `\n<b><u><i>HINT</i></u></b>: Take a <b><i>${smallerVol.toUpperCase()} POSITION</b></i> soon` : '';

    return msg;
}

const buildMessageTitle = (isExtremeLongs, isExtremeShorts, isExtremeLowTimeframeLeverage) => {
    const debugModeMsg = isDebugMode ? ` (this is a test please ignore)` : '';
    const highAlert = isExtremeLongs || isExtremeShorts || isExtremeLowTimeframeLeverage;
    const alertTypeName = highAlert ? 'HIGH ALERT' : 'ALERT';
    const emoji = highAlert ? alertEmoji : redEmoji;

    return `${emoji} <b><u><i>${alertTypeName} ${debugModeMsg}</i></u></b> ${emoji}\n`;
}

const buildDeactivatedAlertMsg = function (lastMsgStatus) {
    let msg = '';

    if (lastMsgStatus === MSG_EXTREME_LONGS || lastMsgStatus === MSG_HEAVY_LONGS) {
        msg += 'Leveraged LONGS are back to normal levels. '
    }
    if (lastMsgStatus === MSG_EXTREME_SHORTS || lastMsgStatus === MSG_HEAVY_SHORTS) {
        msg += 'Leveraged SHORTS are back to normal levels. '
    }
    if (lastMsgStatus === LOW_TIMEFRAME_HIGH_LEVERAGE) {
        msg += 'Leveraged Positions are back to normal levels. '
    }

    msg += 'Alert is no longer in effect.'

    return msg;
}

const getMessageStats = (
    shortVolume,
    longVolume,
    longShortDiff,
    volumeTotalsPercent24h,
    longShortDiffPercent24h,
    isExtremeLeverage,
    latestTrendPercentChange,
    latestTrendHoursElapsed
) => {
    const extremeLowTimeframeLeverageEmoji = latestTrendPercentChange > 0 ? bearEmoji : latestTrendPercentChange < 0 ? bullEmoji : '';
    const longShortDiffPercent24hEmoji = longShortDiffPercent24h > 0 ? bearEmoji : longShortDiffPercent24h < 0 ? bullEmoji : '';
    let msg = '\n';

    msg += `<pre>`;
    msg += `Short Volume   $${prettifyNum(shortVolume)}\n`;
    msg += `Long Volume    $${prettifyNum(longVolume)}\n`;
    msg += `L/S Difference $${prettifyNum(longShortDiff)}\n`;
    msg += ` Diff Latest%  ${addPercentageSign(latestTrendPercentChange)} (${latestTrendHoursElapsed} hour${latestTrendHoursElapsed > 0 ? 's' : ''}) ${extremeLowTimeframeLeverageEmoji}\n`;
    msg += ` Diff 24h%     ${addPercentageSign(longShortDiffPercent24h)} ${longShortDiffPercent24hEmoji} ${isExtremeLeverage ? suprisedEmoji : ''}\n`;
    msg += `Total Volume   $${prettifyNum(shortVolume + longVolume)} (${addPercentageSign(volumeTotalsPercent24h)})\n`;
    // msg += `L/S Diff Std Deviation  $${prettifyNum(parseInt(longShortDiffStandardDeviation))}\n`;
    msg += `</pre>`

    return msg;
}

const buildDailyDigest = async function (allPositionsData) {
    const dateObj = new Date();
    const pst = dateObj.toLocaleString('en-US', {
        timeZone: 'America/Los_Angeles',
        month: 'long',
        day: 'numeric'
    });
    const { lastPositionData,
        longShortDiffPercent1h,
        isLongShortDiffPercentExtreme,
        longShortDiffPercent24h,
        volumeTotalsPercent24h,
        updatedAllPositionsData,
        ratio } = getAlertMsgBuildVars(allPositionsData);
    const { latestTrend,
        trendStartIndex,
        trendEndIndex,
        latestTrendPercentChange,
        latestTrendHoursElapsed } = findLastTrend(updatedAllPositionsData);
    const extremeLeverageConviction = DEBUG_MODE['EXTREME_LONGS']
        ? THRESHOLDS.EXTREME_LONGS_THRESHOLD
        : getLeverageConviction(
            lastPositionData.longShortDiff,
            THRESHOLDS.EXTREME_LEVERAGE,
            THRESHOLDS.MAX_EXTREME_LEVERAGE,
            8,
            10
        );
    const sustainedHeavyLeverageConviction = getLeverageConviction(
        lastPositionData.longShortDiff,
        THRESHOLDS.LOWER_HIGH_LEVERAGE,
        THRESHOLDS.EXTREME_LEVERAGE,
        3,
        7
    );
    const lowTimeframeLeverageConviction = DEBUG_MODE['LOW_TF_LEVERAGE'] ? 8 : getLowTimeframeChangeConviction(lastPositionData.longShortDiff, latestTrendPercentChange, latestTrendHoursElapsed);
    let msgTitle = `<b><u><i>DAILY DIGEST for ${pst}</i></u></b>\n`;
    let msgDetail = '';

    // msgDetail += buildConvictionMeter(Math.max(extremeLeverageConviction, sustainedHeavyLeverageConviction, lowTimeframeLeverageConviction));
    msgDetail += getMessageStats(
        lastPositionData.shortVolume,
        lastPositionData.longVolume,
        lastPositionData.longShortDiff,
        volumeTotalsPercent24h,
        longShortDiffPercent24h,
        extremeLeverageConviction,
        latestTrendPercentChange,
        latestTrendHoursElapsed
    );

    return msgTitle + msgDetail;
}

const buildAlertMessage = function (
    allPositionsData,
    isLongShortDiffFlippedSign,
    isSustainedHeavyLongs,
    isSustainedHeavyShorts,
    isExtremeLongs,
    isExtremeShorts
) {
    const { lastPositionData,
        longShortDiffPercent1h,
        isLongShortDiffPercentExtreme,
        longShortDiffPercent24h,
        volumeTotalsPercent24h,
        updatedAllPositionsData,
        ratio } = getAlertMsgBuildVars(allPositionsData);
    const { latestTrend,
        trendStartIndex,
        trendEndIndex,
        latestTrendPercentChange,
        latestTrendHoursElapsed } = findLastTrend(updatedAllPositionsData);
    const sustainedHeavyLeverageConviction = getLeverageConviction(
        lastPositionData.longShortDiff,
        THRESHOLDS.LOWER_HIGH_LEVERAGE,
        THRESHOLDS.EXTREME_LEVERAGE,
        3,
        7
    );
    const extremeLeverageConviction = DEBUG_MODE['EXTREME_LONGS']
        ? THRESHOLDS.EXTREME_LONGS_THRESHOLD
        : getLeverageConviction(
            lastPositionData.longShortDiff,
            THRESHOLDS.EXTREME_LEVERAGE,
            THRESHOLDS.MAX_EXTREME_LEVERAGE,
            8,
            10
        );
    const lowTimeframeLeverageConviction = DEBUG_MODE['LOW_TF_LEVERAGE'] ? 8 : getLowTimeframeChangeConviction(lastPositionData.longShortDiff, latestTrendPercentChange, latestTrendHoursElapsed);
    const isExtremeLowTimeframeLeverage = lowTimeframeLeverageConviction > extremeLowTimeframeLeverageConvictionLevel;
    const isHighLeverageAlert =
        DEBUG_MODE['EXTREME_LONGS'] ||
        DEBUG_MODE['LOW_TF_LEVERAGE'] ||
        extremeLeverageConviction ||
        sustainedHeavyLeverageConviction ||
        isExtremeLowTimeframeLeverage;
    const minutesSinceLastAlert = diffMinutes(lastMsgTimestamp, Date.now());
    const ishalfHourElapsedFromLastAlert = lastMsgTimestamp ? minutesSinceLastAlert >= 30 : true;
    let msgTitle = '';
    let msgDetail = '';

    if (isHighLeverageAlert || isLongShortDiffFlippedSign) {
        msgTitle = buildMessageTitle(isExtremeLongs, isExtremeShorts, isExtremeLowTimeframeLeverage);
        msgDetail = '';
        console.log('lastMsgStatus: ', lastMsgStatus);

        if ((lastMsgStatus !== MSG_EXTREME_LONGS || ishalfHourElapsedFromLastAlert) && (DEBUG_MODE['EXTREME_LONGS'] || extremeLeverageConviction && isExtremeLongs)) {
            msgDetail = getHeavyLeverageMessage(DEBUG_MODE['EXTREME_LONGS'] || isExtremeLongs, isExtremeShorts, 5);
            msgDetail += buildConvictionMeter(extremeLeverageConviction);
            setLastMsg(MSG_EXTREME_LONGS);
        } else if ((lastMsgStatus !== MSG_EXTREME_SHORTS || ishalfHourElapsedFromLastAlert) && extremeLeverageConviction && isExtremeShorts) {
            msgDetail = getHeavyLeverageMessage(DEBUG_MODE['EXTREME_LONGS'] || isExtremeLongs, isExtremeShorts, 5);
            msgDetail += buildConvictionMeter(extremeLeverageConviction);
            setLastMsg(MSG_EXTREME_SHORTS);
        } else if ((lastMsgStatus !== LOW_TIMEFRAME_HIGH_LEVERAGE || ishalfHourElapsedFromLastAlert) && (DEBUG_MODE['LOW_TF_LEVERAGE'] || isExtremeLowTimeframeLeverage)) {
            msgDetail = getLowTimeframeMessage(latestTrend, latestTrendPercentChange, latestTrendHoursElapsed, lowTimeframeLeverageConviction);
            msgDetail += buildConvictionMeter(lowTimeframeLeverageConviction);
            setLastMsg(LOW_TIMEFRAME_HIGH_LEVERAGE);
        } else if ((lastMsgStatus !== MSG_HEAVY_LONGS || ishalfHourElapsedFromLastAlert) && sustainedHeavyLeverageConviction && isSustainedHeavyLongs) {
            msgDetail = getHeavyLeverageMessage(isSustainedHeavyLongs, isSustainedHeavyShorts, 3);
            msgDetail += buildConvictionMeter(sustainedHeavyLeverageConviction);
            setLastMsg(MSG_HEAVY_LONGS);
        } else if ((lastMsgStatus !== MSG_HEAVY_SHORTS || ishalfHourElapsedFromLastAlert) && sustainedHeavyLeverageConviction && isSustainedHeavyShorts) {
            msgDetail = getHeavyLeverageMessage(isSustainedHeavyLongs, isSustainedHeavyShorts, 3);
            msgDetail += buildConvictionMeter(sustainedHeavyLeverageConviction);
            setLastMsg(MSG_HEAVY_SHORTS);
        }

        // if there is an alert
        if (msgDetail) {
            setLastMsgTimestamp();
            msgDetail += getMessageStats(
                lastPositionData.shortVolume,
                lastPositionData.longVolume,
                lastPositionData.longShortDiff,
                volumeTotalsPercent24h,
                longShortDiffPercent24h,
                extremeLeverageConviction,
                latestTrendPercentChange,
                latestTrendHoursElapsed
            );
            console.log('lastMsgTimestamp: ', lastMsgTimestamp)
            return msgTitle + msgDetail;
        }
    } else {
        if (lastMsgStatus && lastMsgStatus !== MSG_NO_ALERT) {
            msgTitle = `<b><u><i>ALERT DEACTIVATED</i></u></b> \n\n`;
            msgDetail = buildDeactivatedAlertMsg(lastMsgStatus);
            setLastMsg(MSG_NO_ALERT);

            return msgTitle + msgDetail;
        }
        setLastMsg(MSG_NO_ALERT);

        return false;
    }
}

function getStandardDeviation(allPositionsData) {
    const allPositionslongShortDiffMean =
        allPositionsData
            .reduce((previousValue, currentValue) => previousValue + parseInt(currentValue.longShortDiff), 0) / allPositionsData.length;
    const varianceDataPoints = allPositionsData.map(dataPoint => {
        const variance = parseInt(dataPoint.longShortDiff - allPositionslongShortDiffMean);
        return variance * variance;
    });
    const sumOfVariance = varianceDataPoints.reduce((previousValue, currentValue) => previousValue + currentValue, 0);
    const longShortDiffStandardDeviation = Math.sqrt(sumOfVariance / (allPositionsData.length - 1));

    return longShortDiffStandardDeviation;
}

async function getAlertMessage() {
    const allPositionsData = await getPositionsData();
    const latestPositionData = allPositionsData.slice(allPositionsData.length - 10);
    const numSustainedOccurencesForRelevance = THRESHOLDS.HIGH_LEVEL_OCCURRENCES_FOR_RELEVANCE;
    const numExtremeOccurencesForRelevance = THRESHOLDS.EXTREME_LEVEL_OCCURRENCES_FOR_RELEVANCE;

    /* alert checks */
    const isSustainedHeavyLongs = latestPositionData.reduce(
        (numHeavyLongItems, currentItem) => currentItem.longShortDiff < -leverageThreshold ? numHeavyLongItems + 1 : numHeavyLongItems, 0) >= numSustainedOccurencesForRelevance;
    const isExtremeLongs = DEBUG_MODE['EXTREME_LONGS'] ? true : latestPositionData.reduce(
        (numHeavyLongItems, currentItem) => currentItem.longShortDiff < -extremeLeverageThreshold ? numHeavyLongItems + 1 : numHeavyLongItems, 0) >= numExtremeOccurencesForRelevance;
    const isSustainedHeavyShorts = latestPositionData.reduce(
        (numHeavyLongItems, currentItem) => currentItem.longShortDiff > leverageThreshold ? numHeavyLongItems + 1 : numHeavyLongItems, 0) >= numSustainedOccurencesForRelevance;
    const isExtremeShorts = DEBUG_MODE['EXTREME_SHORTS'] ? true : latestPositionData.reduce(
        (numHeavyLongItems, currentItem) => currentItem.longShortDiff > extremeLeverageThreshold ? numHeavyLongItems + 1 : numHeavyLongItems, 0) >= numExtremeOccurencesForRelevance;
    const latestFiftyData = allPositionsData.slice(1, 50);
    const isLongShortDiffFlippedSign = latestFiftyData
        .some(
            (item, index) => {
                const currentSign = Math.sign(item.longShortDiff);
                const previousSign = !!latestFiftyData[index - 1] ? Math.sign(latestFiftyData[index - 1].longShortDiff) : currentSign;

                return currentSign !== previousSign;
            }
        );

    const msg = buildAlertMessage(
        allPositionsData,
        isLongShortDiffFlippedSign,
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
        ['isLongShortDiffFlippedSign', isLongShortDiffFlippedSign],
        ['isSustainedHeavyLongs', isSustainedHeavyLongs],
        ['isExtremeLongs', isExtremeLongs],
        ['isSustainedHeavyShorts', isSustainedHeavyShorts],
        ['isExtremeShorts', isExtremeShorts],
    ]);

    return msg;
}

async function getDailyDigestMessage() {
    const allPositionsData = await getPositionsData();
    const msg = buildDailyDigest(allPositionsData);

    return msg;
}

module.exports = {
    getAlertMessage,
    getDailyDigestMessage
}