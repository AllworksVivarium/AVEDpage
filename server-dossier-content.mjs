const types=['note','discovery','experiment','incident','interview','story'];
export function normalizeDossierCode(data,previous={}){
 if(data.codeLetters===undefined&&data.codeNumber===undefined)return data.code??previous.code;
 const letters=data.codeLetters,number=data.codeNumber;
 if(letters===''&&number===''&&previous.code&&!/^(SAFE|EUCLID|KETER)-[A-Za-z]+-[0-9]+$/.test(previous.code))return previous.code;
 const classification=normalizeContainmentClassification(data.classification??previous.classification??'');
 if(!classification||typeof letters!=='string'||! /^[A-Za-z]+$/.test(letters.trim())||typeof number!=='string'||! /^[0-9]+$/.test(number.trim()))throw Error('请选择收容分类，并填写字母段与数字段。');
 const code=classification+'-'+letters.trim().toUpperCase()+'-'+number.trim();
 if(code.length>30)throw Error('组合后的档案编号最多 30 字符。');
 return code;
}
export function normalizeContainmentClassification(value=''){
 if(!['','SAFE','EUCLID','KETER'].includes(value))throw Error('请选择有效的收容物分类。');
 return value;
}
export function installDossierContent(db){
 const cols=new Set(db.prepare('PRAGMA table_info(dossiers)').all().map(c=>c.name));
 for(const [name,def] of [['classification',"TEXT NOT NULL DEFAULT ''"],['procedures',"TEXT NOT NULL DEFAULT ''"],['abstract',"TEXT NOT NULL DEFAULT ''"],['sections_json',"TEXT NOT NULL DEFAULT '[]'"]])if(!cols.has(name))db.exec('ALTER TABLE dossiers ADD COLUMN '+name+' '+def);
 db.exec('CREATE TABLE IF NOT EXISTS dossier_content_migrations(name TEXT PRIMARY KEY)');
 if(!db.prepare("SELECT 1 FROM dossier_content_migrations WHERE name='classification-v1'").get()){
  db.exec("UPDATE dossiers SET classification=status WHERE classification='' AND status IN ('SAFE','EUCLID','KETER');INSERT INTO dossier_content_migrations VALUES('classification-v1')");
 }
 db.exec(`CREATE TRIGGER IF NOT EXISTS dossier_code_classification AFTER UPDATE OF classification ON dossiers
 WHEN NEW.classification IN ('SAFE','EUCLID','KETER') AND NEW.classification IS NOT OLD.classification
 AND substr(NEW.code,1,instr(NEW.code,'-')-1) IN ('SAFE','EUCLID','KETER') BEGIN
  UPDATE dossiers SET code=NEW.classification||substr(NEW.code,instr(NEW.code,'-')) WHERE id=NEW.id AND EXISTS(
   SELECT 1 FROM (SELECT substr(NEW.code,instr(NEW.code,'-')+1) AS suffix)
   WHERE instr(suffix,'-')>1 AND substr(suffix,1,instr(suffix,'-')-1) NOT GLOB '*[^A-Za-z]*'
   AND substr(suffix,instr(suffix,'-')+1)<>'' AND substr(suffix,instr(suffix,'-')+1) NOT GLOB '*[^0-9]*'
  );
 END;`);
}
export function dossierView(row){const {sections_json,hasImage,...rest}=row;let sections=[];try{sections=JSON.parse(sections_json||'[]');}catch{}return {...rest,...(hasImage?{imageUrl:`/api/dossiers/${row.id}/image`}:{}),sections:Array.isArray(sections)?sections:[]};}
export function normalizeDossierContent(data,previous={}){
 const classification=normalizeContainmentClassification(data.classification??previous.classification??'');
 const procedures=data.procedures??previous.procedures??'';
 const abstract=data.abstract??previous.abstract??'';
 if(typeof abstract!=='string'||abstract.length>300)throw Error('短摘要最多 300 字。');
 if(typeof procedures!=='string'||procedures.length>8000)throw Error('特殊收容措施最多 8000 字。');
 let sections=data.sections??dossierView(previous).sections;
 if(!Array.isArray(sections)||sections.length>24)throw Error('补充资料最多 24 个模块。');
 let total=0;sections=sections.map(x=>{
  if(!x||typeof x!=='object'||Array.isArray(x))throw Error('补充资料格式无效。');
  const item={type:x.type||'note'};if(!types.includes(item.type))throw Error('补充资料类型无效。');
  for(const [key,max] of [['title',100],['author',80],['date',80],['body',6000]]){const v=x[key]??'';if(typeof v!=='string'||v.length>max)throw Error('补充资料的标题、署名、时间或正文过长。');item[key]=v.trim();total+=v.length;}
  // Optional attachment metadata is reserved for future per-section uploads.
  if(x.attachment!=null){const a=x.attachment;if(typeof a!=='object'||typeof a.imageUrl!=='string'||!/^\/(?:assets\/[A-Za-z0-9_./-]+|api\/dossiers\/\d+\/image)$/.test(a.imageUrl)||a.imageUrl.includes('..')||typeof(a.caption??'')!=='string'||(a.caption??'').length>200)throw Error('资料附图格式无效。');item.attachment={imageUrl:a.imageUrl,caption:a.caption??''};total+=a.imageUrl.length+(a.caption??'').length;}
  return item;
 }).filter(x=>x.body);
 if(total>48000)throw Error('补充资料总计最多 48000 字。');
 return {classification,abstract:abstract.trim(),procedures:procedures.trim(),sectionsJSON:JSON.stringify(sections)};
}
