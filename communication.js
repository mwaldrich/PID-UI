function msg(payload) {
    payload.datetime = new Date().getTime()
    payload.datetimeHuman = new Date().toString()

    fetch(`https://${window.location.host}/pid-backend/`, 
          {method: 'POST', 
           headers: {"Content-Type": "application/json"}, 
           body: JSON.stringify(payload)})
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
