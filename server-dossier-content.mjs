const types=['note','discovery','experiment','incident','interview','story'];
export function installDossierContent(db){
 const cols=new Set(db.prepare('PRAGMA table_info(dossiers)').all().map(c=>c.name));
 for(const [name,def] of [['classification',"TEXT NOT NULL DEFAULT ''"],['procedures',"TEXT NOT NULL DEFAULT ''"],['sections_json',"TEXT NOT NULL DEFAULT '[]'"]])if(!cols.has(name))db.exec('ALTER TABLE dossiers ADD COLUMN '+name+' '+def);
 db.exec('CREATE TABLE IF NOT EXISTS dossier_content_migrations(name TEXT PRIMARY KEY)');
 if(!db.prepare("SELECT 1 FROM dossier_content_migrations WHERE name='classification-v1'").get()){
  db.exec("UPDATE dossiers SET classification=status WHERE classification='' AND status IN ('SAFE','EUCLID','KETER');INSERT INTO dossier_content_migrations VALUES('classification-v1')");
 }
}
export function dossierView(row){const {sections_json,hasImage,...rest}=row;let sections=[];try{sections=JSON.parse(sections_json||'[]');}catch{}return {...rest,...(hasImage?{imageUrl:`/api/dossiers/${row.id}/image`}:{}),sections:Array.isArray(sections)?sections:[]};}
export function normalizeDossierContent(data,previous={}){
 const classification=data.classification??previous.classification??'';
 if(!['','SAFE','EUCLID','KETER'].includes(classification))throw Error('请选择有效的收容物分类。');
 const procedures=data.procedures??previous.procedures??'';
 if(typeof procedures!=='string'||procedures.length>8000)throw Error('特殊收容措施最多 8000 字。');
 let sections=data.sections??dossierView(previous).sections;
 if(!Array.isArray(sections)||sections.length>24)throw Error('补充资料最多 24 个模块。');
 let total=0;sections=sections.map(x=>{
  if(!x||typeof x!=='object'||Array.isArray(x))throw Error('补充资料格式无效。');
  const item={type:x.type||'note'};if(!types.includes(item.type))throw Error('补充资料类型无效。');
  for(const [key,max] of [['title',100],['author',80],['date',80],['body',6000]]){const v=x[key]??'';if(typeof v!=='string'||v.length>max)throw Error('补充资料的标题、署名、时间或正文过长。');item[key]=v.trim();total+=v.length;}return item;
 }).filter(x=>x.body);
 if(total>48000)throw Error('补充资料总计最多 48000 字。');
 return {classification,procedures:procedures.trim(),sectionsJSON:JSON.stringify(sections)};
}
