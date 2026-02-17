import fs from 'fs';
import path from 'path';

const sparkModulePath = 'node_modules/@sparkjsdev/spark/dist/spark.module.js';
const content = fs.readFileSync(sparkModulePath, 'utf8');

// Match the specific data URI pattern seen in the file
const base64Match = content.match(/new URL\("data:application\/wasm;base64,([A-Za-z0-9+/=]+)"/);

if (base64Match && base64Match[1]) {
    const base64 = base64Match[1];
    const buffer = Buffer.from(base64, 'base64');
    
    const outPath = 'public/wasm/spark.wasm';
    
    // Ensure dir exists
    const dir = path.dirname(outPath);
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outPath, buffer);
    console.log(`WASM extracted to ${outPath} (${buffer.length} bytes)`);
} else {
    console.error("Could not find base64 WASM in spark.module.js");
}
