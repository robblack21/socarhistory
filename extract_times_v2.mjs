
import fs from 'fs';
import path from 'path';

const jsonPath = '/Users/robblack/socarhistory/public/assets/narration.json';
console.log(`Reading ${jsonPath}...`);

try {
    const data = fs.readFileSync(jsonPath, 'utf8');
    const narration = JSON.parse(data);
    console.log(`Loaded narration with ${narration.segments.length} segments.`);

    const slides = [
        { id: 1, text: "The History of SOCAR" },
        { id: 22, text: "Azerbaijan's oil was repeatedly described" }, // Adjusted text for better match
        { id: 2, text: "As Marco Polo wrote in the 14th century" },
        { id: 3, text: "Inscriptions on a stone found in a well" },
        { id: 4, text: "1847. A turning point" },
        { id: 5, text: "1859. The first white oil refinery" },
        { id: 6, text: "1877. The Nobel brothers founded" },
        { id: 7, text: "1878. The railway connecting" },
        { id: 8, text: "1907. Baku's oil industry ranked first" },
        { id: 9, text: "1930. For the first time" },
        { id: 10, text: "1941. 71.4% of total Soviet oil" },
        { id: 11, text: "1949. Azerbaijan was also the first" },
        { id: 12, text: "1970 to 1980" },
        { id: 13, text: "The billionth ton of oil was produced" },
        { id: 14, text: "1994. On September 20" },
        { id: 15, text: "The agreement, signed by 11 oil companies" },
        { id: 16, text: "1996. Joint development agreement" },
        { id: 17, text: "2001. Oilman's Day" },
        { id: 18, text: "2008. SOCAR Trading S.A." },
        { id: 19, text: "2009-2011" },
        { id: 20, text: "2018. STAR refinery inaugurated" },
        { id: 21, text: "2020. The Trans-Adriatic" },
        { id: 23, text: "Thank you for watching" }
    ];

    const normalize = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, '');

    const allWords = [];
    narration.segments.forEach(seg => {
        if(seg.words) allWords.push(...seg.words);
    });
    
    console.log(`Total words: ${allWords.length}`);

    const matches = slides.map(slide => {
        const searchWords = slide.text.split(' ').slice(0, 4).join(' '); // Search first 4 words
        const searchNorm = normalize(searchWords);
        
        // Brute force scan
        for (let i = 0; i < allWords.length - 3; i++) {
             // Create window of text from words array
             let windowText = "";
             for(let j=0; j<6; j++) { // larger window
                 if(i+j < allWords.length) windowText += allWords[i+j].text + " ";
             }
             const windowNorm = normalize(windowText);
             
             if (windowNorm.includes(searchNorm)) {
                 return { ...slide, startTime: allWords[i].start_time };
             }
        }
        return { ...slide, startTime: null };
    });

    console.log(JSON.stringify(matches, null, 2));

} catch(e) {
    console.error("Error:", e);
}
