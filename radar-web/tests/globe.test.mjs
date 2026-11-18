import test from 'node:test';
import assert from 'node:assert/strict';
import {AIRPORTS,AIRPORT_INFO,FLIGHT_ROUTES,latLonVector,routePoint,flightDuration,flightPhase,pointVisible} from '../globe-routes.js';
import {FlightCurve} from '../globe-scene.js';

test('all 36 simulated routes connect distinct known airports',()=>{
  assert.equal(FLIGHT_ROUTES.length,36);
  for(const [from,to] of FLIGHT_ROUTES){assert.ok(AIRPORTS[from]);assert.ok(AIRPORTS[to]);assert.notEqual(from,to);}
});
test('flights depart and arrive at the correct locations, always outside Earth',()=>{
  for(const [from,to] of FLIGHT_ROUTES){
    for(const [t,airport] of [[0,from],[1,to]]){
      const expected=latLonVector(...AIRPORTS[airport]).map(v=>v*1.016);
      const actual=routePoint(AIRPORTS[from],AIRPORTS[to],t);
      actual.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-10));
    }
    for(let step=0;step<=100;step++){
      const p=routePoint(AIRPORTS[from],AIRPORTS[to],step/100);
      assert.ok(p.every(Number.isFinite));
      assert.ok(Math.hypot(...p)>=1.0159);
    }
  }
});
test('Pacific routes cross the date line smoothly instead of circling through Europe',()=>{
  const start=AIRPORTS.YVR,end=AIRPORTS.HND;
  const midpoint=routePoint(start,end,.5);
  assert.ok(midpoint[0]<0,'route stays in the Pacific hemisphere');
  let previous=routePoint(start,end,0);
  for(let i=1;i<=200;i++){
    const next=routePoint(start,end,i/200);
    assert.ok(Math.hypot(...next.map((v,j)=>v-previous[j]))<.03);
    previous=next;
  }
});
test('the map coordinate convention agrees with the equirectangular texture',()=>{
  assert.deepEqual(latLonVector(0,0),[1,0,-0]);
  assert.ok(Math.abs(latLonVector(90,0)[1]-1)<1e-10);
  assert.ok(Math.abs(latLonVector(0,-90)[2]-1)<1e-10);
});
test('all airports expose city, country and airport details',()=>{
  for(const code of Object.keys(AIRPORTS)){const a=AIRPORT_INFO[code];assert.ok(a.city&&a.country&&a.airport);assert.ok(Number.isFinite(a.lat)&&Number.isFinite(a.lon));}
});
test('flights land, wait invisibly and restart with a smooth appearance',()=>{
  assert.equal(flightPhase(29.99,0,30).status,'Aterrizando');
  assert.equal(flightPhase(30,0,30).status,'Aterrizó');
  assert.equal(flightPhase(34,0,30).airborne,false);
  assert.equal(flightPhase(34,0,30).scale,0);
  assert.equal(flightPhase(37,0,30).cycle,1);
  assert.equal(flightPhase(37,0,30).scale,0);
  assert.equal(flightPhase(37.2,0,30).status,'Despegando');
});
test('arc-length motion stays even and aircraft headings never reverse mid-route',()=>{
  for(const [from,to] of FLIGHT_ROUTES){
    const curve=new FlightCurve(AIRPORTS[from],AIRPORTS[to]);
    let previous=curve.getPointAt(0),heading=curve.getTangentAt(0);const distances=[];
    for(let i=1;i<=200;i++){
      const p=curve.getPointAt(i/200),nextHeading=curve.getTangentAt(i/200);
      distances.push(p.distanceTo(previous));assert.ok(heading.dot(nextHeading)>.985,from+' → '+to);
      assert.ok(Number.isFinite(nextHeading.x+nextHeading.y+nextHeading.z));previous=p;heading=nextHeading;
    }
    assert.ok(Math.max(...distances)/Math.min(...distances)<1.08,from+' → '+to+' speed');
  }
});
test('hidden aircraft and airport markers cannot be picked through the globe',()=>{
  assert.equal(pointVisible([0,0,1.02],[0,0,3.7]),true);
  assert.equal(pointVisible([0,0,-1.02],[0,0,3.7]),false);
  assert.equal(pointVisible([1.2,0,0],[0,0,3.7]),true);
});

test('individual cruising speeds are varied and visibly faster than the original fleet',()=>{
  const speeds=FLIGHT_ROUTES.map(([from,to],i)=>{const length=new FlightCurve(AIRPORTS[from],AIRPORTS[to]).getLength();return length/flightDuration(length,i);});
  assert.ok(Math.min(...speeds)>.04);
  assert.ok(Math.max(...speeds)/Math.min(...speeds)>1.7);
  assert.ok(new Set(speeds.map(s=>s.toFixed(3))).size>15);
});
