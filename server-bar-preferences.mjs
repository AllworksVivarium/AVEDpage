export const barToleranceOptions=Object.freeze([
 {id:'low',label:'一杯就倒',multiplier:.6},
 {id:'average',label:'酒量一般',multiplier:1},
 {id:'high',label:'酒量较好',multiplier:1.6},
 {id:'legend',label:'千杯不醉',multiplier:3}
]);
export const barGlassware=Object.freeze([
 {id:'highball',name:'直身杯',image:null,displayScale:.92,width:40,height:64},
 {id:'beer-mug',name:'啤酒杯',image:null,displayScale:.85,width:48,height:56},
 {id:'rocks',name:'矮杯',image:null,displayScale:.58,width:48,height:40}
]);
// Keep the container contract while waiting for approved artwork and pouring rules.
export const barFeatures=Object.freeze({glassware:false,pouring:false,drinking:true,intoxication:true,coasters:true});

export function installBarPreferences({db,clock=Date.now}){
 db.exec(`CREATE TABLE IF NOT EXISTS bar_preferences(
  employee_id INTEGER PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  tolerance_id TEXT CHECK(tolerance_id IN ('low','average','high','legend')),
  glass_id TEXT CHECK(glass_id IN ('highball','beer-mug','rocks')),
  updated_at TEXT NOT NULL
 )`);
 const read=db.prepare('SELECT tolerance_id AS toleranceId,glass_id AS glassId FROM bar_preferences WHERE employee_id=?');
 const get=id=>{const row=read.get(id);return {toleranceId:row?.toleranceId||null,glassId:row?.glassId||null,toleranceLabel:barToleranceOptions.find(item=>item.id===row?.toleranceId)?.label||null,intoxicationEnabled:true};};
 function save(id,data){
  if(!data||typeof data!=='object'||(!Object.hasOwn(data,'toleranceId')&&!Object.hasOwn(data,'glassId')))throw Error('请选择酒量或杯子。');
  if(Object.hasOwn(data,'glassId')&&!barFeatures.glassware)throw Error('容器功能暂未开放。');
  const previous=read.get(id)||{},toleranceId=Object.hasOwn(data,'toleranceId')?data.toleranceId:previous.toleranceId||null,glassId=Object.hasOwn(data,'glassId')?data.glassId:previous.glassId||null;
  if(toleranceId!==null&&!barToleranceOptions.some(item=>item.id===toleranceId))throw Error('请选择有效的酒量设定。');
  if(Object.hasOwn(data,'toleranceId')&&toleranceId===null)throw Error('请选择有效的酒量设定。');
  if(glassId!==null&&!barGlassware.some(item=>item.id===glassId))throw Error('请选择有效的杯子。');
  db.prepare(`INSERT INTO bar_preferences(employee_id,tolerance_id,glass_id,updated_at) VALUES(?,?,?,?)
   ON CONFLICT(employee_id) DO UPDATE SET tolerance_id=excluded.tolerance_id,glass_id=excluded.glass_id,updated_at=excluded.updated_at`).run(id,toleranceId,glassId,new Date(clock()).toISOString());
  return get(id);
 }
 return {get,save};
}
