import fs from 'fs';
import path from 'path';

const sparkPath = 'node_modules/@sparkjsdev/spark/dist/spark.module.js';
const publicDir = 'public';
const wasmFilename = 'spark.wasm';
const wasmPath = path.join(publicDir, wasmFilename);

if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
}

try {
    const content = fs.readFileSync(sparkPath, 'utf8');
    
    // Regex to find the data URI
    // It looks like: module_or_path = new URL("data:application/wasm;base64,AGFzb...", import.meta.url);
    const regex = /new URL\("data:application\/wasm;base64,([^"]+)", import\.meta\.url\)/;
    const match = content.match(regex);

    if (match && match[1]) {
        const base64Data = match[1];
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(wasmPath, buffer);
        console.log(`Successfully extracted WASM to ${wasmPath} (${buffer.length} bytes)`);
    } else {
        console.error('Could not find WASM data URI in spark.module.js');
        // Check if maybe it's already patched or formatted differently
        const altRegex = /data:application\/wasm;base64,([^"]+)/;
        const altMatch = content.match(altRegex);
        if (altMatch && altMatch[1]) {
             const base64Data = altMatch[1];
             const buffer = Buffer.from(base64Data, 'base64');
             fs.writeFileSync(wasmPath, buffer);
             console.log(`Successfully extracted WASM (alt match) to ${wasmPath} (${buffer.length} bytes)`);
        } else {
             console.error('Failed to match regex.');
             process.exit(1);
        }
    }

} catch (err) {
    console.error('Error reading/writing file:', err);
    process.exit(1);
}
