# HRI_PID_UI

Check out the live website [here](https://mwaldrich.io/PID-UI)! To play around without a robot, simply try a Power value, and then enter `1` for Unit Number and say `OK` to enabling simulation.

This repo contains all the source code for our ball beam balancing project. 

This repo is composed of 3 distinct parts:

1. The robot code: [ballbeam.py](./ballbeam.py), calculates PID and communicates through serial
2. The Web UI: [index.html, *.js](./index.html), drives the robot and communicates through serial
3. The telemetry backend: [backend](./backend), records telemetry data and communicates via HTTP

## PID Values
P: 0 -> .15
I: 0.00001
D: 10

## Data Format
Data from a run can be recorded and played back. Below is the description of this data format:

File format: .json

```json5

{
    datetime: number, // Timestamp in epoch format (use Google Sheets 
                      // EPOCHTODATE function to convert to regular date)
    datetimeHuman: String, // A human readable timestamp. Probably annoying to 
                           // parse in Google Sheets.
    unitNumber: Number, // Unit # to distinguish between different setups
    group: String, // 'experiment' or 'control'
    framerate: Number, // frames per second of the recording

    p: Number, // Self
    i: Number, // explanatory
    d: Number, // ...

    frames: [
        {
            m: Number, // The motor value at this frame
            s: Number  // The sensor value at this frame
        },
        // ...
    ]
}
```
