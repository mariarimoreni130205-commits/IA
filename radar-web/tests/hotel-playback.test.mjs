import test from 'node:test';
import assert from 'node:assert/strict';
import {mirrorTime,forwardTime,progress} from '../hotel-playback.js';
import {readFileSync} from 'node:fs';
import {parseByteRange} from '../media-range.mjs';

test('returning switches to the matching source frame, including mid-tour',()=>{
 const {forwardEnd:end,fps,totalEnd}=JSON.parse(readFileSync(new URL('../assets/hotel/tour.json',import.meta.url),'utf8'));
 assert.ok(Math.abs(mirrorTime(0,end,fps)-totalEnd)<1e-9);
 for(let frame=0;frame<end*fps;frame+=13){
  const t=frame/fps,reverse=mirrorTime(t,end,fps);
  assert.ok(Math.abs(mirrorTime(reverse,end,fps)-t)<1e-9);
  assert.ok(Math.abs(forwardTime(reverse,end,fps)-t)<1e-9);
 }
});
test('tour progress stays bounded across approach, room and return',()=>{
 assert.equal(progress(0,4,29),0);assert.equal(progress(40,4,29),1);
 assert.equal(progress(16.5,4,29),.5);
});
test('video byte ranges support seeking, suffix requests and bounds',()=>{
 assert.deepEqual(parseByteRange('bytes=20-39',100),{start:20,end:39});
 assert.deepEqual(parseByteRange('bytes=90-',100),{start:90,end:99});
 assert.deepEqual(parseByteRange('bytes=-15',100),{start:85,end:99});
 assert.deepEqual(parseByteRange('bytes=90-200',100),{start:90,end:99});
 for(const range of ['bytes=100-','bytes=25-24','bytes=-0','bytes=-','bytes=1-2,4-5','bytes=x-3'])assert.equal(parseByteRange(range,100),false);
 assert.equal(parseByteRange(undefined,100),null);
});
