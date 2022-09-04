function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}

async function setVariableInterval(execFunction, intervalMinutes = 30) {
    const second = 1000;
    const minute = 60 * second;
    let minutesFactor = parseInt(getRandomArbitrary(1, intervalMinutes));

    const intervalFunction = async function () {
        minutesFactor = parseInt(getRandomArbitrary(1, intervalMinutes));
        console.log('minuteInterval', minutesFactor);
        await execFunction();
        setTimeout(intervalFunction, minutesFactor * minute);
    }

    setTimeout(intervalFunction, minutesFactor);
}

module.exports = setVariableInterval;