export const stockRiskRules=Object.freeze({maintenanceFraction:0.2,leverageBalanceThresholds:Object.freeze({1:0,3:1000000,10:5000000})});

export function requireStockLeverage(balance,leverage){
 if(![1,3,10].includes(leverage))throw Error('杠杆仅支持 1x、3x 或 10x。');
 const threshold=stockRiskRules.leverageBalanceThresholds[leverage];
 if(leverage>1&&balance<=threshold){const error=Error(`账户可用余额需超过 ${threshold/10000} 万，才能开 ${leverage} 倍杠杆仓位。`);error.code='LEVERAGE_LOCKED';throw error;}
}

export function stockPositionRisk(lot){
 const quantity=Math.abs(lot.holding),margin=lot.marginUsed,notional=lot.positionNotional;
 const eligible=lot.holding<0||notional>margin;
 const pnl=Math.sign(lot.holding)*(quantity*lot.price-notional),equity=margin+pnl;
 const maintenance=eligible?Math.ceil(margin/5):0;
 const price=eligible&&quantity?(lot.holding>0?(notional-margin+maintenance)/quantity:(notional+margin-maintenance)/quantity):null;
 const ratio=margin?equity/margin:0;
 return {positionEquity:equity,maintenanceMargin:maintenance,equityPercent:Math.round(ratio*10000)/100,
  liquidationEligible:eligible,liquidationPrice:price===null?null:Math.max(0,lot.holding>0?Math.floor(price):Math.ceil(price)),
  riskLevel:!eligible?'cash':ratio<=0.4?'critical':ratio<=0.6?'warning':'normal',shouldLiquidate:eligible&&equity<=maintenance};
}
