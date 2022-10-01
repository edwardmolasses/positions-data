const contentful = require("contentful-management");
const CSVToJSON = require('csvtojson');
const CONTENTFUL_ACCESS_TOKEN = process.env.CONTENTFUL_ACCESS_TOKEN;
const CONTENTFUL_SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const getContentfulNumOfEntries = require('./getContentfulNumOfEntries');

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
    const numOfEntries = await getContentfulNumOfEntries();
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
    const getAllContentfulEntries = async function () {
        const items = await Promise.all(
            Array.from(Array(Math.ceil(numOfEntries / 1000)).keys())
                .map(async element => {
                    const response = await scopedPlainClient.entry.getMany({
                        query: {
                            skip: element * 1000,
                            limit: 1000,
                        },
                    });
                    return response.items;
                }));

        return [].concat.apply([], items)
            .map(function (item) {
                return {
                    "timestamp": parseInt(item.fields.timestamp['en-US']),
                    "shortLongDiff": parseInt(item.fields.shortLongDiff['en-US']),
                    "shortVolume": parseInt(item.fields.shortVolume['en-US']),
                    "longVolume": parseInt(item.fields.longVolume['en-US']),
                    "ethPrice": !!item.fields.ethPrice ? parseInt(item.fields.ethPrice['en-US']) : null,
                    "percentPriceChange": !!item.fields.percentPriceChange ? item.fields.percentPriceChange['en-US'] : null,
                }
            })
            .sort((a, b) => a['timestamp'] - b['timestamp']);
    }
    const contentfulRecords = await getAllContentfulEntries();
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