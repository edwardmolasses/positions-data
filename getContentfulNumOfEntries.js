const contentful = require("contentful-management");
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const SPACE_ID = process.env.SPACE_ID;

async function getContentfulNumOfEntries() {
    const client = contentful.createClient({ accessToken: ACCESS_TOKEN });

    return client.getSpace(SPACE_ID)
        .then((space) => space.getEnvironment('master'))
        .then((environment) => environment.getEntries('positions', {
            skip: 0,
            limit: 1000
        }))
        .then((entries) => {
            return entries.items.length;
        })
        .catch(console.error);
}

module.exports = getContentfulNumOfEntries;