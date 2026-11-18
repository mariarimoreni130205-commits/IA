// Función del servidor (Vercel): pide precios reales a Travelpayouts/Aviasales
// y los devuelve en el formato que usa la app. La clave nunca llega al navegador.
//
// GET /api/vuelos?origenes=EZE,ROS&destinos=MAD,LIS&meses=1,2
// Respuesta: { fuente: 'aviasales', vuelos: [...] }  ·  503 si no hay clave cargada

import '../airport-data.js';
const API = 'https://api.travelpayouts.com/aviasales/v3/prices_for_dates';

// Código de la app → código de ciudad que usa Aviasales
const ORIGENES = { EZE: 'BUE', ROS: 'ROS' };
const DESTINOS = {
  ...Object.fromEntries(Object.keys(globalThis.RADAR_AIRPORTS||{}).map(code=>[code,code])),
  MAD: 'MAD', FCO: 'ROM', CDG: 'PAR', LIS: 'LIS', BCN: 'BCN', LHR: 'LON',
  MIA: 'MIA', JFK: 'NYC', GIG: 'RIO', FLN: 'FLN', PUJ: 'PUJ', CUN: 'CUN',
};
const AEROLINEAS = {
  IB: 'Iberia', UX: 'Air Europa', LA: 'LATAM', JJ: 'LATAM Brasil', AR: 'Aerolíneas Argentinas',
  AF: 'Air France', TP: 'TAP', KL: 'KLM', AV: 'Avianca', AA: 'American', CM: 'Copa',
  G3: 'GOL', AD: 'Azul', UA: 'United', DL: 'Delta', LH: 'Lufthansa', BA: 'British Airways',
  AZ: 'ITA Airways', ET: 'Ethiopian', EK: 'Emirates', QR: 'Qatar', TK: 'Turkish',
  H2: 'Sky', JA: 'JetSMART', '2W': 'World2Fly', AC: 'Air Canada', DM: 'Arajet', AM: 'Aeroméxico', B6: 'JetBlue', O4: 'Andes', WJ: 'JetSMART', FO: 'Flybondi', VY: 'Vueling', LX: 'Swiss',
};
const MAX_CONSULTAS = 72; // Bound provider requests even when the world catalog grows.

const lista = (txt, validos) =>
  [...new Set(String(txt || '').split(',').map((s) => s.trim().toUpperCase()))].filter((s) => validos.includes(s));

// Mes 0-11 → 'AAAA-MM' del próximo que viene (si ya pasó este año, el del año siguiente)
function mesFuturo(mes) {
  const hoy = new Date();
  const anio = mes >= hoy.getMonth() ? hoy.getFullYear() : hoy.getFullYear() + 1;
  return `${anio}-${String(mes + 1).padStart(2, '0')}`;
}

function normalizar(it, origen, destino) {
  const salida = new Date(it.departure_at);
  const vuelta = it.return_at ? new Date(it.return_at) : null;
  const precio = Math.round(Number(it.price));
  if (!Number.isFinite(salida.getTime()) || !(precio > 0)) return null;
  const dias = vuelta ? Math.max(1, Math.round((vuelta - salida) / 86400000)) : null;
  // duration_to = minutos del vuelo de ida; si no viene, se estima con la duración total
  const minutos = Number(it.duration_to) || (Number(it.duration) || 0) / (vuelta ? 2 : 1);
  const fecha = String(it.departure_at).slice(0, 10);
  return {
    id: `r-${origen}-${destino}-${fecha}-${it.airline}${it.flight_number || ''}`,
    origen,
    destino,
    aero: AEROLINEAS[it.airline] || it.airline || 'Aerolínea',
    esc: Math.min(3, Number(it.transfers) || 0),
    precio,
    horas: minutos ? +(minutos / 60).toFixed(1) : null,
    dias,
    fecha,
    link: it.link ? `https://www.aviasales.com${it.link}` : null,
  };
}

// Si para ese mes no hay precios guardados, se piden los de cualquier fecha (el agente decide si le sirven)
async function consultar(token, origen, destino, mes) {
  const v = await consultarMes(token, origen, destino, mes);
  return v.length || mes == null ? v : consultarMes(token, origen, destino, null);
}

async function consultarMes(token, origen, destino, mes) {
  const q = new URLSearchParams({
    origin: ORIGENES[origen], destination: DESTINOS[destino], currency: 'usd',
    sorting: 'price', direct: 'false', one_way: 'false', unique: 'false', limit: '10', page: '1',
  });
  if (mes != null) q.set('departure_at', mesFuturo(mes));
  const r = await fetch(`${API}?${q}`, { headers: { 'X-Access-Token': token, 'Accept-Encoding': 'gzip' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  if (j.success === false) throw new Error(j.error || 'error de la API');
  return (j.data || []).map((it) => normalizar(it, origen, destino)).filter(Boolean);
}

export default async function handler(req, res) {
  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (!token) {
    res.status(503).json({ error: 'sin_token', mensaje: 'Falta cargar TRAVELPAYOUTS_TOKEN en Vercel.' });
    return;
  }

  const origenes = lista(req.query.origenes, Object.keys(ORIGENES));
  const destinos = lista(req.query.destinos, Object.keys(DESTINOS));
  const meses = [...new Set(String(req.query.meses || '').split(',').filter(Boolean).map(Number))]
    .filter((m) => Number.isInteger(m) && m >= 0 && m <= 11).slice(0, 3);

  const o = origenes.length ? origenes : Object.keys(ORIGENES);
  const d = destinos.length ? destinos : Object.keys(DESTINOS);
  const m = meses.length ? meses : [null];
  const combos = [];
  for (const oo of o) for (const dd of d) for (const mm of m) if(oo!==dd) combos.push([oo, dd, mm]);
  if(!combos.length){res.status(200).json({fuente:'aviasales',vuelos:[],consultas:0,errores:0});return;}

  const resultados = await Promise.allSettled(
    combos.slice(0, MAX_CONSULTAS).map(([oo, dd, mm]) => consultar(token, oo, dd, mm)),
  );
  const vuelos = [];
  const vistos = new Set();
  let errores = 0;
  for (const r of resultados) {
    if (r.status === 'rejected') { errores++; continue; }
    for (const v of r.value) if (!vistos.has(v.id)) { vistos.add(v.id); vuelos.push(v); }
  }
  if (errores === resultados.length) {
    res.status(502).json({ error: 'api_caida', mensaje: String(resultados[0].reason?.message || '') });
    return;
  }

  // Los precios de Aviasales se actualizan cada pocas horas: cachear media hora alcanza
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
  res.status(200).json({ fuente: 'aviasales', vuelos, consultas: resultados.length, errores });
}
