import fs from 'fs';
import path from 'path';

const sparkModulePath = 'node_modules/@sparkjsdev/spark/dist/spark.module.js';
const publicWasmDir = 'public/wasm';
const wasmFileName = 'spark.wasm';
const publicWasmPath = path.join(publicWasmDir, wasmFileName);

// Ensure public/wasm exists
if (!fs.existsSync(publicWasmDir)) {
    fs.mkdirSync(publicWasmDir, { recursive: true });
}

let content = fs.readFileSync(sparkModulePath, 'utf8');

const targetStart = 'new URL("data:application/wasm;base64,';
const idx = content.indexOf(targetStart);

if (idx !== -1) {
    // 1. Find the end of the data URI string
    // It ends with `"`.
    const dataStartIdx = idx + 9; // 'new URL("' is 9 chars
    const quoteEndIdx = content.indexOf('"', dataStartIdx); // The closing quote of the URL string
    
    if (quoteEndIdx !== -1) {
        // Extract the full Data URL
        const fullDataUrl = content.substring(dataStartIdx, quoteEndIdx);
        
        // Remove prefix to get Base64
        const base64Prefix = 'data:application/wasm;base64,';
        if (fullDataUrl.startsWith(base64Prefix)) {
            const base64Data = fullDataUrl.substring(base64Prefix.length);
            
            // Decode and Write WASM
            const buffer = Buffer.from(base64Data, 'base64');
            fs.writeFileSync(publicWasmPath, buffer);
            console.log(`Extracted WASM to ${publicWasmPath} (${buffer.length} bytes)`);
            
            // 2. Patch the Source File
            // We need to replace `new URL("data:....", import.meta.url)` 
            // with `new URL("/wasm/spark.wasm", import.meta.url)`
            
            // Find the closing parenthesis of the constructor
            // Typically: `new URL("...", import.meta.url)`
            const closingParenIdx = content.indexOf(')', quoteEndIdx);
            
            // We'll just replace the string literal part, assuming the structure:
            // new URL("DATA_URI", import.meta.url)
            // dragging the replacement URL in.
            
            // Actually, let's just replace the specific substring of the DataURI string
            // from dataStartIdx to quoteEndIdx NO WAIT.
            // The content has new URL("data:..., ...")
            // matching EXACTLY the string literal is safer.
            
            // Let's replace the whole `new URL(...)` block to be clean?
            // "new URL("data:application/wasm;base64,AGASM...", import.meta.url)"
            
            const constructorEndIdx = content.indexOf(')', quoteEndIdx);
            if (constructorEndIdx !== -1) {
                const before = content.substring(0, idx);
                const after = content.substring(constructorEndIdx + 1);
                
                // Construct new instantiation using the public path
                // Note: We use absolute path from root for the browser
                const newCode = `new URL("/wasm/spark.wasm", import.meta.url)`;
                
                const newContent = before + newCode + after;
                fs.writeFileSync(sparkModulePath, newContent);
                console.log("Successfully patched spark.module.js to link to external WASM.");
            } else {
                console.warn("Could not find closing parenthesis for URL constructor.");
            }
            
        } else {
            console.error("Found URL but prefix didn't match?");
        }
    } else {
        console.error("Could not find closing quote for Data URI.");
    }
} else {
    // Check if it's already patched?
    if (content.indexOf('spark.wasm') !== -1) {
        console.log("File appears to be already patched.");
    } else {
        console.log("Target Data URI start string not found.");
    }
}
