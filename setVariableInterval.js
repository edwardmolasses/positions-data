function getRandomArbitrary(intervalMinutes) {
    return parseInt(Math.random() * (intervalMinutes - 1) + 1);
}

function getInterval(intervalMinutes, isVariable) {
    const second = 1000;
    const minute = 60 * second;

    return (isVariable ? getRandomArbitrary(intervalMinutes) : intervalMinutes) * minute;
}

async function setVariableInterval(execFunction, intervalMinutes = 30, isVariable = true) {
    let minutes = getInterval(intervalMinutes, isVariable);
    const intervalFunction = async function () {
        minutes = getInterval(intervalMinutes, isVariable);
        console.log('minuteInterval', minutes / 60000);
        await execFunction();
        setTimeout(intervalFunction, minutes);
    }

    setTimeout(intervalFunction);
}

module.exports = setVariableInterval;