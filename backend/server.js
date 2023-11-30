const express = require('express')
const app = express()
app.use(express.json())

app.post('/', (req, res) => {
    // Do something with the request body
    receiveMessage(req)

    // Send an ACK in the response
    res.send('ACK')
})

app.listen(24685, () => {
    console.log('Server is running on port 24685')
})

function receiveMessage(req) {
    console.log('Message received:')
    console.dir(req.body)
}