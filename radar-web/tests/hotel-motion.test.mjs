import test from 'node:test';
import assert from 'node:assert/strict';
import { rooms, rectangle, project, entryMatrix, overviewMatrix, homography } from '../hotel-motion.js';
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-5, `${a} != ${b}`);

test('all 27 physical entrances map to the viewport on desktop and mobile', () => {
  assert.equal(new Set(rooms.map(r=>r.id)).size,27);
  for(const [w,h] of [[1200,675],[355,443.75]]) for(const room of rooms){
    const end=entryMatrix(room,w,h,1);
    room.points.forEach((p,i)=>project(end,p).forEach((value,j)=>close(value,rectangle(w,h)[i][j])));
    for(const amount of [0,.2,.5,.8,1]) assert.ok(entryMatrix(room,w,h,amount).every(Number.isFinite));
  }
});
test('different selected rooms take distinct paths and return to the original facade',()=>{
  const first=rooms[0],last=rooms.at(-1),w=1000,h=562.5;
  assert.notDeepEqual(entryMatrix(first,w,h,.5),entryMatrix(last,w,h,.5));
  for(const room of rooms) assert.deepEqual(entryMatrix(room,w,h,0),overviewMatrix(w,h,1));
});
test('portal image and facade compose to the same full-frame crop without a jump',()=>{
  for(const [w,h] of [[1200,675],[355,443.75]]) for(const room of [rooms[0],rooms[13],rooms.at(-1)]){
    const source=rectangle(1672,1672*h/w),portal=homography(source,room.points),world=entryMatrix(room,w,h,1);
    source.forEach((p,i)=>project(world,project(portal,p)).forEach((v,j)=>close(v,rectangle(w,h)[i][j])));
  }
});
