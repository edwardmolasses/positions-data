const { getAlertMessage, getDailyDigestMessage } = require('./buildMessage');
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const puppeteer = require("puppeteer");
const { DEBUG_MODE } = require('./constants');

const isDebugMode = DEBUG_MODE['EXTREME_LONGS'] || DEBUG_MODE['HOURLY'] || DEBUG_MODE['EXTREME_SHORTS'] || DEBUG_MODE['LOW_TF_LEVERAGE'];
const peer = isDebugMode ? 'edwardmolasses' : 'LeverageRatioAlerts';
const TG_API_ID = parseInt(process.env.TG_API_ID);
const TG_API_HASH = process.env.TG_API_HASH;
const TG_AUTH_KEY = isDebugMode ? process.env.TG_AUTH_KEY : process.env.TG_BOT_AUTH_KEY;

// const remoteChartUrl = 'floating-hamlet-81093.herokuapp.com';
const remoteChartUrl = 'localhost:5003';
const remoteChartWidth = 1030;
const remoteChartHeight = 675;
const chartFilename = 'chart.png';

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

async function sendTelegramDailyMessage() {
    const msg = await getDailyDigestMessage();

    await sendMsgByBot(msg);
}

async function sendTelegramAlertMessage() {
    // const msg = await getDailyDigestMessage();

    // await sendMsgByBot(msg);
    const msg = await getAlertMessage();
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
            }, 10000);
        });
}

module.exports = {
    sendTelegramAlertMessage,
    sendTelegramDailyMessage
}