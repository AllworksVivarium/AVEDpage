// Unzoned values from the admin datetime-local field use company time (UTC+8).
export function announcementPublicationTime(value) {
 if(value===undefined||value==='')return undefined;
 if(typeof value!=='string')throw Error('请填写有效的公告发布时间。');
 const m=value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:\d{2})?$/);
 if(!m)throw Error('公告发布时间格式无效。');
 const [year,month,day,hour,minute,second]=m.slice(1,7).map(x=>Number(x||0));
 if(year<1000||month<1||month>12||day<1||day>new Date(Date.UTC(year,month,0)).getUTCDate()||hour>23||minute>59||second>59)throw Error('公告发布时间不是有效日期。');
 const zone=m[7]||'+08:00';let offset=0;
 if(zone!=='Z'){const hours=Number(zone.slice(1,3)),minutes=Number(zone.slice(4));if(hours>14||minutes>59||hours===14&&minutes!==0)throw Error('公告发布时间的时区无效。');offset=(hours*60+minutes)*(zone[0]==='-'?-1:1);}
 return new Date(Date.UTC(year,month-1,day,hour,minute,second)-offset*60000).toISOString();
}
