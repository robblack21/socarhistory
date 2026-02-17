
import fs from 'fs';

console.log("Starting debug script...");

const slides = [
  { text: "The History of SOCAR" },
  { text: "Azerbaijan’s oil was repeatedly described in the works of medieval scholars and travelers as a great source of income." },
  { text: "As Marco Polo wrote in the 14th century, people in this region used oil for medicinal purposes as well as for export." },
  { text: "Inscriptions on a stone found in a well in Balakhany, say it was drilled by foreman Allahyar Mammad Nuroghlu in 1594." },
  { text: "1847. A turning point in oil production was reached in the 19th century, and in 1847 the first oil wells were mechanically drilled at Bibiheybat and at Balakhany." },
  { text: "1859. The first white oil refinery (facility) was built in Baku. 1876. A deep well pump was applied for the first time, preceding the USA by 15 years." },
  { text: "1877. The Nobel brothers founded an oil production and processing company in Baku. Assets included oil fields, refineries, the world's first oil tanker in the Caspian Sea, barges, railways, hotels and more." },
  { text: "1878. The railway connecting the oil fields with the refineries financed by the 'Nobel Brothers' company completed in April 1879." },
  { text: "1907. Baku's oil industry ranked first in the world with a production of 11.5 million tons per year. The world's longest main oil pipeline, Baku-Batumi, was built at that time." },
  { text: "1930. For the first time, electric logging and measurement of the degree of inclination in the borehole was implemented in Baku." },
  { text: "1941. 71.4% of total Soviet oil was produced by Azerbaijan (23.5 million tons). This production guaranteed the victory of the Soviet Union in World War II." },
  { text: "1949. Azerbaijan was also the first offshore oil producer in the world. On November 7, 1949, the Neft Dashlari ('Oil Rocks') field was discovered." },
  { text: "1970 to 1980. The Azeri, Chirag, Kapaz and Gunashli fields were discovered in water 80 to 350 meters deep. Gunashli currently produces more than 60% of SOCAR's oil." },
  { text: "The billionth ton of oil was produced in Azerbaijan. 1992. By the Decree of the President, the Oil Company of state of the Republic of Azerbaijan." },
  { text: "1994. On September 20, the Joint Development and Production Sharing Agreement for the Azeri, Chirag and Gunashli fields was signed. This became known as the 'Contract of the Century'." },
  { text: "The agreement, signed by 11 oil companies from 8 countries was a sign of wisdom and political courage. Increased confidence encouraged oil companies to come here." },
  { text: "1996. Joint development agreement for the Shahdeniz condensate field. 1997. Baku-Novorossiysk pipeline. 1999. Baku-Supsa pipeline." },
  { text: "2001. Oilman's Day. 2006. BTC pipeline inauguration. 2007. South Caucasus Pipeline and first gas export." },
  { text: "2008. SOCAR Trading S.A. established in Geneva. SOCAR acquired PETKIM in Turkey and accelerated operations." },
  { text: "2009-2011. Fuel distribution in Ukraine, Georgia, Romania, Switzerland. 2017. Azerbaijan produced two billion tons of oil." },
  { text: "2018. STAR refinery inaugurated. TANAP opened. SOCAR Turkey won tender for Istanbul Airport gas stations." },
  { text: "2020. The Trans-Adriatic Gas Pipeline (TAP) began transporting commercial gas from Azerbaijan." },
  { text: "Thank you for watching." }
];

try {
    const data = fs.readFileSync('public/assets/narration.json', 'utf8');
    const narration = JSON.parse(data);
    console.log("Narration Loaded.");

    const normalize = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
    const allWords = [];
    narration.segments.forEach(seg => {
        if (seg.words) allWords.push(...seg.words);
    });

    console.log(`Total words: ${allWords.length}`);

    slides.forEach((slide, idx) => {
        const searchWords = slide.text.split(' ').slice(0, 5).join(' '); 
        const searchNorm = normalize(searchWords);
        
        // Brute force scan
        let found = false;
        // Increase window size to catch bad fuzzy
        for (let i = 0; i < allWords.length - 10; i++) {
            let windowText = "";
            for(let j=0; j<12; j++) { 
                if(i+j < allWords.length) windowText += allWords[i+j].text + " ";
            }
            const windowNorm = normalize(windowText);
            
            if (windowNorm.includes(searchNorm)) {
                console.log(`[Slide ${idx}] [${slide.text.substr(0,15)}...] matched at ${allWords[i].start_time}s`);
                found = true;
                break; 
            }
        }
        if (!found) console.log(`[Slide ${idx}] NO MATCH for "${slide.text.substr(0,30)}..."`);
    });

} catch(e) {
    console.error("ERROR:", e);
}
