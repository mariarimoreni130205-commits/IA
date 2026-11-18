import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/vuelos.js';

test('globe destinations reach the provider correctly, and self flights are skipped',async(t)=>{
  const previous=process.env.TRAVELPAYOUTS_TOKEN;
  process.env.TRAVELPAYOUTS_TOKEN='test-only';
  t.after(()=>{if(previous===undefined)delete process.env.TRAVELPAYOUTS_TOKEN;else process.env.TRAVELPAYOUTS_TOKEN=previous;});
  const calls=[];
  t.mock.method(globalThis,'fetch',async(url)=>{
    calls.push(new URL(url));
    return {ok:true,json:async()=>({success:true,data:[{departure_at:'2027-02-10T10:00:00',return_at:'2027-02-24T10:00:00',price:1000,airline:'LA',duration_to:1800,transfers:1}]})};
  });
  const response=()=>({statusCode:0,body:null,status(n){this.statusCode=n;return this;},json(body){this.body=body;},setHeader(){}});
  const first=response();await handler({query:{origenes:'EZE',destinos:'HND',meses:'1'}},first);
  assert.equal(first.statusCode,200);assert.equal(calls.length,1);
  assert.equal(calls[0].searchParams.get('origin'),'BUE');assert.equal(calls[0].searchParams.get('destination'),'HND');
  assert.equal(first.body.vuelos[0].destino,'HND');
  const second=response();await handler({query:{origenes:'EZE',destinos:'EZE'}},second);
  assert.equal(second.statusCode,200);assert.equal(second.body.consultas,0);assert.equal(calls.length,1);
});
