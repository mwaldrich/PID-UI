# HRI_PID_UI

ballbeam.py: backend for calculating PID and communicating through serial 

## PID Values
P: 0 -> .03 -> .05 -> .07 -> .10
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