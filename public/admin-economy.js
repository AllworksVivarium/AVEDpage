async function renderEconomy(){
 let config=await api('/api/admin/economy'),saving=false,pending=false;
 const number=(name,value,min,max,step=1)=>`<input name="${name}" type="number" value="${value}" min="${min}" max="${max}" step="${step}" required>`;
 const mean=t=>t.returnPercent??Number((Object.values(t.variants).reduce((sum,p)=>sum+p.reduce((s,x)=>s+x.weight*x.multiplier,0)/p.reduce((s,x)=>s+x.weight,0),0)/Object.keys(t.variants).length*100).toFixed(2));
 const prizes=t=>{const p=Object.values(t.variants)[0],sum=p.reduce((n,x)=>n+x.weight,0);return p.slice(-3).map(x=>`${x.multiplier} 倍：${x.weight?`概率约 1 / ${Math.round(sum/x.weight).toLocaleString()}`:'不出奖'}`).join('；');};
 const rangeRow=x=>`<div class="sky-range"><label>安全线下限 / 米${number('rangeMin',x.min,100,2000)}</label><label>上限 / 米${number('rangeMax',x.max,100,2000)}</label><label>相对概率权重${number('rangeWeight',x.weight,0,100000000)}</label><button type="button" class="small-action danger" data-range-remove>删除区间</button></div>`;
 $('#panel').innerHTML=`<form id="economy-form" class="community-form"><div class="economy-save"><button class="small-action" type="submit">保存设置</button><span id="economy-feedback" role="status">修改后离开输入框即可自动保存。</span></div><section><h4>刮刮乐</h4><p>各档位均为刮刮乐，分别设置最高奖和多级稀有奖。返还率是包含本金的长期平均返还，不代表每张票固定返还。</p><div class="scratch-settings">${config.scratch.map(t=>`<article class="scratch-setting"><h5>刮刮乐 · ¤ ${t.cost.toLocaleString()} 档</h5><label>票价${number('cost-'+t.id,t.cost,100,1000000)}</label><label>平均返还率 / %${number('return-'+t.id,mean(t),0,100,.01)}</label><p class="scratch-prize-odds" data-prize-tier="${t.id}">${prizes(t)}</p></article>`).join('')}</div></section><section class="admin-section"><h4>共享速降</h4><p>超过安全线或未及时开伞，损失本次全部本金，返还为 0。</p><div class="community-filters"><label>准备时长 / 秒${number('boardingSeconds',config.sky.boardingSeconds,10,120)}</label><label>下降速度 / 米每秒${number('speed',config.sky.speed,10,100,'any')}</label></div><p>安全线在 100—2,000 米内，按以下区间抽取。</p><div class="sky-ranges">${config.sky.ranges.map(rangeRow).join('')}</div><button class="small-action" type="button" id="range-add">增加安全线区间</button></section></form>`;
 const form=$('#economy-form'),status=$('#economy-feedback');
 function collect(){const c=JSON.parse(JSON.stringify(config));for(const t of c.scratch){t.name='刮刮乐';t.cost=Number(form.elements['cost-'+t.id].value);t.returnPercent=Number(form.elements['return-'+t.id].value);}for(const key of ['boardingSeconds','speed'])c.sky[key]=Number(form.elements[key].value);c.sky.lossFraction=1;c.sky.ranges=[...form.querySelectorAll('.sky-range')].map(row=>({min:Number(row.querySelector('[name=rangeMin]').value),max:Number(row.querySelector('[name=rangeMax]').value),weight:Number(row.querySelector('[name=rangeWeight]').value)}));return c;}
 async function save(){
  if(!form.isConnected)return;if(!form.checkValidity()){status.textContent='请先填写有效数值；返还率范围为 0%—100%。';return;}
  if(saving){pending=true;return;}saving=true;status.textContent='正在保存…';
  try{config=await api('/api/admin/economy',{method:'PUT',body:JSON.stringify(collect())});if(form.isConnected){status.textContent='已自动保存，新的刮刮乐和架次按此设置生效。';for(const t of config.scratch){const output=form.querySelector('[data-prize-tier="'+t.id+'"]');output.textContent=prizes(t);output.closest('article').querySelector('h5').textContent='刮刮乐 · ¤ '+t.cost.toLocaleString()+' 档';}}}
  catch(e){if(form.isConnected)status.textContent=e.message+'；请刷新页面核对当前设置。';pending=false;}
  finally{saving=false;if(pending){pending=false;save();}}
 }
 form.onchange=()=>save();form.onsubmit=e=>{e.preventDefault();save();};
 form.onclick=e=>{const b=e.target.closest('[data-range-remove]');if(b){b.closest('.sky-range').remove();save();}};
 $('#range-add').onclick=()=>{form.querySelector('.sky-ranges').insertAdjacentHTML('beforeend',rangeRow({min:100,max:300,weight:1}));save();};
}
