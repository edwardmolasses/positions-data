const contentful = require("contentful-management");
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const SPACE_ID = process.env.SPACE_ID;

async function getContentfulNumOfEntries() {
    const scopedPlainClient = contentful.createClient(
        {
            accessToken: ACCESS_TOKEN,
        },
        {
            type: 'plain',
            defaults: {
                spaceId: SPACE_ID,
                environmentId: 'master',
            },
        }
    );
    const entries = await scopedPlainClient.entry.getMany({
        query: {
            skip: 0,
            limit: 1000,
        },
    });

    console.log(entries.total);

    return entries.total;
}

module.exports = getContentfulNumOfEntries;