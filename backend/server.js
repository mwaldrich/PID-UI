const PORT = 24686

const fs = require('fs')

const express = require('express')
const app = express()
app.use(express.json({limit: "1GB" /* ... */}))

// Enable CORS, necessary to be AJAX'd from GitHub Pages
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });

// Log ALL requests, for debugging purposes
app.use(function(req, res, next) {
    console.log(`Request from ${req.ip} @ path ${req.path}: ${req.body.toString()}`)
    console.dir(req.body)
    next()
})

app.post('/', (req, res) => {
    // Do something with the request body
    receiveMessage(req)

    // Send an ACK in the response
    res.send('ACK')
})

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
})

function receiveMessage(req) {
    const msg = req.body
    console.log('Message received:')
    console.dir(msg)

    switch (msg.type) {
        case 'click':
            processClick(msg)
            break;
        case 'replay':
            processReplay(msg)
            break;
        default:
            console.log(`unknown message type: ${msg.type}`)
    }
}

function processClick(msg) {
    // Write the click to the clicks file
    fs.appendFileSync("./telemetry/clicks.txt", JSON.stringify(msg) + "\n")
}

function getCurrentDateTime() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // JavaScript months are 0-based.
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} at ${hours}.${minutes}.${seconds}`;
}

function processReplay(msg) {
    // Write the replay to its own file
    const date = new Date()

    const replayPath = `./telemetry/replays/Replay from ${getCurrentDateTime()}`

    console.log(`Attempting to write replay to ${replayPath}`)
    fs.writeFileSync(replayPath, JSON.stringify(msg.replay))
    console.log(`Finished writing replay to ${replayPath}`)
}