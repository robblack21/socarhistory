import fs from 'fs';

const sparkModulePath = 'node_modules/@sparkjsdev/spark/dist/spark.module.js';
let content = fs.readFileSync(sparkModulePath, 'utf8');

const targetStart = 'new URL("data:application/wasm;base64,';
const idx = content.indexOf(targetStart);

if (idx !== -1) {
    // Find the closing parenthesis/quote for this URL constructor
    // It starts with 'new URL("...'
    // We need to find the specific closing `", import.meta.url)` pattern or similar.
    
    // Search for end of string quote
    // Since base64 won't contain ", it should be safe to look for next "
    
    const startQuoteIdx = idx + 8; // 'new URL(' len is 8? No. 
    // content[idx] is 'n'
    // 'new URL("data:...' 
    // Data URI starts at idx + 9? 
    // Let's just find the closing `", import.meta.url)` which is standard for Vite/Rollup wasm imports usually.
    
    const endSearchStr = '", import.meta.url)';
    const endIdx = content.indexOf(endSearchStr, idx);
    
    if (endIdx !== -1) {
        // We want to replace from idx to endIdx + endSearchStr.length
        const totalReplacement = 'new URL("/wasm/spark.wasm", import.meta.url)';
        
        const before = content.substring(0, idx);
        const after = content.substring(endIdx + endSearchStr.length);
        
        const newContent = before + totalReplacement + after;
        
        fs.writeFileSync(sparkModulePath, newContent);
        console.log("Successfully patched spark.module.js (via index slicing).");
    } else {
        console.error("Could not find end of URL constructor signature.");
    }
} else {
    console.log("Target start string not found.");
}
