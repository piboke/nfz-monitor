export function median(values) {const n=values.filter(x=>x!==null&&Number.isFinite(x)).sort((a,b)=>a-b);return n.length===0?null:n.length%2?n[n.length>>1]:(n[n.length/2-1]+n[n.length/2])/2;}
export function filterRows(rows,f) {return rows.filter(q=>(!f.benefit||q.benefitId===f.benefit)&&(!f.province||q.province===f.province)&&(!f.category||String(q.case)===f.category)&&(!f.county||q.county===f.county)&&(!f.locality||q.locality.toLocaleLowerCase('pl').includes(f.locality.toLocaleLowerCase('pl')))&&(!f.provider||(q.provider+' '+q.place).toLocaleLowerCase('pl').includes(f.provider.toLocaleLowerCase('pl')))&&(!f.age||(f.age==='children'?q.forChildren===true:q.forChildren===false))&&(f.min===''||(q.pcusDays!==null&&q.pcusDays>=Number(f.min)))&&(f.max===''||(q.pcusDays!==null&&q.pcusDays<=Number(f.max))));}
// Keep the latest revision of each source period. Retrieval dates are never statistical periods.
export function periodSeries(history,metric,from='',to='') {
 const pcus=metric==='pcusDays';const revisions=new Map();
 for(const p of history){const period=pcus?p.pcusUpdatedAt:p.reportingPeriod;if(!period||from&&period<from||to&&period>to)continue;const key=p.id+'|'+p.case+'|'+period;const old=revisions.get(key);if(!old||old.retrievedAt<p.retrievedAt)revisions.set(key,p);}
 const groups=new Map();for(const p of revisions.values()){const period=pcus?p.pcusUpdatedAt:p.reportingPeriod;const values=groups.get(period)||[];if(p[metric]!==null)values.push(p[metric]);groups.set(period,values);}
 return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([period,values])=>({period,value:pcus?median(values):values.length?values.reduce((s,v)=>s+v,0):null,coverage:values.length}));
}
export function changes(history,metric,from,to) {
 const pcus=metric==='pcusDays';const at=period=>{const m=new Map();for(const p of history){if((pcus?p.pcusUpdatedAt:p.reportingPeriod)!==period)continue;const key=p.id+'|'+p.case;const old=m.get(key);if(!old||old.retrievedAt<p.retrievedAt)m.set(key,p);}return m;};
 const before=at(from),after=at(to);const result=[];
 for(const [key,p] of after){const old=before.get(key);if(p[metric]===null||old?.[metric]==null||p.facilityId!==old.facilityId||p.benefitId!==old.benefitId)continue;const delta=p[metric]-old[metric];result.push({id:p.id,case:p.case,delta,percent:old[metric]===0?null:delta*100/old[metric]});}return result;
}
