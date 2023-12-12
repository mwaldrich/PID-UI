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

// How many seconds the ball should be in the center to be 
// considered "balanced"
const balanceSeconds = 3

// Where the ball is considered to be "balanced"
const balanceRangeStart = 600
const balanceRangeEnd = 1000


///////////////////////////////////////////////////////////////////////////////
// Actual rendering logic below

class Renderer {
    // Construct a new renderer, rendering onto the given canvas `c`.
    // `type` should be 'live' or 'sim'
    constructor(c) {
        this.canvas = c
        this.ctx = this.canvas.getContext('2d')

        // Keep track of the live data recorded from this robot
        this.replayData = undefined

        // Should we be playing a replay rn?
        this.playReplay = false

        // The simulation data we are replaying
        this.simulationData = undefined


        // The current sensor and motor values
        this.s = null
        this.m = null

        // The current frame we are rendering
        this.frame = 0
        this.framesBalanced = 0

        // Confetti
        this.confettiThrown = false

        // The current ball position & velocity
        this.ballX = null
        this.ballY = null
        this.velocityX = null
        this.velocityY = null

        // Download simulation.pak
        fetch("./simulation.pak")
            .then((res) => res.json())
            .then((simPak) => {
                this.simPak = simPak
                console.log(`Successfully downloaded simpak! simpak has following keys: ${Object.keys(simPak)}`)
        })
    }

    startStop(p, i, d, r) {
        console.log(`RENDER: startStop(${p}, ${i}, ${d}, ${r})`)

        this.confettiThrown = false

        if (r == 0) {
            // User clicked stop. There are 2 states we could have been in:
            // 1. A simulation was currently running. In that case, 
            //    this.playReplay === true.
            // 2. We were recording live from the robot. In that case,
            //    this.replayData != undefined. We need to call 
            //    `this.completeReplayAndSend()`.
            if (this.playReplay) {
                console.log("RENDER: Simulation stopped.")
                this.playReplay = false
                this.frame = 0
            } else if (this.replayData != undefined) {
                console.log("RENDER: Recording stopped. Uploading data...")
                this.completeReplayAndSend()
            }
        } else if (r == 0.5) {
            // User clicked simulate. Replay simulation data.
            console.log("RENDER: Simulation started")
            this.initializeSimulationData(p, i, d)
            this.playReplay = true
            this.runReplay()
        } else if (r == 1) {
            // User clicked "Start"/"Send to Robot".
            // Stop simulation if running, 
            // start recording and rendering.
            if (this.playReplay) {
                console.log("RENDER: Simulation stopped.")
                this.playReplay = false
                this.frame = 0
            }
            this.replayData = newReplayDataSkeleton(p, i, d)
            console.log("RENDER: Recording started")
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

    /* Call this when we're doing recording a replay.
       It will do some final processing and send it out. */
    completeReplayAndSend() {
      const balanced = this.wasBallBalanced(this.replayData.frames)

      this.replayData.balanced = balanced

      msg_uploadReplay(this.replayData)
      this.replayData = undefined
    }

    /* Check: was the ball balanced at any point in the replay? */
    wasBallBalanced(frames) {
        const requiredFrameCount = balanceSeconds * 60;
        let currentFrameCount = 0;
    
        for (let frame of frames) {
            if (frame.s >= balanceRangeStart && frame.s <= balanceRangeEnd) {
                currentFrameCount++;
                if (currentFrameCount >= requiredFrameCount) {
                    return true;
                }
            } else {
                currentFrameCount = 0;
            }
        }
    
        return false;
    }

    initializeSimulationData(p, i, d) {
        console.log(`RENDER: Initializing simulation p=${p} i=${i} d=${d}`)
        console.log(`RENDER: simulation.pak: ${Object.keys(this.simPak)}`)

        this.simulationData = this.findClosestSimPakEntry(p)

        console.log(`RENDER: Chosen simulation run kp=${this.simulationData.p}`)
    }

    findClosestSimPakEntry(kp) {
        // Convert the keys to an array of numbers
        const keys = Object.keys(this.simPak).map(key => parseFloat(key.replace('kp', '')));
    
        // Find the key closest to kp
        let closestKey = keys[0];
        let minDifference = Math.abs(kp - closestKey);
    
        for (let i = 1; i < keys.length; i++) {
            let difference = Math.abs(kp - keys[i]);
            if (difference < minDifference) {
                minDifference = difference;
                closestKey = keys[i];
            }
        }
    
        // Return the value associated with the closest key
        return this.simPak[`kp${closestKey.toFixed(2)}`];
    }

    // Runs a replay.
    // The sample replay, for now.
    runReplay() {
        // Stop the replay, if requested
        if (!this.playReplay) return

        const replay = this.simulationData

        if (!replay) {
            alert("Attempted to play a simulation, but no simulation data was found.")
            // throw "bug"
            return
        }

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


        if (rawS >= balanceRangeStart && rawS <= balanceRangeEnd) {
            this.framesBalanced += 1
        } else {
            this.framesBalanced = 0
        }

        if (this.framesBalanced > balanceSeconds * 60 && !this.confettiThrown) {
            confetti({particleCount: 500, spread: 180})
            this.confettiThrown = true
        }

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
      const ballColor = (this.framesBalanced > balanceSeconds * 60)? "#00FF00" : "#FF0000"
      this.ctx.fillStyle = ballColor
      this.ctx.fill()
      // this.ctx.ellipse()
      this.ctx.strokeStyle = ballColor
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
