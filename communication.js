// Retrieve device settings
function fetchSettings() {
    while (!document.cookie) {
        enterSettings()
    }
    if (document.cookie) {
        return JSON.parse(document.cookie.split('=')[1])
    } else {
        return {unitNumber: -1, group: undefined}
    }
}

function newReplayDataSkeleton(p, i, d) {
    return {
        ...fetchSettings(),
        datetime: new Date().getTime(),
        datetimeHuman: new Date().toString(),
        p: p,
        i: i,
        d: d,

        frames: []
    }
}


// Actually send a message.
function msg(payload) {
    const settings = fetchSettings()
    payload.unitNumber = settings.unitNumber
    payload.group = settings.group
    payload.datetime = new Date().getTime()
    payload.datetimeHuman = new Date().toString()

    console.log(`Sending message to backend: ${JSON.stringify(payload)}`)
    /*
    fetch(`https://silicon.mwaldrich.io/pid-backend/`, 
          {method: 'POST', 
           headers: {"Content-Type": "application/json"}, 
           body: JSON.stringify(payload)})*/
}

// Full replays
function msg_uploadReplay(replay) {
    msg({type: "replay", replay: replay})
}


// Clicks
function msg_clickedStart(p, i, d) {
    msg({type: "click", button: "start"})
}

function msg_clickedStop() {
    msg({type: "click", button: "stop"})
}