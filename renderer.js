// Rendering constants: what let us make sense of the random numbers.
// All distances, diameters, radii, and other dimensions are strictly in
// MILLIMETERS.

const beamWidth = 420//mm
const beamHeight = 8.6//mm

const ballDiameter = 20//mm

const viewportWidth = 450//mm
const viewportHeight = 350//mm (yes, the viewport dimensions are in mm)

// Scaling factors. These scalars relate the raw numbers from the sensors
// into millimeters.
const motorScale = /* 1mm = */ 0.09 /* unit(s) of motor movement */
const sensorScale = /* 1mm = */ 1 /* unit(s) of sensor movement */

// The viewport scale relates each physical pixel to the size of a mm.
// Bump this up to increase the *quality* of the render.
let viewportScale = 2//pixel(s)^2 = 1mm


///////////////////////////////////////////////////////////////////////////////
// Actual rendering logic below

class Renderer {
    // Construct a new renderer, rendering onto the given canvas `c`.
    // `type` should be 'live' or 'sim'
    constructor(c, type) {
        this.canvas = c
        this.ctx = this.canvas.getContext('2d')
        this.type = type

        // Keep track of the replay data
        this.replayData = undefined

        // Are we recording right now?

        // Should we be playing a replay rn?
        this.playReplay = false


        // The current sensor and motor values
        this.s = null
        this.m = null

        // The current frame we are rendering
        this.frame = 0

        // The current ball position & velocity
        this.ballX = null
        this.ballY = null
        this.velocityX = null
        this.velocityY = null

        if (type == 'sim') {
            this.runReplay()
        }
    }

    startStop(p, i, d, r) {
        console.log(`startStop(${p}, ${i}, ${d}, ${r}). this.type=${this.type}`)
        if (this.type == 'live') {
            if (r == 1) {
                // Clicked start
                // this.beginRecord()
                this.replayData = newReplayDataSkeleton(p, i, d)
                console.log("Recording started")
            } else if (r == 0) {
                // Clicked stop
                console.log("Recording stopped. Uploading data...")
                msg_uploadReplay(this.replayData)
                this.replayData = undefined
            }
        } else if (this.type == 'sim') {
            if (r == 1) {
                this.playReplay = true
                this.runReplay()
            } else {
                this.playReplay = false
            }
        }
    }

    /* Process a message that looks like {m: Integer, s: Integer} */
    process(message) {
        // If we're currently recording...
        if (this.replayData) {
            // Add this frame
            this.replayData.frames.push(message)
        }

        this.redraw(message.m, message.s)
    }

    // Runs a replay.
    // The sample replay, for now.
    runReplay() {
        // Only run a replay if the canvas type is 'sim'
        if (this.type != 'sim') {
            throw 'This should never happen.'
        }

        // Stop the replay, if requested
        if (!this.playReplay) return

        const replay = sampleReplayData

        const replayLength = replay.frames.length

        // If we have more frames to render
        if (this.frame < replayLength) {
            // Render one more, then set a timeout to render another

            const newFrame = replay.frames[this.frame++]
            this.redraw(newFrame.m, newFrame.s)

            setTimeout(this.runReplay.bind(this), /* 1/60th of a sec */1000/60)
        }
    }

    // m=motor, how much the motor on the left is extended.
    // s=sensor, how far away the ball is from the left edge of the beam.
    // These values are RAW, as in, they come directly from the robot.
    redraw(rawM, rawS) {
        // Determine the new `viewportScale` depending on
        // the current width of the canvas.
        viewportScale = this.canvas.width / viewportWidth

      console.log("Render redraw.");
      console.log(`rawM=${rawM} rawS=${rawS}`)
      const m = -rawM
      if (rawS > 1500) {
        rawS = 1500
      }
      let s = (rawS - 300) * (beamWidth / (1500 - 300))
      console.log(`m=${m} s=${s}`)

      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      this.updateBallPositionAndVelocity(m, s)

      // debugger
      // Draw the beam
      this.drawBeam(m)

      // Draw the ball
      this.drawBall(m, s)
    }

    updateBallPositionAndVelocity(m, s) {
        // If the sensor detected the ball on the beam...
        if (s) {
            // Get new coordinates
            let [ballX, ballY] = this.ballCoords(m, s)

            // Calculate velocity from last frame
            this.velocityX = ballX - this.ballX
            this.velocityY = ballY - this.ballY

            // Update coordinates
            this.ballX = ballX
            this.ballY = ballY
        } else {
            // Otherwise, the ball is in freefall.
            // Just update the ballX and ballY according to "gravity".
            this.ballX += this.velocityX
            this.ballY += 0.1
            this.ballY *= 1.007

            return [this.ballX, this.ballY]
        }
    }

    pixelCoord(p) {
        return p * viewportScale
    }

    drawBeam(m) {
        // PX & PY are pixel X and pixel Y (coordinates in canvas)
      let [startPX, startPY, endPX, endPY] = this.beamCoords(m).map(this.pixelCoord)
      this.ctx.beginPath();
      this.ctx.lineWidth = beamHeight;
      this.ctx.strokeStyle = "#FFD65C";
      this.ctx.moveTo(startPX, startPY);
      this.ctx.lineTo(endPX, endPY);
      this.ctx.stroke();
    }

    drawBall(m, s) {
        const [pointPX, pointPY] = 
            s ? this.ballCoords(m, s, ballDiameter).map(this.pixelCoord)
              : [this.ballX, this.ballY].map(this.pixelCoord)

        const r = this.pixelCoord(ballDiameter)
      console.log(`Ball distance: ${s}`)
      console.log(`Ball coordinates: ${pointPX}, ${pointPY}`)
      this.ctx.beginPath()
      this.ctx.arc(pointPX, pointPY, r, r, 0, 2 * Math.PI, false)
      this.ctx.fillStyle = "#FF0000"
      this.ctx.fill()
      // this.ctx.ellipse()
      this.ctx.strokeStyle = "#FF0000"
      this.ctx.stroke()
    }


