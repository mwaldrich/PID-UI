// This file generates the `simulation.pak` file that should be hosted on the 
// frontend web server.
//
// Leave files called "kp0.00", "kp0.03", ..., "kp0.10" in the 
// `simulation-data` dir. Make sure they all have that format.
// Leave as many as you want in there.

const fs = require('fs').promises;
const path = require('path');

async function compileSimulationData() {
    const directoryPath = path.join(__dirname, 'simulation-data');
    let output = {};

    try {
        const files = await fs.readdir(directoryPath);
        
        // Filter files that match the pattern kpX.XX
        const kpFiles = files.filter(file => /^kp\d+\.\d+$/.test(file));

        for (const file of kpFiles) {
            const filePath = path.join(directoryPath, file);
            const data = await fs.readFile(filePath, 'utf8');
            
            try {
                output[file] = JSON.parse(data);
            } catch (jsonErr) {
                console.error(`Error parsing JSON from file ${file}:`, jsonErr);
            }
        }

        // Write the output to "../simulation.pak"
        const outputPath = path.join(__dirname, '..', 'simulation.pak');
        await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
        console.log('Compiled simulation.pak');
    } catch (err) {
        console.error('Error:', err);
    }
}

compileSimulationData();
