// Shared geographic catalog. Source: OurAirports via datasets/airport-codes, public domain.
// Retrieved 2026-11-18. Spanish city/country display names supplied by Radar.
// Contains no flight schedules or live traffic. Works as a classic script and as an ES module.
globalThis.RADAR_AIRPORTS = Object.freeze(Object.fromEntries(Object.entries({
  "EZE": {
    "city": "Buenos Aires",
    "country": "Argentina",
    "airport": "Ezeiza International Airport - Ministro Pistarini",
    "lat": -34.8222,
    "lon": -58.5358,
    "region": "sudamerica"
  },
  "LIS": {
    "city": "Lisboa",
    "country": "Portugal",
    "airport": "Lisbon Humberto Delgado Airport",
    "lat": 38.7813,
    "lon": -9.13592,
    "region": "europa"
  },
  "MAD": {
    "city": "Madrid",
    "country": "España",
    "airport": "Adolfo Suárez Madrid–Barajas Airport",
    "lat": 40.493407,
    "lon": -3.572249,
    "region": "europa"
  },
  "FCO": {
    "city": "Roma",
    "country": "Italia",
    "airport": "Rome–Fiumicino Leonardo da Vinci International Airport",
    "lat": 41.804532,
    "lon": 12.251998,
    "region": "europa"
  },
  "JFK": {
    "city": "Nueva York",
    "country": "Estados Unidos",
    "airport": "John F. Kennedy International Airport",
    "lat": 40.639447,
    "lon": -73.779317,
    "region": "eeuu"
  },
  "CDG": {
    "city": "París",
    "country": "Francia",
    "airport": "Charles de Gaulle International Airport",
    "lat": 49.00896,
    "lon": 2.554117,
    "region": "europa"
  },
  "LHR": {
    "city": "Londres",
    "country": "Reino Unido",
    "airport": "London Heathrow Airport",
    "lat": 51.470748,
    "lon": -0.459909,
    "region": "europa"
  },
  "MIA": {
    "city": "Miami",
    "country": "Estados Unidos",
    "airport": "Miami International Airport",
    "lat": 25.796011,
    "lon": -80.289751,
    "region": "eeuu"
  },
  "GRU": {
    "city": "São Paulo",
    "country": "Brasil",
    "airport": "São Paulo/Guarulhos–Governor André Franco Montoro International Airport",
    "lat": -23.431274,
    "lon": -46.469954,
    "region": "brasil"
  },
  "SCL": {
    "city": "Santiago de Chile",
    "country": "Chile",
    "airport": "Comodoro Arturo Merino Benítez International Airport",
    "lat": -33.393001556396484,
    "lon": -70.78579711914062,
    "region": "sudamerica"
  },
  "LIM": {
    "city": "Lima",
    "country": "Perú",
    "airport": "Jorge Chávez International Airport",
    "lat": -12.0219,
    "lon": -77.114305,
    "region": "sudamerica"
  },
  "BOG": {
    "city": "Bogotá",
    "country": "Colombia",
    "airport": "El Dorado International Airport",
    "lat": 4.70159,
    "lon": -74.1469,
    "region": "sudamerica"
  },
  "MEX": {
    "city": "Ciudad de México",
    "country": "México",
    "airport": "Mexico City Benito Juárez International Airport",
    "lat": 19.435822,
    "lon": -99.07033,
    "region": "norteamerica"
  },
  "LAX": {
    "city": "Los Ángeles",
    "country": "Estados Unidos",
    "airport": "Los Angeles International Airport",
    "lat": 33.942501,
    "lon": -118.407997,
    "region": "eeuu"
  },
  "YVR": {
    "city": "Vancouver",
    "country": "Canadá",
    "airport": "Vancouver International Airport",
    "lat": 49.193901,
    "lon": -123.183998,
    "region": "norteamerica"
  },
  "HND": {
    "city": "Tokio",
    "country": "Japón",
    "airport": "Tokyo Haneda International Airport",
    "lat": 35.549678,
    "lon": 139.786958,
    "region": "asia"
  },
  "ICN": {
    "city": "Seúl",
    "country": "Corea del Sur",
    "airport": "Incheon International Airport",
    "lat": 37.469101,
    "lon": 126.450996,
    "region": "asia"
  },
  "SIN": {
    "city": "Singapur",
    "country": "Singapur",
    "airport": "Singapore Changi Airport",
    "lat": 1.35019,
    "lon": 103.994003,
    "region": "asia"
  },
  "SYD": {
    "city": "Sídney",
    "country": "Australia",
    "airport": "Sydney Kingsford Smith International Airport",
    "lat": -33.946098,
    "lon": 151.177002,
    "region": "oceania"
  },
  "AKL": {
    "city": "Auckland",
    "country": "Nueva Zelanda",
    "airport": "Auckland International Airport",
    "lat": -37.01199,
    "lon": 174.786331,
    "region": "oceania"
  },
  "DXB": {
    "city": "Dubái",
    "country": "Emiratos Árabes Unidos",
    "airport": "Dubai International Airport",
    "lat": 25.24979,
    "lon": 55.370992,
    "region": "mediooriente"
  },
  "DEL": {
    "city": "Nueva Delhi",
    "country": "India",
    "airport": "Indira Gandhi International Airport",
    "lat": 28.55563,
    "lon": 77.09519,
    "region": "asia"
  },
  "BKK": {
    "city": "Bangkok",
    "country": "Tailandia",
    "airport": "Suvarnabhumi Airport",
    "lat": 13.6811,
    "lon": 100.747002,
    "region": "asia"
  },
  "CPT": {
    "city": "Ciudad del Cabo",
    "country": "Sudáfrica",
    "airport": "Cape Town International Airport",
    "lat": -33.97403,
    "lon": 18.604333,
    "region": "africa"
  },
  "JNB": {
    "city": "Johannesburgo",
    "country": "Sudáfrica",
    "airport": "O.R. Tambo International Airport",
    "lat": -26.140081,
    "lon": 28.246801,
    "region": "africa"
  },
  "NBO": {
    "city": "Nairobi",
    "country": "Kenia",
    "airport": "Jomo Kenyatta International Airport",
    "lat": -1.318886,
    "lon": 36.928233,
    "region": "africa"
  },
  "CAI": {
    "city": "El Cairo",
    "country": "Egipto",
    "airport": "Cairo International Airport",
    "lat": 30.111534,
    "lon": 31.396694,
    "region": "africa"
  },
  "IST": {
    "city": "Estambul",
    "country": "Turquía",
    "airport": "İstanbul Airport",
    "lat": 41.274874,
    "lon": 28.732136,
    "region": "europa"
  },
  "KEF": {
    "city": "Reikiavik",
    "country": "Islandia",
    "airport": "Keflavik International Airport",
    "lat": 63.985001,
    "lon": -22.6056,
    "region": "europa"
  },
  "HNL": {
    "city": "Honolulu",
    "country": "Estados Unidos",
    "airport": "Daniel K. Inouye International Airport",
    "lat": 21.318387,
    "lon": -157.92567,
    "region": "eeuu"
  },
  "SFO": {
    "city": "San Francisco",
    "country": "Estados Unidos",
    "airport": "San Francisco International Airport",
    "lat": 37.619806,
    "lon": -122.374821,
    "region": "eeuu"
  },
  "AMS": {
    "city": "Ámsterdam",
    "country": "Países Bajos",
    "airport": "Amsterdam Airport Schiphol",
    "lat": 52.308601,
    "lon": 4.76389,
    "region": "europa"
  }
}).map(([code, airport]) => [code, Object.freeze(airport)])));
