import fs from 'fs';

const sparkModulePath = 'node_modules/@sparkjsdev/spark/dist/spark.module.js';
let content = fs.readFileSync(sparkModulePath, 'utf8');

// Replace the massive Data URI with a path to the file we extracted
// searching for 'new URL("data:application/wasm;base64,'
const targetStart = 'new URL("data:application/wasm;base64,';
const replacement = 'new URL("/wasm/spark.wasm", import.meta.url); // Patched by Antigravity';

if (content.includes(targetStart)) {
    // We need to match the full string or just replace the line carefully.
    // The data URI is inside `new URL("...")`.
    // We can use regex to replace the whole `new URL("data:...")` block.
    
    const newContent = content.replace(
        /new URL\("data:application\/wasm;base64,[^"]+"\)/, 
        'new URL("/wasm/spark.wasm", import.meta.url)'
    );

    if (newContent !== content) {
        fs.writeFileSync(sparkModulePath, newContent);
        console.log("Successfully patched spark.module.js to use external WASM file.");
    } else {
        console.error("Regex match failed, but string exists? Checking content snippet...");
    }
} else {
    console.log("Target string not found. File might already be patched or different version.");
}
