const PORT = 24686

const fs = require('fs')

const express = require('express')
const app = express()
app.use(express.json())

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
    }
}

function processClick(msg) {
    // Write the click to the clicks file
    fs.appendFileSync("./telemetry/clicks.txt", JSON.stringify(msg) + "\n")
}

function processReplay(msg) {
    // Write the replay to its own file
    const date = new Date()

    const replayPath = `./telemetry/replays/Replay from ${date.getFullYear()}-${date.getMonth()+1}-${date.getDay()} at ${date.getHours()}.${date.getMinutes()}.${date.getSeconds()}`

    fs.writeFileSync(replayPath, JSON.stringify(msg.replay))
}