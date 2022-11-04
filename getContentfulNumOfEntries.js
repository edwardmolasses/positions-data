const contentful = require("contentful-management");
const CONTENTFUL_ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const CONTENTFUL_SPACE_ID = process.env.SPACE_ID;

async function getContentfulNumOfEntries() {
    const scopedPlainClient = contentful.createClient(
        {
            accessToken: CONTENTFUL_ACCESS_TOKEN,
        },
        {
            type: 'plain',
            defaults: {
                spaceId: CONTENTFUL_SPACE_ID,
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

    return entries.total;
}

module.exports = getContentfulNumOfEntries;