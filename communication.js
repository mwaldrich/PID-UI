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
    
    fetch(`https://silicon.mwaldrich.io/pid-backend/`, 
          {method: 'POST', 
           headers: {"Content-Type": "application/json"}, 
           body: JSON.stringify(payload)})
}

// Full replays
function msg_uploadReplay(replay) {
    msg({type: "replay", replay: replay})
}


// Clicks
function msg_clickedSimulate(p, i, d) {
    msg({type: "click", button: "simulate", p: p, i: i, d: d})
}

function msg_clickedStart(p, i, d) {
    msg({type: "click", button: "start", p: p, i: i, d: d})
}

function msg_clickedStop(p, i, d) {
    msg({type: "click", button: "stop", p: p, i: i, d: d})
}