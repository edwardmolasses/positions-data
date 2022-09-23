const contentful = require("contentful-management");
const CSVToJSON = require('csvtojson');
const CONTENTFUL_ACCESS_TOKEN = process.env.CONTENTFUL_ACCESS_TOKEN;
const CONTENTFUL_SPACE_ID = process.env.CONTENTFUL_SPACE_ID;

async function getPositionsFromCsv() {
    return CSVToJSON().fromFile('positions.csv')
        .then(positions => {
            return positions.map(row => {
                return {
                    "timestamp": parseInt(row['timestamp']),
                    "shortLongDiff": parseInt(row['shortLongDiff']),
                    "shortVolume": parseInt(row['shortVolume']),
                    "longVolume": parseInt(row['longVolume']),
                    "ethPrice": !!row['ethPrice'] ? parseInt(row['ethPrice']) : null,
                    "percentPriceChange": !!row['percentPriceChange'] ? row['percentPriceChange'] : null
                }
            });
        }).catch(err => {
            // log error if any
            console.log(err);
        });
}

async function getAllPositionsData() {
    const positionsFromCsv = (await getPositionsFromCsv()).sort((a, b) => a['timestamp'] - b['timestamp']);
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
    const contentfulRecords = entries.items
        .map(function (entry) {
            return {
                "timestamp": parseInt(entry.fields.timestamp['en-US']),
                "shortLongDiff": parseInt(entry.fields.shortLongDiff['en-US']),
                "shortVolume": parseInt(entry.fields.shortVolume['en-US']),
                "longVolume": parseInt(entry.fields.longVolume['en-US']),
                "ethPrice": !!entry.fields.ethPrice ? parseInt(entry.fields.ethPrice['en-US']) : null,
                "percentPriceChange": !!entry.fields.percentPriceChange ? entry.fields.percentPriceChange['en-US'] : null,
            }
        })
        .sort((a, b) => a['timestamp'] - b['timestamp']);
    const earlistContentfulTimestamp = contentfulRecords[0]['timestamp'];
    const csvSliceIndex = positionsFromCsv.findIndex(csvRecord => csvRecord.timestamp >= earlistContentfulTimestamp);
    const usablePositionsFromCsv = positionsFromCsv.slice(0, csvSliceIndex);

    return usablePositionsFromCsv.concat(contentfulRecords);
}

async function getPositionsData() {
    const allPositionsData = await getAllPositionsData();
    return allPositionsData;
}

module.exports = getPositionsData;