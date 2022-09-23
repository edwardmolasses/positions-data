const getPositionsData = require('./getPositionsData');
const { Api, TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { CustomFile } = require("telegram/client/uploads");
const puppeteer = require("puppeteer");
const fs = require('fs')

const TG_API_ID = parseInt(process.env.TG_API_ID);
const TG_API_HASH = process.env.TG_API_HASH;
const TG_AUTH_KEY = process.env.TG_AUTH_KEY;
const MSG_NO_ALERT = "NO ALERT";
const MSG_HEAVY_LONGS = "SUSTAINED HEAVY LONGS";
const MSG_HEAVY_SHORTS = "SUSTAINED HEAVY SHORTS";
const MSG_EXTREME_LONGS = "SUSTAINED EXTREME LONGS";
const MSG_EXTREME_SHORTS = "SUSTAINED EXTREME SHORTS";
const millionMultiplier = 1000000;
const leverageThreshold = 50 * millionMultiplier;
const extremeLeverageThreshold = 70 * millionMultiplier;
const remoteChartUrl = 'http://floating-hamlet-81093.herokuapp.com';
const remoteChartWidth = 1030;
const remoteChartHeight = 675;
const chartFilename = 'chart.png';
const setLastMsg = (lastMsgStatusStr) => lastMsgStatus = lastMsgStatusStr;
let lastMsgStatus = MSG_NO_ALERT;

async function sendTelegramMessages() {
    const allPositionsData = await getPositionsData();
    const latestPositionData = allPositionsData.slice(allPositionsData.length - 10);
    const lastPositionData = allPositionsData[allPositionsData.length - 1];
    const isSustainedHeavyLongs = true;
    // const isSustainedHeavyLongs = latestPositionData.reduce(
    //     (numHeavyLongItems, currentItem) => currentItem.shortLongDiff < -leverageThreshold ? numHeavyLongItems + 1 : numHeavyLongItems, 0) >= 5;
    const prettifyNum = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const isExtremeLongs = latestPositionData.reduce(
        (numHeavyLongItems, currentItem) => currentItem.shortLongDiff < -extremeLeverageThreshold ? numHeavyLongItems + 1 : numHeavyLongItems, 0) >= 2;
    const isSustainedHeavyShorts = latestPositionData.reduce(
        (numHeavyLongItems, currentItem) => currentItem.shortLongDiff > leverageThreshold ? numHeavyLongItems + 1 : numHeavyLongItems, 0) >= 5;
    const isExtremeShorts = latestPositionData.reduce(
        (numHeavyLongItems, currentItem) => currentItem.shortLongDiff > extremeLeverageThreshold ? numHeavyLongItems + 1 : numHeavyLongItems, 0) >= 2;

    const sendMsg = async function (msg) {
        if (msg) {
            const session = new StringSession(TG_AUTH_KEY); // You should put your string session here
            const client = new TelegramClient(session, TG_API_ID, TG_API_HASH, {});
            await client.connect();

            const result = await client.invoke(
                new Api.messages.SendMedia({
                    peer: "edwardmolasses",
                    // peer: "robertplankton",
                    media: new Api.InputMediaUploadedPhoto({
                        file: await client.uploadFile({
                            file: new CustomFile(
                                chartFilename,
                                fs.statSync(`./${chartFilename}`).size,
                                `./${chartFilename}`
                            ),
                            workers: 1,
                        }),
                    }),
                    message: msg,
                    noforwards: true,
                })
            );
        }
    }

    const buildTelegramMsg = function (isSustainedHeavyLongs, isSustainedHeavyShorts, isExtremeLongs, isExtremeShorts) {
        let msg = "";
        if (isSustainedHeavyLongs || isSustainedHeavyShorts || isExtremeLongs || isExtremeShorts) {
            const ratio = parseFloat(lastPositionData.shortVolume / lastPositionData.longVolume).toFixed(2);
            const msgTitle = (isExtremeLongs, isExtremeShorts) => `*** ${isExtremeLongs || isExtremeShorts ? `HIGH ` : ``}ALERT ***\n`;
            const msgStats =
                (shortVolume, longVolume, shortLongDiff, ratio) =>
                    `\n\nShort Volume: $${prettifyNum(shortVolume)}\nLong Volume: $${prettifyNum(longVolume)}\nDifference: $${prettifyNum(shortLongDiff)}\nS/L Ratio: ${ratio}`;

            if (isSustainedHeavyLongs || isSustainedHeavyShorts) {
                if (isSustainedHeavyLongs && lastMsgStatus !== MSG_HEAVY_LONGS) {
                    msg += msgTitle(isExtremeLongs, isExtremeShorts);
                    msg += `\nLeveraged Long positions on GMX are at high levels relative to Shorts`;
                    setLastMsg(MSG_HEAVY_LONGS);
                    msg += msgStats(lastPositionData.shortVolume, lastPositionData.longVolume, lastPositionData.shortLongDiff, ratio);
                }
                if (isSustainedHeavyShorts && lastMsgStatus !== MSG_HEAVY_SHORTS) {
                    msg += msgTitle(isExtremeLongs, isExtremeShorts);
                    msg += `\nLeveraged Short positions on GMX are at high levels relative to Longs`;
                    setLastMsg(MSG_HEAVY_SHORTS);
                    msg += msgStats(lastPositionData.shortVolume, lastPositionData.longVolume, lastPositionData.shortLongDiff, ratio);
                }
            }
            if (isExtremeLongs || isExtremeShorts) {
                if (isSustainedHeavyLongs && lastMsgStatus !== MSG_EXTREME_LONGS) {
                    msg += msgTitle(isExtremeLongs, isExtremeShorts)
                    msg += `\nLeveraged Long Positions on GMX have hit an extreme level relative to shorts in the past hour`;
                    setLastMsg(MSG_EXTREME_LONGS);
                    msg += msgStats(lastPositionData.shortVolume, lastPositionData.longVolume, lastPositionData.shortLongDiff, ratio);
                }
                if (isSustainedHeavyShorts && lastMsgStatus !== MSG_EXTREME_SHORTS) {
                    msg += msgTitle(isExtremeLongs, isExtremeShorts)
                    msg += `\nLeveraged Short Positions on GMX have hit an extreme level relative to longs in the past hour`;
                    setLastMsg(MSG_EXTREME_SHORTS);
                    msg += msgStats(lastPositionData.shortVolume, lastPositionData.longVolume, lastPositionData.shortLongDiff, ratio);
                }
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

    const msg = buildTelegramMsg(isSustainedHeavyLongs, isSustainedHeavyShorts, isExtremeLongs, isExtremeShorts);

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
            const url = remoteChartUrl;

            await page.goto(url, { waitUntil: 'networkidle0', timeout: 0 });
            // fs.writeFileSync(`${__dirname}/latest_chart.png`, img);

            setTimeout(async function () {
                await page.screenshot({ path: chartFilename });
                await browser.close();

                await sendMsg(msg);
                console.log('LAST MSG STATUS : ', lastMsgStatus);
            }, 10000);
        });
}

module.exports = sendTelegramMessages;