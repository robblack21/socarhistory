// Note: Durations are overridden by narration.json sync at runtime.
// Defaults are provided for fallback.
export const slides = [
  {
    type: "glb",
    path: "socarlogo.glb",
    startTime: 0.11, // "The history of SOCAR..."
    duration: 12, // Explicit 12s request
    year: "Intro",
    text: "The History of SOCAR",
    orbitScale: 0.0,
    transform: { position: [0, 1.77, 0], scale: [0.5, 0.5, 0.5], rotation: [0, 0, 0] }, 
    animation: "scale_up",
  },

  {
    type: "spz",
    path: "marcopolo.spz",
    startTime: 12.5, // Force order after Intro
    duration: 7,
    year: "14th C.",
    text: "As Marco Polo wrote in the 14th century, people in this region used oil for medicinal purposes as well as for export.",
    orbitScale: 0.25,
    transform: {
      position: [0, 1.6, 3.325],
      scale: [1.0, 1.0, 1.0], 
      rotation: [0, 3.14, 3.14],
    },
    animation: "zolly_in_strafe"
  },
  {
    type: "spz",
    path: "oilwell.spz",
    startTime: 20.0,
    duration: 8,
    year: "1847",
    text: "1847. A turning point in oil production was reached in the 19th century, and in 1847 the first oil wells were mechanically drilled at Bibiheybat and at Balakhany.",
    transform: {
      position: [0.15, 1.6, 1.65], // right 15%
      scale: [1.5, 1.5, 1.5],
      rotation: [0, 3.14, 3.14],
    },
    animation: "pan_horizontal"
  },
  {
    type: "spz",
    path: "refinery.spz",
    startTime: 30.0,
    duration: 9, 
    year: "1594",
    text: "Inscriptions on a stone found in a well in Balakhany, say it was drilled by foreman Allahyar Mammad Nuroghlu in 1594.",
    transform: {
      position: [0, 1.6, 2.5], // Closer (Z from 1.65 to 2.5)
      scale: [1.5, 1.5, 1.5],
      rotation: [0, 3.14, 3.14],
    },
    animation: "pan_horizontal"
  },
  {
    type: "spz",
    path: "pipeline.spz",
    startTime: 40.0,
    duration: 12,
    year: "1859",
    text: "1859. The first white oil refinery (facility) was built in Baku. 1876. A deep well pump was applied for the first time, preceding the USA by 15 years.",
    orbitScale: 0.0, 
    transform: {
      position: [0, 2.0, 1.65], // Down 33%
      scale: [0.75, 0.75, 0.75],
      rotation: [0, 3.14, 3.14],
    },
    animation: "strafe_down_pitch" // new animation
  },
  {
    type: "spz",
    path: "hotel.spz",
    startTime: 53.0,
    duration: 10,
    year: "1877",
    text: "1877. The Nobel brothers founded an oil production and processing company in Baku. Assets included oil fields, refineries, the world's first oil tanker in the Caspian Sea, barges, railways, hotels and more.",
    orbitScale: 0.3, 
    transform: {
      position: [1.0, 4.8, 0], // Up 50% (3.2 -> 4.8)
      scale: [3.375, 3.375, 3.375],
      rotation: [0, 3.14, 3.14],
    },
    animation: "strafe_down_pitch"
  },
  {
    type: "spz",
    path: "train.spz",
    startTime: 65.0,
    duration: 10,
    year: "1878",
    text: "1878. The railway connecting the oil fields with the refineries financed by the 'Nobel Brothers' company completed in April 1879.",
    orbitScale: 0.25, // Slow rotation
    transform: {
      position: [0.55, 1.2, 0], // Right + 25% (0.3 -> 0.55)
      scale: [3.375, 3.375, 3.375],
      rotation: [0, 3.14, 3.14],
    },
  },
  {
    type: "spz",
    path: "rigs.spz",
    startTime: 75.0,
    duration: 12,
    year: "1907",
    text: "1907. Baku's oil industry ranked first in the world with a production of 11.5 million tons per year. The world's longest main oil pipeline, Baku-Batumi, was built at that time.",
    transform: {
      position: [0, 1.6, -1.65], 
      scale: [1.6875, 1.6875, 1.6875],
      rotation: [0, 3.14, 3.14],
    },
    animation: "zolly_out",
    speedScale: 7.2
  },
  {
    type: "glb",
    path: "socar1992.glb",
    startTime: 85.0,
    duration: 8,
    year: "1930",
    text: "1930. For the first time, electric logging and measurement of the degree of inclination in the borehole was implemented in Baku.",
    transform: {
      position: [0, 1.6, 0],
      scale: [0.5, 0.5, 0.5], 
      rotation: [0.15, 0, 0], // Straighten (Tilt X)
    },
  },
  {
    type: "spz",
    path: "state.spz",
    startTime: 94.0,
    duration: 12,
    year: "1941",
    text: "1941. 71.4% of total Soviet oil was produced by Azerbaijan (23.5 million tons). This production guaranteed the victory of the Soviet Union in World War II.",
    transform: {
      position: [0, 1.6, -2.0], // back 25% (assuming unit scale, moved further back)
      scale: [2.25, 2.25, 2.25],
      rotation: [0, 3.14, 3.14],
    },
    animation: "orbit_horizontal"
  },
  {
    type: "spz",
    path: "platforms.spz",
    startTime: 107.0,
    duration: 10,
    year: "1949",
    text: "1949. Azerbaijan was also the first offshore oil producer in the world. On November 7, 1949, the Neft Dashlari ('Oil Rocks') field was discovered.",
    transform: {
      position: [0, 1.6, 0],
      scale: [3.375, 3.375, 3.375],
      rotation: [0, 3.14, 3.14],
    },
  },
  {
    type: "img",
    path: "map1.png",
    startTime: 118.0,
    duration: 10,
    year: "1970-80",
    text: "1970 to 1980. The Azeri, Chirag, Kapaz and Gunashli fields were discovered in water 80 to 350 meters deep. Gunashli currently produces more than 60% of SOCAR's oil.",
    orbitScale: 0.0,
    transform: {
      position: [0, 1.76, -2],
      speed: 0.0,
      scale: [1.0, 1.0, 1.0], 
      rotation: [0, 0, 0],
    },
    animation: "zolly_in_gentle"
  },
  {
    type: "img",
    path: "map2.png",
    startTime: 129.0,
    duration: 8,
    year: "1992",
    text: "The billionth ton of oil was produced in Azerbaijan. 1992. By the Decree of the President, the Oil Company of state of the Republic of Azerbaijan.",
    orbitScale: 0.0,
    transform: {
      position: [0, 1.76, -2],
      scale: [1.0, 1.0, 1.0], 
      rotation: [0, 0, 0],
    },
    animation: "zolly_in_gentle"
  },
  {
    type: "spz",
    path: "flag.spz",
    startTime: 138.0,
    duration: 12,
    year: "1994",
    text: "1994. On September 20, the Joint Development and Production Sharing Agreement for the Azeri, Chirag and Gunashli fields was signed. This became known as the 'Contract of the Century'.",
    transform: {
      position: [0, 1.6, 1.65],
      scale: [1.0, 1.0, 1.0],
      rotation: [0, 3.14, 3.14],
    },
    animation: "zolly_in",
    speedScale: 2.0
  },
  {
    type: "spz",
    path: "contract.spz",
    startTime: 152.0,
    duration: 9, // Reduced by 1s for timing check
    year: "Signed",
    text: "The agreement, signed by 11 oil companies from 8 countries was a sign of wisdom and political courage. Increased confidence encouraged oil companies to come here.",
    transform: {
      position: [-0.5, 1.6, 0.8], // Closer (Z from 0 to 0.8)
      scale: [1.6875, 1.6875, 1.6875],
      rotation: [0, 3.14, 3.14],
    },
    animation: "orbit_right",
    speedScale: 1.5
  },
  {
    type: "img",
    path: "map3.png",
    startTime: 163.0,
    duration: 14,
    year: "1996",
    text: "1996. Joint development agreement for the Shahdeniz condensate field. 1997. Baku-Novorossiysk pipeline. 1999. Baku-Supsa pipeline.",
    orbitScale: 0.0,
    transform: {
      position: [0, 1.76, -2],
      scale: [1.0, 1.0, 1.0], 
      rotation: [0, 0, 0],
    },
    animation: "zolly_in_gentle"
  },
  {
    type: "spz",
    path: "modern.spz",
    startTime: 178.0,
    duration: 14,
    year: "2001",
    text: "2001. Oilman's Day. 2006. BTC pipeline inauguration. 2007. South Caucasus Pipeline and first gas export.",
    transform: {
      position: [0, 6.0, -3.3], // Up 50% screen height (+1.5)
      scale: [2.25, 2.25, 2.25],
      rotation: [0, 3.14, 3.14],
    },
    animation: "strafe_down_pitch",
    speedScale: 0.75
  },
  {
    type: "spz",
    path: "station.spz",
    startTime: 193.0,
    duration: 10,
    year: "2008",
    text: "2008. SOCAR Trading S.A. established in Geneva. SOCAR acquired PETKIM in Turkey and accelerated operations.",
    transform: {
      position: [0, 4.8, -1.65], // Up 50% screen height (+1.5)
      scale: [3.375, 3.375, 3.375],
      rotation: [0, 3.14, 3.14],
    },
    animation: "strafe_down_pitch",
    speedScale: 0.75
  },
  {
    type: "spz",
    path: "2billion.spz", 
    startTime: 204.0,
    duration: 12,
    year: "2009",
    text: "2009-2011. Fuel distribution in Ukraine, Georgia, Romania, Switzerland. 2017. Azerbaijan produced two billion tons of oil.",
    transform: {
      position: [0, 1.6, 0],
      scale: [1.0, 1.0, 1.0], 
      rotation: [0, 3.14, 3.14],
    },
    animation: "zolly_in_fast",
    speedScale: 2.5
  },
  {
    type: "spz",
    path: "stage.spz",
    startTime: 217.0,
    duration: 12,
    year: "2018",
    text: "2018. STAR refinery inaugurated. TANAP opened. SOCAR Turkey won tender for Istanbul Airport gas stations.",
    transform: {
      position: [0, 5.1, -1.25], // Up 50% screen height (+1.5)
      scale: [3.375, 3.375, 3.375],
      rotation: [0, 3.14, 3.14],
    },
    animation: "strafe_down_pitch",
    speedScale: 2.0
  },
  {
    type: "spz",
    path: "pipes.spz",
    startTime: 230.0,
    duration: 10,
    year: "2020",
    text: "2020. The Trans-Adriatic Gas Pipeline (TAP) began transporting commercial gas from Azerbaijan.",
    transform: {
      position: [-0.5, 1.6, 0], // Left
      scale: [12.0, 12.0, 12.0],
      rotation: [0, 3.14, 3.14],
    },
    animation: "pan_horizontal", // Ensure movement exists to be slowed
    speedScale: 0.75
  },
  {
    type: "glb",
    path: "socarlogo.glb",
    startTime: 260.0,
    duration: 10,
    year: "End",
    text: "Thank you for watching.",
    orbitScale: 0.0,
    transform: { position: [0, 2.1, 0], scale: [0.5, 0.5, 0.5], rotation: [0, 0, 0] }, 
  },
];
