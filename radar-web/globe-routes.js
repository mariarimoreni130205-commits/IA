import './airport-data.js';
// Coordinates are real; every flight, schedule and trajectory is illustrative.
export const AIRPORT_INFO = globalThis.RADAR_AIRPORTS;
export const AIRPORTS = Object.fromEntries(Object.entries(AIRPORT_INFO).map(([code,a])=>[code,[a.lat,a.lon]]));
export const FLIGHT_ROUTES = [
  ['EZE','LIS'],['MAD','FCO'],['JFK','CDG'],['EZE','MIA'],['GRU','LHR'],['SCL','LIM'],
  ['BOG','MEX'],['MEX','LAX'],['YVR','HND'],['LAX','HNL'],['HNL','HND'],['SFO','ICN'],
  ['HND','SIN'],['SIN','SYD'],['SYD','AKL'],['AKL','SCL'],['SYD','DXB'],['BKK','DEL'],
  ['DEL','LHR'],['DXB','CAI'],['CAI','FCO'],['IST','AMS'],['LIS','CPT'],['CPT','JNB'],
  ['JNB','NBO'],['NBO','DXB'],['GRU','CPT'],['EZE','GRU'],['LHR','JFK'],['JFK','KEF'],
  ['KEF','AMS'],['CDG','LIS'],['LIM','LAX'],['ICN','BKK'],['MAD','BOG'],['MIA','GRU']
];
export function latLonVector(lat, lon) {
  const a = lat * Math.PI / 180, b = lon * Math.PI / 180;
  return [Math.cos(a) * Math.cos(b), Math.sin(a), -Math.cos(a) * Math.sin(b)];
}
export function routePoint(from, to, progress, height) {
  const a = latLonVector(...from), b = latLonVector(...to);
  const angle = Math.acos(Math.max(-1, Math.min(1, a.reduce((sum,v,i) => sum + v*b[i], 0))));
  const t = Math.max(0, Math.min(1, progress));
  const sin = Math.sin(angle);
  const u = sin > 1e-6 ? Math.sin((1-t)*angle)/sin : 1-t;
  const v = sin > 1e-6 ? Math.sin(t*angle)/sin : t;
  const point = a.map((value,i) => value*u + b[i]*v);
  const length = Math.hypot(...point) || 1;
  const radius = 1.016 + Math.sin(Math.PI*t)**2 * (height ?? Math.min(.2,.035+angle*.055));
  return point.map(value => value / length * radius);
}

// Each flight cruises at its own stable speed, about 2.4–4.2× the original pace.
export function flightDuration(length,index) {
  const variation=((index+1)*.61803398875)%1;
  return Math.max(3,length/(.06+variation*.045));
}

export function flightPhase(elapsed, offset, duration, groundTime=7) {
  const time=Math.max(0,elapsed+offset),cycleLength=duration+groundTime;
  const cycle=Math.floor(time/cycleLength),local=time-cycle*cycleLength;
  const airborne=local<duration,progress=Math.min(1,local/duration);
  const smooth=x=>{const n=Math.max(0,Math.min(1,x));return n*n*(3-2*n);};
  const scale=airborne?smooth(progress/.025)*smooth((1-progress)/.025):0;
  const status=!airborne?(local-duration<2.5?'Aterrizó':'Preparando salida'):progress<.08?'Despegando':progress>.92?'Aterrizando':'En vuelo';
  return {cycle,airborne,progress,scale,status,remaining:airborne?Math.max(0,duration-local):Math.max(0,cycleLength-local)};
}

// Avoid selecting airports or aircraft through the far side of the planet.
export function pointVisible(point,camera,radius=1.005) {
  const ray=point.map((v,i)=>v-camera[i]);
  const lengthSquared=ray.reduce((s,v)=>s+v*v,0);
  const t=-camera.reduce((s,v,i)=>s+v*ray[i],0)/lengthSquared;
  if(t<=0||t>=1)return true;
  return Math.hypot(...camera.map((v,i)=>v+t*ray[i]))>radius;
}
