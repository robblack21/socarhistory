import fs from 'fs';

const filePath = './node_modules/@sparkjsdev/spark/dist/spark.module.js';
let content = fs.readFileSync(filePath, 'utf8');

// Target string from the file (single line representation)
const target = 'float scale2 = min(maxPixelRadius, maxStdDev * sqrt(eigen2));\\n';

// Injection string using escaped newlines to maintain single-line JS string integrity
const injection = '    float minPix = 1.6;\\n    scale1 = max(scale1, minPix);\\n    scale2 = max(scale2, minPix);\\n';

if (content.includes(target)) {
    if (content.includes('float minPix = 1.6;')) {
        console.log('Already patched.');
    } else {
        const replacement = target + injection;
        content = content.replace(target, replacement);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Successfully patched spark.module.js with shader hack.');
    }
} else {
    console.error('Target string not found in spark.module.js');
    process.exit(1);
}
