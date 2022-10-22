const millionsMultiplier = 1000000;

module.exports = {
    THRESHOLDS: {
        LOW_TF_EXTREME_PERCENT: 25,
        LOW_TF_EXTREME_MAX_HOURS: 4,
        LOW_TF_EXTREME_SL_DIFF: 55 * millionsMultiplier,
        HIGH_LEVEL_OCCURRENCES_FOR_RELEVANCE: 4,
        EXTREME_LEVEL_OCCURRENCES_FOR_RELEVANCE: 2,
        LOWER_HIGH_LEVERAGE: 40 * millionsMultiplier,
        HIGH_LEVERAGE: 50 * millionsMultiplier,
        EXTREME_LEVERAGE: 59 * millionsMultiplier,
        MAX_EXTREME_LEVERAGE: 85 * millionsMultiplier,
        SL_DIFF_EXTREME_PERCENT: 50
    },
    DEBUG_MODE: {
        HOURLY: false,
        EXTREME_LONGS: true,
        EXTREME_SHORTS: false,
        GIRAFFLE_MODE: true,
    },
    ACCEPT_STRINGS: {
        defaultAccept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/png,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
        firefox92andLater: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        firefox72to91: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        firefox66to71: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        firefox65: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        firefox64andEarlier: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        safariAndChrome: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        safari5: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ie8: 'image/jpeg, application/x-ms-application, image/gif, application/xaml+xml, image/pjpeg, application/x-ms-xbap, application/x-shockwave-flash, application/msword, */*',
        edge: 'text/html, application/xhtml+xml, image/jxr, */*',
        opera: 'text/html, application/xml;q=0.9, application/xhtml+xml, image/png, image/webp, image/jpeg, image/gif, image/x-xbitmap, */*;q=0.1'
    }
};