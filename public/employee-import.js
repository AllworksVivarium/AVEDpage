/* The browser preview and server validation share the same table parser. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AVEDEmployeeImport=api;})(globalThis,function(){
 const labels=['力量','意志','洞察','敏捷','智力','体质'],limit=100;
 const headers=mode=>mode==='attributes'?['姓名',...labels]:['姓名','部门','QQ号',...labels];
 const templateFile=mode=>'\uFEFF'+headers(mode).join(',')+'\r\n';
 const aliases={name:['姓名','员工姓名','真名','名称','用户名','name','username','displayname'],department:['部门','所属部门','department'],qqNumber:['QQ','QQ号','qqnumber'],
  a0:['力量','STR'],a1:['意志','POW'],a2:['洞察','INS'],a3:['敏捷','DEX'],a4:['智力','INT'],a5:['体质','CON']};
 const key=value=>String(value).normalize('NFKC').replace(/[\s_（）()]/g,'').toLowerCase();
 const field=value=>Object.keys(aliases).find(k=>aliases[k].some(x=>key(x)===key(value)));
 function cells(line){
  const delimiter=line.includes('\t')?'\t':line.includes(',')?',':line.includes('，')?'，':line.includes('|')?'|':null;
  if(!delimiter)return line.trim().split(/\s+/);
  const result=[];let value='',quoted=false;
  for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===delimiter&&!quoted){result.push(value.trim());value='';}else value+=c;}
  if(quoted)throw Error('引号未闭合，请将每名员工放在一行。');result.push(value.trim());return result;
 }
 function department(raw){
  const text=String(raw||'').normalize('NFKC').replace(/\s/g,'');
  if(!text||['公司直属','公司直属部','无部门归属','直属','无','-'].includes(text))return '公司直属';
  return ({收容:'收容部',收容部:'收容部',武装:'武装部',武装部:'武装部',武裝部:'武装部',后勤:'后勤部',后勤部:'后勤部',後勤部:'后勤部',科研:'科研部',科研部:'科研部',研究部:'科研部',医疗:'医疗部',医疗部:'医疗部',醫療部:'医疗部'})[text]||null;
 }
 function parse(text,mode='create'){
  const rows=[],errors=[];
  if(!['create','attributes'].includes(mode))return {rows,errors:[{line:0,message:'请选择导入方式。'}]};
  if(typeof text!=='string'||text.length>200000)return {rows,errors:[{line:0,message:'导入文本最多 200,000 字。'}]};
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).map((text,i)=>({text,line:i+1})).filter(x=>x.text.trim());
  if(!lines.length)return {rows,errors:[{line:0,message:'请先粘贴导入内容。'}]};
  let header=null;
  try{const first=cells(lines[0].text),keys=first.map(field);if(keys.includes('name')&&keys.some(x=>x&&x!=='name')){
   if(keys.some(x=>!x))throw Error('表头包含无法识别的列，请使用模板列名。');
   const nonNames=keys.filter(x=>x!=='name');if(new Set(nonNames).size!==nonNames.length)throw Error('表头中有重复列。');
   header=keys;lines.shift();
  }}catch(error){return {rows,errors:[{line:lines[0].line,message:error.message}]};}
  if(lines.length>limit)return {rows,errors:[{line:0,message:'每批最多导入 '+limit+' 名员工。'}]};
  for(const source of lines){try{
   let values={},parts=cells(source.text);
   if(header){if(parts.length!==header.length)throw Error('列数与表头不一致，请检查空列或分隔符。');header.forEach((k,i)=>{if(k==='name'&&values.name&&parts[i]&&values.name!==parts[i])throw Error('用户名和姓名须保持一致。');if(parts[i]||!values[k])values[k]=parts[i];});}
   else {
    const matches=[...source.text.matchAll(/(力量|意志|洞察|敏捷|智力|体质|STR|POW|INS|DEX|INT|CON)\s*[:：=]?\s*([-+]?\d+(?:\.\d+)?)/gi)];
    if(matches.length){
     const prefix=source.text.slice(0,matches[0].index).replace(/\.?st\s*$/i,'').trim();parts=cells(prefix);
     if(parts.length>3)throw Error('属性前请按姓名、部门、QQ 的顺序填写。');
     [values.name,values.department,values.qqNumber]=parts;
     for(const m of matches){const k=field(m[1]);if(values[k]!==undefined)throw Error('六维属性重复。');values[k]=m[2];}
     const remainder=source.text.slice(matches[0].index).replace(/(力量|意志|洞察|敏捷|智力|体质|STR|POW|INS|DEX|INT|CON)\s*[:：=]?\s*([-+]?\d+(?:\.\d+)?)/gi,'').replace(/[\s,，;；|]+/g,'');if(remainder)throw Error('属性之间包含无法识别的文字。');
    }else{
     if(![1,2,3,7,8,9].includes(parts.length))throw Error('无法识别列数，请使用模板或带表头的表格。');
     const count=parts.length>=7?parts.length-6:parts.length;
     [values.name,values.department,values.qqNumber]=parts.slice(0,count);
     if(parts.length>=7)parts.slice(count).forEach((v,i)=>values['a'+i]=v);
    }
   }
   const name=String(values.name||'').trim();if(!name||name.length>40||/[\x00-\x1f\x7f]/.test(name))throw Error('姓名须为 1～40 字。');
   const dept=department(values.department);if(!dept)throw Error('部门无法识别，请使用五个部门名称或公司直属。');
   const qqNumber=String(values.qqNumber||'').trim();if(qqNumber.length>30)throw Error('QQ 号最多 30 字。');
   const raw=labels.map((_,i)=>String(values['a'+i]??'').normalize('NFKC').trim());
   const attributes=raw.every(x=>x==='')?null:raw.map(x=>/^\d+$/.test(x)?Number(x):NaN);
   if(attributes&&attributes.some(x=>!Number.isSafeInteger(x)||x<0||(mode==='create'&&x>100)))throw Error(mode==='create'?'六维需填满六个 0～100 的整数。':'六维需填满六个非负安全整数。');
   if(mode==='attributes'&&!attributes)throw Error('更新六维时，六项数值均须填写。');
   rows.push({line:source.line,name,department:dept,qqNumber,attributes});
  }catch(error){errors.push({line:source.line,message:error.message});}}
  const seen=new Set();for(const row of rows){if(seen.has(row.name))errors.push({line:row.line,message:'本批次姓名重复：'+row.name});seen.add(row.name);}
  if(!rows.length&&!errors.length)errors.push({line:0,message:'表头下方还没有员工资料。'});
  return {rows,errors};
 }
 return {parse,labels,limit,headers,templateFile,template:'姓名\t部门\tQQ号\t力量\t意志\t洞察\t敏捷\t智力\t体质\n示例员工甲\t收容部\t\t60\t55\t70\t50\t65\t60\n示例员工乙\t医疗部\t\t50\t70\t65\t55\t75\t60',attributeTemplate:'姓名\t力量\t意志\t洞察\t敏捷\t智力\t体质\n示例员工甲\t60\t55\t70\t50\t65\t60'};
});
