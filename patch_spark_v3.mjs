import fs from 'fs';

const filePath = './node_modules/@sparkjsdev/spark/dist/spark.module.js';
let content = fs.readFileSync(filePath, 'utf8');

// --- 1. SHADER HACK (Clamping) ---
const shaderTarget = 'float scale2 = min(maxPixelRadius, maxStdDev * sqrt(eigen2));\\n';
const shaderInjection = '    float minPix = 1.6;\\n    scale1 = max(scale1, minPix);\\n    scale2 = max(scale2, minPix);\\n';

if (content.includes(shaderTarget)) {
    if (content.includes('float minPix = 1.6;')) {
        console.log('[Shader] Already patched.');
    } else {
        const replacement = shaderTarget + shaderInjection;
        content = content.replace(shaderTarget, replacement);
        console.log('[Shader] Applied clamping patch.');
    }
} else {
    console.warn('[Shader] Target string not found (might differ in version or formatting).');
}

// --- 2. WASM FIX (External File) ---
// Target the specific line creating the Data URI URL
// We want to replace: module_or_path = new URL("...", import.meta.url);
// With: module_or_path = "spark.wasm";

const wasmRegex = /module_or_path\s*=\s*new\s*URL\s*\(\s*"data:application\/wasm;base64,[^"]+"\s*,\s*import\.meta\.url\s*\);/;

if (wasmRegex.test(content)) {
    console.log('[WASM] Found embedded Data URI. Replacing with public path "/socarhistory/spark.wasm"...');
    content = content.replace(wasmRegex, 'module_or_path = "/socarhistory/spark.wasm";');
} else if (content.includes('module_or_path = new URL("spark.wasm", import.meta.url);')) {
    console.log('[WASM] Updating relative URL to absolute public path...');
    content = content.replace('module_or_path = new URL("spark.wasm", import.meta.url);', 'module_or_path = "/socarhistory/spark.wasm";');
} else {
    // Check if fully patched
    if (content.includes('module_or_path = new URL("spark.wasm", import.meta.url);')) {
        console.log('[WASM] Already patched to use local file.');
    } else {
        console.warn('[WASM] Could not find Data URI pattern to replace.');
    }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Spark module patching complete.');
