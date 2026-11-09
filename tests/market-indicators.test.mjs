import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const context={};vm.runInNewContext(readFileSync(new URL('../public/market-chart.js',import.meta.url),'utf8'),context);
const calculate=context.AVEDMarketChart.indicators;
test('flat candles keep MACD at zero and KDJ at fifty, including zero-range candles',()=>{
 const values=calculate(Array.from({length:40},()=>({open:10,high:10,low:10,close:10,volume:0})));
 for(const m of values){assert.equal(m.dif,0);assert.equal(m.dea,0);assert.equal(m.macd,0);assert.equal(m.k,50);assert.equal(m.d,50);assert.equal(m.j,50);}
 assert.equal(calculate([]).length,0);
});
test('MACD EMA and KDJ smoothing match independently calculated early values without mutating candles',()=>{
 const rows=[10,11,12].map(close=>({open:close,high:close+1,low:close-1,close,volume:100})),before=JSON.stringify(rows),m=calculate(rows);
 const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
 near(m[1].dif,0.07977207977207977);near(m[1].dea,0.01595441595441596);near(m[1].macd,0.12763532763532762);
 near(m[1].k,55.55555555555556);near(m[1].d,51.85185185185185);near(m[1].j,62.96296296296296);
 assert.equal(JSON.stringify(rows),before);
});

test('personal trades group into exact visible 1/5/15 minute candle intervals',()=>{
 const group=context.AVEDMarketChart.tradeGroups;
 for(const period of [1,5,15]){const width=period*60000,rows=[{bucket:0},{bucket:width}];const trades=[{tradedAt:0,id:1},{tradedAt:width-1,id:2},{tradedAt:width,id:3},{tradedAt:-1,id:4},{tradedAt:width*2,id:5}];assert.equal(JSON.stringify(group(rows,trades,period).map(a=>a.map(t=>t.id))),'[[1,2],[3]]');}
});