    // Given the motor position, returns:
    // [startX, startY, endX, endY]
    // as the PHYSICAL coordinates (in mm) of the beam
    beamCoords(m) {
        // Center (x, y) in mm
        let [cx, cy] = this.centerOfCanvas()

        const coords = [cx - beamWidth/2, cy-m,   cx + beamWidth/2, cy]
        // const coords = [this.convertX(10), this.convertY(m), this.convertX(90), this.convertY(50)]
        console.log(`Beam physical coords: ${coords}`)
        return coords
    }

    // Returns [x, y] of the *center* of the canvas, in mm.
    centerOfCanvas() {
        return [viewportWidth/2, viewportHeight/2]
    }

    // From chatGPT because I forgot trig
    // d is distance from the starting coordinates.
    findPointOnLineWithBall(startX, startY, endX, endY, d) {
        const r = ballDiameter / 2

      // Calculate the direction vector
      let dx = endX - startX;
      let dy = endY - startY;

      // Calculate the length of the vector
      let length = Math.sqrt(dx * dx + dy * dy);

      // Normalize the vector
      let ndx = dx / length;
      let ndy = dy / length;

      // Scale the normalized vector by distance 'd'
      let sdx = ndx * d;
      let sdy = ndy * d;

      // Determine the new point
      let pointX = startX + sdx;
      let pointY = startY + sdy;

      // Adjust the point to account for the radius of the ball
      // We need a vector perpendicular to (ndx, ndy). If (ndx, ndy) is normalized, then (-ndy, ndx) or (ndy, -ndx) are perpendicular to it.
      pointX -= ndy * r;
      pointY -= -ndx * r;

      return [ pointX, pointY ];
    }

    // Given the motor position and ball position, returns:
    // [x, y, radius]
    // as the GRAPHICAL coordinates in the canvas of the ball
    // r is radius of the ball
    ballCoords(m, s) {
      // Start by getting the beam coordinates
      const [startX, startY, endX, endY] = this.beamCoords(m)

      // Find where the ball should go. Flip the direction.
      return this.findPointOnLineWithBall(endX, endY, startX, startY, s)
    }

    highlightDelete(i) {
      var mval = motorArray[i];
      var sval = sensorArray[i];

      //highlight that point
      this.ctx.beginPath();
      this.ctx.arc(
        this.convertX(sval),
        this.convertY(mval),
        10, //radius
        0,
        2 * Math.PI
      );

      this.ctx.strokeStyle = "#FF5151";
      this.ctx.stroke();
    }

    convertX(x) {
      // Assume the svals are 0-100
      const cx = this.canvas.width * (x / 100);
      return cx;
    }

    convertY(y) {
      // Assume the svals are 0-100
      const cy = this.canvas.height * (y / 100);
      return cy;
    }

    drawSensorLine(sval) {
      this.ctx.beginPath();
      this.ctx.lineWidth = 4;
      this.ctx.strokeStyle = "#FFD65C";
      this.ctx.moveTo(this.convertX(sval), this.convertY(0));
      this.ctx.lineTo(this.convertX(sval), this.convertY(180));
      this.ctx.stroke();
    }

    drawMotorLine(mval) {
      this.ctx.beginPath();
      this.ctx.lineWidth = 4;
      this.ctx.strokeStyle = "#06A5FF";
      this.ctx.moveTo(this.convertX(0), this.convertY(mval));
      this.ctx.lineTo(this.convertX(100), this.convertY(mval));
      this.ctx.stroke();
    }

    drawPoint(sval, mval) {
      //Assume the mvals are 0-180 convert to a scale - start+bh to star
      this.ctx.beginPath();
      this.ctx.fillStyle = "#232323";
      this.ctx.arc(
        this.convertX(sval),
        this.convertY(mval),
        5,
        0,
        2 * Math.PI
      );

      this.ctx.fill();
    }

    highlightNN(i) {
      //find sval
      var mval = motorArray[i];
      var sval = sensorArray[i];

      //highlight that point
      this.ctx.beginPath();
      this.ctx.arc(
        this.convertX(sval),
        this.convertY(mval),
        10, //radius
        0,
        2 * Math.PI
      );

      this.ctx.strokeStyle = "#232323";
      this.ctx.stroke();
    }


}

