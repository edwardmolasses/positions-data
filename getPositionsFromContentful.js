const contentful = require("contentful-management");
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const SPACE_ID = process.env.SPACE_ID;

async function getContentfulData() {
    const client = contentful.createClient({ accessToken: ACCESS_TOKEN });

    return client.getSpace(SPACE_ID)
        .then((space) => space.getEnvironment('master'))
        .then((environment) => environment.getEntries('positions', {
        }))
        .then((entries) => {
            return entries.items.map(function (entry) {
                return {
                    "timestamp": parseInt(entry.fields.timestamp['en-US']),
                    "shortLongDiff": parseInt(entry.fields.shortLongDiff['en-US']),
                    "shortVolume": parseInt(entry.fields.shortVolume['en-US']),
                    "longVolume": parseInt(entry.fields.longVolume['en-US']),
                    "ethPrice": !!entry.fields.ethPrice['en-US'] ? parseInt(entry.fields.ethPrice['en-US']) : null
                }
            });
        })
        .catch(console.error);
}

async function getPositionsFromContentful() {
    return await getContentfulData();
}

module.exports = getPositionsFromContentful;