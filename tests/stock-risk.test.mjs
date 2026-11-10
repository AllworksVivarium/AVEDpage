import test from 'node:test';
import assert from 'node:assert/strict';
import {stockPositionRisk,requireStockLeverage,stockTradeFee} from '../stock-risk.mjs';

test('fees round up actual notional, including tiny fills, without charging unfilled orders',()=>{
 for(const [amount,expected] of [[1,1],[999,1],[1000,1],[1001,2],[10000,10],[1000001,1001]])assert.equal(stockTradeFee(amount),expected);
 for(const value of [0,-1,1.5,Infinity,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>stockTradeFee(value));
});

test('leverage qualification uses strict available-balance thresholds',()=>{
 for(const [balance,leverage,allowed] of [[0,1,true],[1000000,3,false],[1000001,3,true],[5000000,10,false],[5000001,10,true],[100000,10,false]]){
  if(allowed)assert.doesNotThrow(()=>requireStockLeverage(balance,leverage));
  else assert.throws(()=>requireStockLeverage(balance,leverage),{code:'LEVERAGE_LOCKED'});
 }
});
test('isolated long and short liquidation prices match exact maintenance boundaries',()=>{
 const lot={holding:10,positionNotional:1000,marginUsed:100,price:92};
 const long=stockPositionRisk(lot);assert.equal(long.positionEquity,20);assert.equal(long.maintenanceMargin,20);assert.equal(long.liquidationPrice,92);assert.equal(long.shouldLiquidate,true);
 assert.equal(stockPositionRisk({...lot,price:93}).shouldLiquidate,false);
 const short=stockPositionRisk({...lot,holding:-10,price:108});assert.equal(short.positionEquity,20);assert.equal(short.liquidationPrice,108);assert.equal(short.shouldLiquidate,true);
 assert.equal(stockPositionRisk({...lot,holding:-10,price:107}).shouldLiquidate,false);
 assert.equal(stockPositionRisk({...lot,price:80}).positionEquity,-100,'gaps settle actual PnL, without inventing a capped fill price');
});
test('cash long has no leverage liquidation; a fully funded short still has a liquidation line',()=>{
 const cash={holding:10,positionNotional:1000,marginUsed:1000,price:1};
 assert.equal(stockPositionRisk(cash).liquidationPrice,null);assert.equal(stockPositionRisk(cash).shouldLiquidate,false);
 assert.equal(stockPositionRisk({...cash,holding:-10,price:180}).shouldLiquidate,true);
 const fractional={holding:3,positionNotional:303,marginUsed:31,price:93};
 assert.equal(stockPositionRisk(fractional).maintenanceMargin,7);assert.equal(stockPositionRisk(fractional).liquidationPrice,93);
 assert.equal(stockPositionRisk(fractional).shouldLiquidate,true);
});