const sampleReplayData = 
{
    "datetime": 1701284507734,
    "datetimeHuman": "Wed Nov 29 2023 14:01:47 GMT-0500 (Eastern Standard Time)",
    "unitNumber": -1,
    "group": "sample",
    "framerate": 60,
    "p": -1,
    "i": -1,
    "d": -1,
    "frames": [
        {
            "m": 0,
            "s": 0
        },
        {
            "m": 0.01,
            "s": 1
        },
        {
            "m": 0.02,
            "s": 2
        },
        {
            "m": 0.03,
            "s": 3
        },
        {
            "m": 0.04,
            "s": 4
        },
        {
            "m": 0.05,
            "s": 5
        },
        {
            "m": 0.06,
            "s": 6
        },
        {
            "m": 0.07,
            "s": 7
        },
        {
            "m": 0.08,
            "s": 8
        },
        {
            "m": 0.09,
            "s": 9
        },
        {
            "m": 0.1,
            "s": 10
        },
        {
            "m": 0.11,
            "s": 11
        },
        {
            "m": 0.12,
            "s": 12
        },
        {
            "m": 0.13,
            "s": 13
        },
        {
            "m": 0.14,
            "s": 14
        },
        {
            "m": 0.15,
            "s": 15
        },
        {
            "m": 0.16,
            "s": 16
        },
        {
            "m": 0.17,
            "s": 17
        },
        {
            "m": 0.18,
            "s": 18
        },
        {
            "m": 0.19,
            "s": 19
        },
        {
            "m": 0.2,
            "s": 20
        },
        {
            "m": 0.21,
            "s": 21
        },
        {
            "m": 0.22,
            "s": 22
        },
        {
            "m": 0.23,
            "s": 23
        },
        {
            "m": 0.24,
            "s": 24
        },
        {
            "m": 0.25,
            "s": 25
        },
        {
            "m": 0.26,
            "s": 26
        },
        {
            "m": 0.27,
            "s": 27
        },
        {
            "m": 0.28,
            "s": 28
        },
        {
            "m": 0.29,
            "s": 29
        },
        {
            "m": 0.3,
            "s": 30
        },
        {
            "m": 0.31,
            "s": 31
        },
        {
            "m": 0.32,
            "s": 32
        },
        {
            "m": 0.33,
            "s": 33
        },
        {
            "m": 0.34,
            "s": 34
        },
        {
            "m": 0.35000000000000003,
            "s": 35
        },
        {
            "m": 0.36,
            "s": 36
        },
        {
            "m": 0.37,
            "s": 37
        },
        {
            "m": 0.38,
            "s": 38
        },
        {
            "m": 0.39,
            "s": 39
        },
        {
            "m": 0.4,
            "s": 40
        },
        {
            "m": 0.41000000000000003,
            "s": 41
        },
        {
            "m": 0.42,
            "s": 42
        },
        {
            "m": 0.43,
            "s": 43
        },
        {
            "m": 0.44,
            "s": 44
        },
        {
            "m": 0.45,
            "s": 45
        },
        {
            "m": 0.46,
            "s": 46
        },
        {
            "m": 0.47000000000000003,
            "s": 47
        },
        {
            "m": 0.48,
            "s": 48
        },
        {
            "m": 0.49,
            "s": 49
        },
        {
            "m": 0.5,
            "s": 50
        },
        {
            "m": 0.51,
            "s": 51
        },
        {
            "m": 0.52,
            "s": 52
        },
        {
            "m": 0.53,
            "s": 53
        },
        {
            "m": 0.54,
            "s": 54
        },
        {
            "m": 0.55,
            "s": 55
        },
        {
            "m": 0.56,
            "s": 56
        },
        {
            "m": 0.5700000000000001,
            "s": 57
        },
        {
            "m": 0.58,
            "s": 58
        },
        {
            "m": 0.59,
            "s": 59
        },
        {
            "m": 0.6,
            "s": 60
        },
        {
            "m": 0.61,
            "s": 61
        },
        {
            "m": 0.62,
            "s": 62
        },
        {
            "m": 0.63,
            "s": 63
        },
        {
            "m": 0.64,
            "s": 64
        },
        {
            "m": 0.65,
            "s": 65
        },
        {
            "m": 0.66,
            "s": 66
        },
        {
            "m": 0.67,
            "s": 67
        },
        {
            "m": 0.68,
            "s": 68
        },
        {
            "m": 0.6900000000000001,
            "s": 69
        },
        {
            "m": 0.7000000000000001,
            "s": 70
        },
        {
            "m": 0.71,
            "s": 71
        },
        {
            "m": 0.72,
            "s": 72
        },
        {
            "m": 0.73,
            "s": 73
        },
        {
            "m": 0.74,
            "s": 74
        },
        {
            "m": 0.75,
            "s": 75
        },
        {
            "m": 0.76,
            "s": 76
        },
        {
            "m": 0.77,
            "s": 77
        },
        {
            "m": 0.78,
            "s": 78
        },
        {
            "m": 0.79,
            "s": 79
        },
        {
            "m": 0.8,
            "s": 80
        },
        {
            "m": 0.81,
            "s": 81
        },
        {
            "m": 0.8200000000000001,
            "s": 82
        },
        {
            "m": 0.8300000000000001,
            "s": 83
        },
        {
            "m": 0.84,
            "s": 84
        },
        {
            "m": 0.85,
            "s": 85
        },
        {
            "m": 0.86,
            "s": 86
        },
        {
            "m": 0.87,
            "s": 87
        },
        {
            "m": 0.88,
            "s": 88
        },
        {
            "m": 0.89,
            "s": 89
        },
        {
            "m": 0.9,
            "s": 90
        },
        {
            "m": 0.91,
            "s": 91
        },
        {
            "m": 0.92,
            "s": 92
        },
        {
            "m": 0.93,
            "s": 93
        },
        {
            "m": 0.9400000000000001,
            "s": 94
        },
        {
            "m": 0.9500000000000001,
            "s": 95
        },
        {
            "m": 0.96,
            "s": 96
        },
        {
            "m": 0.97,
            "s": 97
        },
        {
            "m": 0.98,
            "s": 98
        },
        {
            "m": 0.99,
            "s": 99
        },
        {
            "m": 1,
            "s": 100
        },
        {
            "m": 1.01,
            "s": 101
        },
        {
            "m": 1.02,
            "s": 102
        },
        {
            "m": 1.03,
            "s": 103
        },
        {
            "m": 1.04,
            "s": 104
        },
        {
            "m": 1.05,
            "s": 105
        },
        {
            "m": 1.06,
            "s": 106
        },
        {
            "m": 1.07,
            "s": 107
        },
        {
            "m": 1.08,
            "s": 108
        },
        {
            "m": 1.09,
            "s": 109
        },
        {
            "m": 1.1,
            "s": 110
        },
        {
            "m": 1.11,
            "s": 111
        },
        {
            "m": 1.12,
            "s": 112
        },
        {
            "m": 1.1300000000000001,
            "s": 113
        },
        {
            "m": 1.1400000000000001,
            "s": 114
        },
        {
            "m": 1.1500000000000001,
            "s": 115
        },
        {
            "m": 1.16,
            "s": 116
        },
        {
            "m": 1.17,
            "s": 117
        },
        {
            "m": 1.18,
            "s": 118
        },
        {
            "m": 1.19,
            "s": 119
        },
        {
            "m": 1.2,
            "s": 120
        },
        {
            "m": 1.21,
            "s": 121
        },
        {
            "m": 1.22,
            "s": 122
        },
        {
            "m": 1.23,
            "s": 123
        },
        {
            "m": 1.24,
            "s": 124
        },
        {
            "m": 1.25,
            "s": 125
        },
        {
            "m": 1.26,
            "s": 126
        },
        {
            "m": 1.27,
            "s": 127
        },
        {
            "m": 1.28,
            "s": 128
        },
        {
            "m": 1.29,
            "s": 129
        },
        {
            "m": 1.3,
            "s": 130
        },
        {
            "m": 1.31,
            "s": 131
        },
        {
            "m": 1.32,
            "s": 132
        },
        {
            "m": 1.33,
            "s": 133
        },
        {
            "m": 1.34,
            "s": 134
        },
        {
            "m": 1.35,
            "s": 135
        },
        {
            "m": 1.36,
            "s": 136
        },
        {
            "m": 1.37,
            "s": 137
        },
        {
            "m": 1.3800000000000001,
            "s": 138
        },
        {
            "m": 1.3900000000000001,
            "s": 139
        },
        {
            "m": 1.4000000000000001,
            "s": 140
        },
        {
            "m": 1.41,
            "s": 141
        },
        {
            "m": 1.42,
            "s": 142
        },
        {
            "m": 1.43,
            "s": 143
        },
        {
            "m": 1.44,
            "s": 144
        },
        {
            "m": 1.45,
            "s": 145
        },
        {
            "m": 1.46,
            "s": 146
        },
        {
            "m": 1.47,
            "s": 147
        },
        {
            "m": 1.48,
            "s": 148
        },
        {
            "m": 1.49,
            "s": 149
        },
        {
            "m": 1.5,
            "s": 150
        },
        {
            "m": 1.51,
            "s": 151
        },
        {
            "m": 1.52,
            "s": 152
        },
        {
            "m": 1.53,
            "s": 153
        },
        {
            "m": 1.54,
            "s": 154
        },
        {
            "m": 1.55,
            "s": 155
        },
        {
            "m": 1.56,
            "s": 156
        },
        {
            "m": 1.57,
            "s": 157
        },
        {
            "m": 1.58,
            "s": 158
        },
        {
            "m": 1.59,
            "s": 159
        },
        {
            "m": 1.6,
            "s": 160
        },
        {
            "m": 1.61,
            "s": 161
        },
        {
            "m": 1.62,
            "s": 162
        },
        {
            "m": 1.6300000000000001,
            "s": 163
        },
        {
            "m": 1.6400000000000001,
            "s": 164
        },
        {
            "m": 1.6500000000000001,
            "s": 165
        },
        {
            "m": 1.6600000000000001,
            "s": 166
        },
        {
            "m": 1.67,
            "s": 167
        },
        {
            "m": 1.68,
            "s": 168
        },
        {
            "m": 1.69,
            "s": 169
        },
        {
            "m": 1.7,
            "s": 170
        },
        {
            "m": 1.71,
            "s": 171
        },
        {
            "m": 1.72,
            "s": 172
        },
        {
            "m": 1.73,
            "s": 173
        },
        {
            "m": 1.74,
            "s": 174
        },
        {
            "m": 1.75,
            "s": 175
        },
        {
            "m": 1.76,
            "s": 176
        },
        {
            "m": 1.77,
            "s": 177
        },
        {
            "m": 1.78,
            "s": 178
        },
        {
            "m": 1.79,
            "s": 179
        },
        {
            "m": 1.8,
            "s": 180
        },
        {
            "m": 1.81,
            "s": 181
        },
        {
            "m": 1.82,
            "s": 182
        },
        {
            "m": 1.83,
            "s": 183
        },
        {
            "m": 1.84,
            "s": 184
        },
        {
            "m": 1.85,
            "s": 185
        },
        {
            "m": 1.86,
            "s": 186
        },
        {
            "m": 1.87,
            "s": 187
        },
        {
            "m": 1.8800000000000001,
            "s": 188
        },
        {
            "m": 1.8900000000000001,
            "s": 189
        },
        {
            "m": 1.9000000000000001,
            "s": 190
        },
        {
            "m": 1.9100000000000001,
            "s": 191
        },
        {
            "m": 1.92,
            "s": 192
        },
        {
            "m": 1.93,
            "s": 193
        },
        {
            "m": 1.94,
            "s": 194
        },
        {
            "m": 1.95,
            "s": 195
        },
        {
            "m": 1.96,
            "s": 196
        },
        {
            "m": 1.97,
            "s": 197
        },
        {
            "m": 1.98,
            "s": 198
        },
        {
            "m": 1.99,
            "s": 199
        },
        {
            "m": 2,
            "s": null
        },
        {
            "m": 2.0100000000000002,
            "s": null
        },
        {
            "m": 2.02,
            "s": null
        },
        {
            "m": 2.0300000000000002,
            "s": null
        },
        {
            "m": 2.04,
            "s": null
        },
        {
            "m": 2.05,
            "s": null
        },
        {
            "m": 2.06,
            "s": null
        },
        {
            "m": 2.07,
            "s": null
        },
        {
            "m": 2.08,
            "s": null
        },
        {
            "m": 2.09,
            "s": null
        },
        {
            "m": 2.1,
            "s": null
        },
        {
            "m": 2.11,
            "s": null
        },
        {
            "m": 2.12,
            "s": null
        },
        {
            "m": 2.13,
            "s": null
        },
        {
            "m": 2.14,
            "s": null
        },
        {
            "m": 2.15,
            "s": null
        },
        {
            "m": 2.16,
            "s": null
        },
        {
            "m": 2.17,
            "s": null
        },
        {
            "m": 2.18,
            "s": null
        },
        {
            "m": 2.19,
            "s": null
        },
        {
            "m": 2.2,
            "s": null
        },
        {
            "m": 2.21,
            "s": null
        },
        {
            "m": 2.22,
            "s": null
        },
        {
            "m": 2.23,
            "s": null
        },
        {
            "m": 2.24,
            "s": null
        },
        {
            "m": 2.25,
            "s": null
        },
        {
            "m": 2.2600000000000002,
            "s": null
        },
        {
            "m": 2.27,
            "s": null
        },
        {
            "m": 2.2800000000000002,
            "s": null
        },
        {
            "m": 2.29,
            "s": null
        },
        {
            "m": 2.3000000000000003,
            "s": null
        },
        {
            "m": 2.31,
            "s": null
        },
        {
            "m": 2.32,
            "s": null
        },
        {
            "m": 2.33,
            "s": null
        },
        {
            "m": 2.34,
            "s": null
        },
        {
            "m": 2.35,
            "s": null
        },
        {
            "m": 2.36,
            "s": null
        },
        {
            "m": 2.37,
            "s": null
        },
        {
            "m": 2.38,
            "s": null
        },
        {
            "m": 2.39,
            "s": null
        },
        {
            "m": 2.4,
            "s": null
        },
        {
            "m": 2.41,
            "s": null
        },
        {
            "m": 2.42,
            "s": null
        },
        {
            "m": 2.43,
            "s": null
        },
        {
            "m": 2.44,
            "s": null
        },
        {
            "m": 2.45,
            "s": null
        },
        {
            "m": 2.46,
            "s": null
        },
        {
            "m": 2.47,
            "s": null
        },
        {
            "m": 2.48,
            "s": null
        },
        {
            "m": 2.49,
            "s": null
        },
        {
            "m": 2.5,
            "s": null
        },
        {
            "m": 2.5100000000000002,
            "s": null
        },
        {
            "m": 2.52,
            "s": null
        },
        {
            "m": 2.5300000000000002,
            "s": null
        },
        {
            "m": 2.54,
            "s": null
        },
        {
            "m": 2.5500000000000003,
            "s": null
        },
        {
            "m": 2.56,
            "s": null
        },
        {
            "m": 2.57,
            "s": null
        },
        {
            "m": 2.58,
            "s": null
        },
        {
            "m": 2.59,
            "s": null
        },
        {
            "m": 2.6,
            "s": null
        },
        {
            "m": 2.61,
            "s": null
        },
        {
            "m": 2.62,
            "s": null
        },
        {
            "m": 2.63,
            "s": null
        },
        {
            "m": 2.64,
            "s": null
        },
        {
            "m": 2.65,
            "s": null
        },
        {
            "m": 2.66,
            "s": null
        },
        {
            "m": 2.67,
            "s": null
        },
        {
            "m": 2.68,
            "s": null
        },
        {
            "m": 2.69,
            "s": null
        },
        {
            "m": 2.7,
            "s": null
        },
        {
            "m": 2.71,
            "s": null
        },
        {
            "m": 2.72,
            "s": null
        },
        {
            "m": 2.73,
            "s": null
        },
        {
            "m": 2.74,
            "s": null
        },
        {
            "m": 2.75,
            "s": null
        },
        {
            "m": 2.7600000000000002,
            "s": null
        },
        {
            "m": 2.77,
            "s": null
        },
        {
            "m": 2.7800000000000002,
            "s": null
        },
        {
            "m": 2.79,
            "s": null
        },
        {
            "m": 2.8000000000000003,
            "s": null
        },
        {
            "m": 2.81,
            "s": null
        },
        {
            "m": 2.82,
            "s": null
        },
        {
            "m": 2.83,
            "s": null
        },
        {
            "m": 2.84,
            "s": null
        },
        {
            "m": 2.85,
            "s": null
        },
        {
            "m": 2.86,
            "s": null
        },
        {
            "m": 2.87,
            "s": null
        },
        {
            "m": 2.88,
            "s": null
        },
        {
            "m": 2.89,
            "s": null
        },
        {
            "m": 2.9,
            "s": null
        },
        {
            "m": 2.91,
            "s": null
        },
        {
            "m": 2.92,
            "s": null
        },
        {
            "m": 2.93,
            "s": null
        },
        {
            "m": 2.94,
            "s": null
        },
        {
            "m": 2.95,
            "s": null
        },
        {
            "m": 2.96,
            "s": null
        },
        {
            "m": 2.97,
            "s": null
        },
        {
            "m": 2.98,
            "s": null
        },
        {
            "m": 2.99,
            "s": null
        },
        {
            "m": 3,
            "s": null
        },
        {
            "m": 3.0100000000000002,
            "s": null
        },
        {
            "m": 3.02,
            "s": null
        },
        {
            "m": 3.0300000000000002,
            "s": null
        },
        {
            "m": 3.04,
            "s": null
        },
        {
            "m": 3.0500000000000003,
            "s": null
        },
        {
            "m": 3.06,
            "s": null
        },
        {
            "m": 3.0700000000000003,
            "s": null
        },
        {
            "m": 3.08,
            "s": null
        },
        {
            "m": 3.09,
            "s": null
        },
        {
            "m": 3.1,
            "s": null
        },
        {
            "m": 3.11,
            "s": null
        },
        {
            "m": 3.12,
            "s": null
        },
        {
            "m": 3.13,
            "s": null
        },
        {
            "m": 3.14,
            "s": null
        },
        {
            "m": 3.15,
            "s": null
        },
        {
            "m": 3.16,
            "s": null
        },
        {
            "m": 3.17,
            "s": null
        },
        {
            "m": 3.18,
            "s": null
        },
        {
            "m": 3.19,
            "s": null
        },
        {
            "m": 3.2,
            "s": null
        },
        {
            "m": 3.21,
            "s": null
        },
        {
            "m": 3.22,
            "s": null
        },
        {
            "m": 3.23,
            "s": null
        },
        {
            "m": 3.24,
            "s": null
        },
        {
            "m": 3.25,
            "s": null
        },
        {
            "m": 3.2600000000000002,
            "s": null
        },
        {
            "m": 3.27,
            "s": null
        },
        {
            "m": 3.2800000000000002,
            "s": null
        },
        {
            "m": 3.29,
            "s": null
        },
        {
            "m": 3.3000000000000003,
            "s": null
        },
        {
            "m": 3.31,
            "s": null
        },
        {
            "m": 3.3200000000000003,
            "s": null
        },
        {
            "m": 3.33,
            "s": null
        },
        {
            "m": 3.34,
            "s": null
        },
        {
            "m": 3.35,
            "s": null
        },
        {
            "m": 3.36,
            "s": null
        },
        {
            "m": 3.37,
            "s": null
        },
        {
            "m": 3.38,
            "s": null
        },
        {
            "m": 3.39,
            "s": null
        },
        {
            "m": 3.4,
            "s": null
        },
        {
            "m": 3.41,
            "s": null
        },
        {
            "m": 3.42,
            "s": null
        },
        {
            "m": 3.43,
            "s": null
        },
        {
            "m": 3.44,
            "s": null
        },
        {
            "m": 3.45,
            "s": null
        },
        {
            "m": 3.46,
            "s": null
        },
        {
            "m": 3.47,
            "s": null
        },
        {
            "m": 3.48,
            "s": null
        },
        {
            "m": 3.49,
            "s": null
        },
        {
            "m": 3.5,
            "s": null
        },
        {
            "m": 3.5100000000000002,
            "s": null
        },
        {
            "m": 3.52,
            "s": null
        },
        {
            "m": 3.5300000000000002,
            "s": null
        },
        {
            "m": 3.54,
            "s": null
        },
        {
            "m": 3.5500000000000003,
            "s": null
        },
        {
            "m": 3.56,
            "s": null
        },
        {
            "m": 3.5700000000000003,
            "s": null
        },
        {
            "m": 3.58,
            "s": null
        },
        {
            "m": 3.59,
            "s": null
        },
        {
            "m": 3.6,
            "s": null
        },
        {
            "m": 3.61,
            "s": null
        },
        {
            "m": 3.62,
            "s": null
        },
        {
            "m": 3.63,
            "s": null
        },
        {
            "m": 3.64,
            "s": null
        },
        {
            "m": 3.65,
            "s": null
        },
        {
            "m": 3.66,
            "s": null
        },
        {
            "m": 3.67,
            "s": null
        },
        {
            "m": 3.68,
            "s": null
        },
        {
            "m": 3.69,
            "s": null
        },
        {
            "m": 3.7,
            "s": null
        },
        {
            "m": 3.71,
            "s": null
        },
        {
            "m": 3.72,
            "s": null
        },
        {
            "m": 3.73,
            "s": null
        },
        {
            "m": 3.74,
            "s": null
        },
        {
            "m": 3.75,
            "s": null
        },
        {
            "m": 3.7600000000000002,
            "s": null
        },
        {
            "m": 3.77,
            "s": null
        },
        {
            "m": 3.7800000000000002,
            "s": null
        },
        {
            "m": 3.79,
            "s": null
        },
        {
            "m": 3.8000000000000003,
            "s": null
        },
        {
            "m": 3.81,
            "s": null
        },
        {
            "m": 3.8200000000000003,
            "s": null
        },
        {
            "m": 3.83,
            "s": null
        },
        {
            "m": 3.84,
            "s": null
        },
        {
            "m": 3.85,
            "s": null
        },
        {
            "m": 3.86,
            "s": null
        },
        {
            "m": 3.87,
            "s": null
        },
        {
            "m": 3.88,
            "s": null
        },
        {
            "m": 3.89,
            "s": null
        },
        {
            "m": 3.9,
            "s": null
        },
        {
            "m": 3.91,
            "s": null
        },
        {
            "m": 3.92,
            "s": null
        },
        {
            "m": 3.93,
            "s": null
        },
        {
            "m": 3.94,
            "s": null
        },
        {
            "m": 3.95,
            "s": null
        },
        {
            "m": 3.96,
            "s": null
        },
        {
            "m": 3.97,
            "s": null
        },
        {
            "m": 3.98,
            "s": null
        },
        {
            "m": 3.99,
            "s": null
        },
        {
            "m": 4,
            "s": null
        },
        {
            "m": 4.01,
            "s": null
        },
        {
            "m": 4.0200000000000005,
            "s": null
        },
        {
            "m": 4.03,
            "s": null
        },
        {
            "m": 4.04,
            "s": null
        },
        {
            "m": 4.05,
            "s": null
        },
        {
            "m": 4.0600000000000005,
            "s": null
        },
        {
            "m": 4.07,
            "s": null
        },
        {
            "m": 4.08,
            "s": null
        },
        {
            "m": 4.09,
            "s": null
        },
        {
            "m": 4.1,
            "s": null
        },
        {
            "m": 4.11,
            "s": null
        },
        {
            "m": 4.12,
            "s": null
        },
        {
            "m": 4.13,
            "s": null
        },
        {
            "m": 4.14,
            "s": null
        },
        {
            "m": 4.15,
            "s": null
        },
        {
            "m": 4.16,
            "s": null
        },
        {
            "m": 4.17,
            "s": null
        },
        {
            "m": 4.18,
            "s": null
        },
        {
            "m": 4.19,
            "s": null
        },
        {
            "m": 4.2,
            "s": null
        },
        {
            "m": 4.21,
            "s": null
        },
        {
            "m": 4.22,
            "s": null
        },
        {
            "m": 4.23,
            "s": null
        },
        {
            "m": 4.24,
            "s": null
        },
        {
            "m": 4.25,
            "s": null
        },
        {
            "m": 4.26,
            "s": null
        },
        {
            "m": 4.2700000000000005,
            "s": null
        },
        {
            "m": 4.28,
            "s": null
        },
        {
            "m": 4.29,
            "s": null
        },
        {
            "m": 4.3,
            "s": null
        },
        {
            "m": 4.3100000000000005,
            "s": null
        },
        {
            "m": 4.32,
            "s": null
        },
        {
            "m": 4.33,
            "s": null
        },
        {
            "m": 4.34,
            "s": null
        },
        {
            "m": 4.3500000000000005,
            "s": null
        },
        {
            "m": 4.36,
            "s": null
        },
        {
            "m": 4.37,
            "s": null
        },
        {
            "m": 4.38,
            "s": null
        },
        {
            "m": 4.39,
            "s": null
        },
        {
            "m": 4.4,
            "s": null
        },
        {
            "m": 4.41,
            "s": null
        },
        {
            "m": 4.42,
            "s": null
        },
        {
            "m": 4.43,
            "s": null
        },
        {
            "m": 4.44,
            "s": null
        },
        {
            "m": 4.45,
            "s": null
        },
        {
            "m": 4.46,
            "s": null
        },
        {
            "m": 4.47,
            "s": null
        },
        {
            "m": 4.48,
            "s": null
        },
        {
            "m": 4.49,
            "s": null
        },
        {
            "m": 4.5,
            "s": null
        },
        {
            "m": 4.51,
            "s": null
        },
        {
            "m": 4.5200000000000005,
            "s": null
        },
        {
            "m": 4.53,
            "s": null
        },
        {
            "m": 4.54,
            "s": null
        },
        {
            "m": 4.55,
            "s": null
        },
        {
            "m": 4.5600000000000005,
            "s": null
        },
        {
            "m": 4.57,
            "s": null
        },
        {
            "m": 4.58,
            "s": null
        },
        {
            "m": 4.59,
            "s": null
        },
        {
            "m": 4.6000000000000005,
            "s": null
        },
        {
            "m": 4.61,
            "s": null
        },
        {
            "m": 4.62,
            "s": null
        },
        {
            "m": 4.63,
            "s": null
        },
        {
            "m": 4.64,
            "s": null
        },
        {
            "m": 4.65,
            "s": null
        },
        {
            "m": 4.66,
            "s": null
        },
        {
            "m": 4.67,
            "s": null
        },
        {
            "m": 4.68,
            "s": null
        },
        {
            "m": 4.69,
            "s": null
        },
        {
            "m": 4.7,
            "s": null
        },
        {
            "m": 4.71,
            "s": null
        },
        {
            "m": 4.72,
            "s": null
        },
        {
            "m": 4.73,
            "s": null
        },
        {
            "m": 4.74,
            "s": null
        },
        {
            "m": 4.75,
            "s": null
        },
        {
            "m": 4.76,
            "s": null
        },
        {
            "m": 4.7700000000000005,
            "s": null
        },
        {
            "m": 4.78,
            "s": null
        },
        {
            "m": 4.79,
            "s": null
        },
        {
            "m": 4.8,
            "s": null
        },
        {
            "m": 4.8100000000000005,
            "s": null
        },
        {
            "m": 4.82,
            "s": null
        },
        {
            "m": 4.83,
            "s": null
        },
        {
            "m": 4.84,
            "s": null
        },
        {
            "m": 4.8500000000000005,
            "s": null
        },
        {
            "m": 4.86,
            "s": null
        },
        {
            "m": 4.87,
            "s": null
        },
        {
            "m": 4.88,
            "s": null
        },
        {
            "m": 4.89,
            "s": null
        },
        {
            "m": 4.9,
            "s": null
        },
        {
            "m": 4.91,
            "s": null
        },
        {
            "m": 4.92,
            "s": null
        },
        {
            "m": 4.93,
            "s": null
        },
        {
            "m": 4.94,
            "s": null
        },
        {
            "m": 4.95,
            "s": null
        },
        {
            "m": 4.96,
            "s": null
        },
        {
            "m": 4.97,
            "s": null
        },
        {
            "m": 4.98,
            "s": null
        },
        {
            "m": 4.99,
            "s": null
        },
        {
            "m": 5,
            "s": null
        },
        {
            "m": 5.01,
            "s": null
        },
        {
            "m": 5.0200000000000005,
            "s": null
        },
        {
            "m": 5.03,
            "s": null
        },
        {
            "m": 5.04,
            "s": null
        },
        {
            "m": 5.05,
            "s": null
        },
        {
            "m": 5.0600000000000005,
            "s": null
        },
        {
            "m": 5.07,
            "s": null
        },
        {
            "m": 5.08,
            "s": null
        },
        {
            "m": 5.09,
            "s": null
        },
        {
            "m": 5.1000000000000005,
            "s": null
        },
        {
            "m": 5.11,
            "s": null
        },
        {
            "m": 5.12,
            "s": null
        },
        {
            "m": 5.13,
            "s": null
        },
        {
            "m": 5.14,
            "s": null
        },
        {
            "m": 5.15,
            "s": null
        },
        {
            "m": 5.16,
            "s": null
        },
        {
            "m": 5.17,
            "s": null
        },
        {
            "m": 5.18,
            "s": null
        },
        {
            "m": 5.19,
            "s": null
        },
        {
            "m": 5.2,
            "s": null
        },
        {
            "m": 5.21,
            "s": null
        },
        {
            "m": 5.22,
            "s": null
        },
        {
            "m": 5.23,
            "s": null
        },
        {
            "m": 5.24,
            "s": null
        },
        {
            "m": 5.25,
            "s": null
        },
        {
            "m": 5.26,
            "s": null
        },
        {
            "m": 5.2700000000000005,
            "s": null
        },
        {
            "m": 5.28,
            "s": null
        },
        {
            "m": 5.29,
            "s": null
        },
        {
            "m": 5.3,
            "s": null
        },
        {
            "m": 5.3100000000000005,
            "s": null
        },
        {
            "m": 5.32,
            "s": null
        },
        {
            "m": 5.33,
            "s": null
        },
        {
            "m": 5.34,
            "s": null
        },
        {
            "m": 5.3500000000000005,
            "s": null
        },
        {
            "m": 5.36,
            "s": null
        },
        {
            "m": 5.37,
            "s": null
        },
        {
            "m": 5.38,
            "s": null
        },
        {
            "m": 5.39,
            "s": null
        },
        {
            "m": 5.4,
            "s": null
        },
        {
            "m": 5.41,
            "s": null
        },
        {
            "m": 5.42,
            "s": null
        },
        {
            "m": 5.43,
            "s": null
        },
        {
            "m": 5.44,
            "s": null
        },
        {
            "m": 5.45,
            "s": null
        },
        {
            "m": 5.46,
            "s": null
        },
        {
            "m": 5.47,
            "s": null
        },
        {
            "m": 5.48,
            "s": null
        },
        {
            "m": 5.49,
            "s": null
        },
        {
            "m": 5.5,
            "s": null
        },
        {
            "m": 5.51,
            "s": null
        },
        {
            "m": 5.5200000000000005,
            "s": null
        },
        {
            "m": 5.53,
            "s": null
        },
        {
            "m": 5.54,
            "s": null
        },
        {
            "m": 5.55,
            "s": null
        },
        {
            "m": 5.5600000000000005,
            "s": null
        },
        {
            "m": 5.57,
            "s": null
        },
        {
            "m": 5.58,
            "s": null
        },
        {
            "m": 5.59,
            "s": null
        },
        {
            "m": 5.6000000000000005,
            "s": null
        },
        {
            "m": 5.61,
            "s": null
        },
        {
            "m": 5.62,
            "s": null
        },
        {
            "m": 5.63,
            "s": null
        },
        {
            "m": 5.64,
            "s": null
        },
        {
            "m": 5.65,
            "s": null
        },
        {
            "m": 5.66,
            "s": null
        },
        {
            "m": 5.67,
            "s": null
        },
        {
            "m": 5.68,
            "s": null
        },
        {
            "m": 5.69,
            "s": null
        },
        {
            "m": 5.7,
            "s": null
        },
        {
            "m": 5.71,
            "s": null
        },
        {
            "m": 5.72,
            "s": null
        },
        {
            "m": 5.73,
            "s": null
        },
        {
            "m": 5.74,
            "s": null
        },
        {
            "m": 5.75,
            "s": null
        },
        {
            "m": 5.76,
            "s": null
        },
        {
            "m": 5.7700000000000005,
            "s": null
        },
        {
            "m": 5.78,
            "s": null
        },
        {
            "m": 5.79,
            "s": null
        },
        {
            "m": 5.8,
            "s": null
        },
        {
            "m": 5.8100000000000005,
            "s": null
        },
        {
            "m": 5.82,
            "s": null
        },
        {
            "m": 5.83,
            "s": null
        },
        {
            "m": 5.84,
            "s": null
        },
        {
            "m": 5.8500000000000005,
            "s": null
        },
        {
            "m": 5.86,
            "s": null
        },
        {
            "m": 5.87,
            "s": null
        },
        {
            "m": 5.88,
            "s": null
        },
        {
            "m": 5.89,
            "s": null
        },
        {
            "m": 5.9,
            "s": null
        },
        {
            "m": 5.91,
            "s": null
        },
        {
            "m": 5.92,
            "s": null
        },
        {
            "m": 5.93,
            "s": null
        },
        {
            "m": 5.94,
            "s": null
        },
        {
            "m": 5.95,
            "s": null
        },
        {
            "m": 5.96,
            "s": null
        },
        {
            "m": 5.97,
            "s": null
        },
        {
            "m": 5.98,
            "s": null
        },
        {
            "m": 5.99,
            "s": null
        }
    ]
}