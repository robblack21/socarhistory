
import fs from 'fs';

// Mock slides from presentation_data (I will copy relevant parts or import if module)
// Since I can't easily import ES modules in this node script without setup, I'll mock the text.
const slides = [
  { text: "The History of SOCAR" },
  { text: "As Marco Polo wrote in the 14th century, people in this region used oil for medicinal purposes as well as for export." },
  { text: "Inscriptions on a stone found in a well in Balakhany, say it was drilled by foreman Allahyar Mammad Nuroghlu in 1594." },
  { text: "1847. A turning point in oil production was reached in the 19th century, and in 1847 the first oil wells were mechanically drilled at Bibiheybat and at Balakhany." },
  { text: "1859. The first white oil refinery (facility) was built in Baku. 1876. A deep well pump was applied for the first time, preceding the USA by 15 years." },
  { text: "1877. The Nobel brothers founded an oil production and processing company in Baku. Assets included oil fields, refineries, the world's first oil tanker in the Caspian Sea, barges, railways, hotels and more." },
  // ... add a few more to test
  { text: "1994. On September 20, the Joint Development and Production Sharing Agreement for the Azeri, Chirag and Gunashli fields was signed. This became known as the 'Contract of the Century'." },
  { text: "Azerbaijan’s oil was repeatedly described in the works of medieval scholars and travelers as a great source of income." }
];

const narration = JSON.parse(fs.readFileSync('public/assets/narration.json', 'utf8'));

const normalize = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
const allWords = [];
narration.segments.forEach(seg => {
     if (seg.words) allWords.push(...seg.words);
});

console.log(`Total words: ${allWords.length}`);

slides.forEach((slide, idx) => {
     const searchWords = slide.text.split(' ').slice(0, 5).join(' '); 
     const searchNorm = normalize(searchWords);
     
     let found = false;
     for (let i = 0; i < allWords.length - 10; i++) {
         // Create window
         let windowText = "";
         for(let j=0; j<10; j++) { 
             if(i+j < allWords.length) windowText += allWords[i+j].text + " ";
         }
         const windowNorm = normalize(windowText);
         
         if (windowNorm.includes(searchNorm)) {
             console.log(`[Slide ${idx}] "${slide.text.substr(0,30)}..." matched at ${allWords[i].start_time}s`);
             found = true;
             break; 
         }
     }
     if (!found) console.log(`[Slide ${idx}] NO MATCH for "${slide.text.substr(0,30)}..."`);
});
    { id: 22, text: "Azerbaijan’s oil was repeatedly described in the works of medieval scholars" }, // Moved Slide 22 to here
    { id: 2, text: "As Marco Polo wrote in the 14th century" },
    { id: 3, text: "Inscriptions on a stone found in a well in Balakhany" },
    { id: 4, text: "1847. A turning point in oil production" },
    { id: 5, text: "1859. The first white oil refinery" },
    { id: 6, text: "1877. The Nobel brothers founded" },
    { id: 7, text: "1878. The railway connecting" },
    { id: 8, text: "1907. Baku's oil industry ranked first" },
    { id: 9, text: "1930. For the first time" },
    { id: 10, text: "1941. 71.4% of total Soviet oil" },
    { id: 11, text: "1949. Azerbaijan was also the first" },
    { id: 12, text: "1970 to 1980. The Azeri, Chirag" },
    { id: 13, text: "The billionth ton of oil was produced" },
    { id: 14, text: "1994. On September 20" },
    { id: 15, text: "The agreement, signed by 11 oil companies" },
    { id: 16, text: "1996. Joint development agreement" },
    { id: 17, text: "2001. Oilman's Day" },
    { id: 18, text: "2008. SOCAR Trading S.A." },
    { id: 19, text: "2009-2011. Fuel distribution" },
    { id: 20, text: "2018. STAR refinery inaugurated" },
    { id: 21, text: "2020. The Trans-Adriatic Gas Pipeline" },
    { id: 23, text: "Thank you for watching" }
];

// Helper to normalize text for fuzzy matching
const normalize = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, '');

const matches = [];

slides.forEach(slide => {
    // Find matching word sequence in narration
    // We look for the first 3-4 words of the slide text
    const searchWords = slide.text.split(' ').slice(0, 5).join(' ');
    const searchNorm = normalize(searchWords);
    
    // Scan all words in narration
    let bestTime = -1;
    
    // Flatten words
    const allWords = [];
    narration.segments.forEach(seg => {
        if(seg.words) allWords.push(...seg.words);
    });
    
    for (let i = 0; i < allWords.length - 3; i++) {
        const slice = allWords.slice(i, i + 5).map(w => w.text).join(' ');
        const sliceNorm = normalize(slice);
        
        if (sliceNorm.includes(searchNorm) || searchNorm.includes(sliceNorm)) {
            // Found a match
            bestTime = allWords[i].start_time;
            break;
        }
    }
    
    matches.push({ id: slide.id, startTime: bestTime, text: slide.text.substring(0, 20) + "..." });
});

console.log(JSON.stringify(matches, null, 2));

// Additional: Output ALL segments to see timeline
// console.log(narration.segments.map(s => `${s.start_time}: ${s.text}`).join('\n'));
