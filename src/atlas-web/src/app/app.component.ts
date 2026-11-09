import {Component,HostListener,OnInit,computed,inject,signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {DataService} from './data.service';
import {Aggregate,EMPTY_FILTERS,Filters,HistoryPoint,QueueRow,REGIONS} from './models';
import {filterRows,median,periodSeries,changes} from './analytics.mjs';
import {ChartComponent} from './chart.component';
import {MapComponent} from './map.component';

@Component({selector:'app-root',standalone:true,imports:[CommonModule,FormsModule,ChartComponent,MapComponent],templateUrl:'./app.component.html'})
export class AppComponent implements OnInit {
 readonly data=inject(DataService);readonly regions=REGIONS;readonly regionCodes=Object.keys(REGIONS);
 readonly nav=[['home','Przegląd'],['atlas','Atlas'],['radar','Radar'],['reports','Raporty'],['methodology','Metodologia'],['about','O projekcie']];
 readonly templates=['Dostępność leczenia w Polsce','Porównanie województw','Kolejki dla wybranego świadczenia','Dostępność leczenia w powiecie','Historia kolejek placówki','Największe wzrosty i spadki','Anomalie i braki w danych NFZ'];
 readonly view=signal('home');readonly loading=signal(false);readonly error=signal('');readonly rows=signal<QueueRow[]>([]);readonly history=signal<HistoryPoint[]>([]);
 readonly selected=signal<QueueRow[]>([]);readonly detailRows=signal<QueueRow[]>([]);readonly detailHistory=signal<HistoryPoint[]>([]);
 filters:Filters={...EMPTY_FILTERS};serviceText='';page=1;pageSize=20;sort='pcusDays';descending=false;display='list';dark=false;
 reportTemplate=2;from='';to='';metric:'awaiting'|'removed'|'pcusDays'='awaiting';group='province';chartType:'line'|'bar'='line';generatedAt=new Date();copied=false;
 private requestId=0;
 readonly benefits=computed(()=>[...new Map((this.data.manifest()?.shards??[]).map(s=>[s.benefitId,{id:s.benefitId,name:s.benefit}])).values()].sort((a,b)=>a.name.localeCompare(b.name,'pl')));
 readonly filtered=computed(()=>filterRows(this.rows(),this.filterSignal()));private filterSignal=signal<Filters>({...EMPTY_FILTERS});
 readonly counties=computed(()=>[...new Set(this.rows().filter(q=>!this.filterSignal().province||q.province===this.filterSignal().province).map(q=>q.county))].filter(Boolean).sort((a,b)=>a.localeCompare(b,'pl')));
 readonly periodOptions=computed(()=>[...new Set(this.history().map(p=>this.metric==='pcusDays'?p.pcusUpdatedAt:p.reportingPeriod).filter((p):p is string=>!!p))].sort());
 readonly series=computed(()=>{const allowed=new Map(this.filtered().map(q=>[q.id+'|'+q.case,q]));return this.history().filter(p=>{const q=allowed.get(p.id+'|'+p.case);return q?.facilityId===p.facilityId&&q?.benefitId===p.benefitId;});});
 // Getter inputs include configuration values to keep Angular's zoneless rendering predictable.
 get chartSeries(){return periodSeries(this.series(),this.metric,this.from,this.to);}
 get chartLabels(){return this.chartSeries.map(p=>p.period);}
 get chartValues(){return this.chartSeries.map(p=>p.value);}
 get metricLabel(){return this.metric==='pcusDays'?'Mediana PCUŚ (dni)':this.metric==='removed'?'Skreśleni z powodu udzielenia świadczenia':'Wpisy na listach oczekujących';}
 get comparison(){return changes(this.series(),this.metric,this.from,this.to).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));}
 get groupRegionLabels(){return this.nationalRegions.map(r=>REGIONS[r.key]);}
 get groupRegionValues(){return this.nationalRegions.map(r=>r.queues);}
 get medianPcus(){return median(this.filtered().map(q=>q.pcusDays));}
 get changeLabels(){return this.comparison.map(c=>this.queueName(c.id,c.case));}
 get changeValues(){return this.comparison.map(c=>c.percent);}
 queueName(id:string,category:number){const q=this.rows().find(q=>q.id===id&&q.case===category);return q?q.provider+' · '+q.locality+' ('+(category===1?'stabilny':'pilny')+')':id;}
 isJump(delta:number,percent:number|null){return this.metric==='pcusDays'?Math.abs(delta)>=90:Math.abs(delta)>=50&&(percent===null||Math.abs(percent)>=50);}
 comparisonLink(q:QueueRow){return '#/atlas?'+new URLSearchParams({benefit:q.benefitId,province:q.province,category:String(q.case)});}
 get comparisonMap(){return new Map(this.comparison.map(p=>[p.id+'|'+p.case,p]));}
 get sorted(){const key=this.sort as keyof QueueRow;return [...this.filtered()].sort((a,b)=>{const av=a[key],bv=b[key];if(av===null)return bv===null?0:1;if(bv===null)return -1;const d=typeof av==='number'&&typeof bv==='number'?av-bv:String(av).localeCompare(String(bv),'pl');return this.descending?-d:d;});}
 get paged(){return this.sorted.slice((this.page-1)*this.pageSize,this.page*this.pageSize);}
 get pages(){return Math.max(1,Math.ceil(this.filtered().length/this.pageSize));}
 get reportTitle(){return this.templates[this.reportTemplate];}
 get groups(){const groups=new Map<string,QueueRow[]>();for(const q of this.filtered()){const key=this.group==='province'?REGIONS[q.province]:this.group==='county'?q.county:this.group==='facility'?q.provider+' · '+q.locality:q.benefit;groups.set(key,[...(groups.get(key)??[]),q]);}return [...groups].map(([name,rows])=>({name,queues:rows.length,known:rows.filter(q=>q.awaiting!==null).length,awaiting:this.sum(rows,'awaiting'),removed:this.sum(rows,'removed'),pcus:median(rows.map(q=>q.pcusDays))})).sort((a,b)=>(b.awaiting??-1)-(a.awaiting??-1));}
 get groupLabels(){return this.groups.map(g=>g.name);}
 get groupValues(){return this.groups.map(g=>this.metric==='pcusDays'?g.pcus:this.metric==='removed'?g.removed:g.awaiting);}
 get detail(){return this.detailRows()[0];}
 get detailSeries(){const q=this.detail;if(!q)return [];return periodSeries(this.detailHistory().filter(p=>p.id===q.id&&p.case===q.case),'awaiting');}
 get detailLabels(){return this.detailSeries.map(p=>p.period);}
 get detailValues(){return this.detailSeries.map(p=>p.value);}
 get nationalRegions(){return this.data.summary()?.regions??[];}
 async ngOnInit(){try{this.dark=localStorage.getItem('nfz-theme')==='dark'||(!localStorage.getItem('nfz-theme')&&matchMedia('(prefers-color-scheme: dark)').matches);}catch{}this.applyTheme();await this.data.init();await this.restore();}
 @HostListener('window:hashchange') async hashChanged(){await this.restore();}
 async restore(){const [path,query='']=location.hash.replace(/^#\/?/,'').split('?');const params=new URLSearchParams(query);this.view.set(this.nav.some(n=>n[0]===path)||path==='facility'?path:'home');
 const next={...EMPTY_FILTERS};for(const key of Object.keys(next) as (keyof Filters)[])if(params.has(key))next[key]=params.get(key)!.slice(0,250);this.filters=next;
 if(!this.filters.benefit&&this.benefits().length){this.filters.benefit=this.benefits()[0].id;}
 this.serviceText=this.benefits().find(b=>b.id===this.filters.benefit)?.name??'';this.filterSignal.set({...this.filters});
 this.from=params.get('from')??'';this.to=params.get('to')??'';this.metric=['awaiting','removed','pcusDays'].includes(params.get('metric')??'')?params.get('metric') as typeof this.metric:'awaiting';this.group=['province','county','facility','benefit'].includes(params.get('group')??'')?params.get('group')!:'province';this.reportTemplate=Math.max(0,Math.min(6,Number(params.get('template'))||0));
 if(['atlas','radar','reports'].includes(this.view()))await this.load();
 if(this.view()==='facility'&&params.has('code')&&params.has('province'))await this.loadProvider(params.get('province')!,params.get('code')!,params.get('queue')??'');
 }
 navigate(view:string){location.hash='/'+view;}
 toggleTheme(){this.dark=!this.dark;this.applyTheme();try{localStorage.setItem('nfz-theme',this.dark?'dark':'light');}catch{}}
 private applyTheme(){document.documentElement.dataset['theme']=this.dark?'dark':'light';}
 updateUrl(){const p=new URLSearchParams();for(const [k,v] of Object.entries(this.filters))if(v)p.set(k,v);if(this.from)p.set('from',this.from);if(this.to)p.set('to',this.to);p.set('metric',this.metric);p.set('group',this.group);p.set('template',String(this.reportTemplate));history.replaceState(null,'','#/'+this.view()+'?'+p);}
 async load(){const id=++this.requestId;this.error.set('');this.loading.set(true);this.page=1;this.filterSignal.set({...this.filters});this.updateUrl();
 try{if(!this.filters.benefit)throw new Error('Wybierz świadczenie z listy podpowiedzi.');const result=await this.data.load(this.data.shards(this.filters.benefit,this.filters.province,this.filters.category),true);if(id!==this.requestId)return;this.rows.set(result.rows);this.history.set(result.history);this.configurePeriods();}catch(e){if(id===this.requestId){this.rows.set([]);this.history.set([]);this.error.set((e as Error).message);}}finally{if(id===this.requestId)this.loading.set(false);}}
 localFilters(){this.filters.min=this.filters.min==null?'':String(this.filters.min);this.filters.max=this.filters.max==null?'':String(this.filters.max);this.page=1;this.filterSignal.set({...this.filters});this.updateUrl();}
 async serviceChanged(){const match=this.benefits().find(b=>b.name.toLocaleLowerCase('pl')===this.serviceText.toLocaleLowerCase('pl'));this.filters.benefit=match?.id??'';if(match)await this.load();}
 async reset(){this.filters={...EMPTY_FILTERS,benefit:this.benefits()[0]?.id??''};this.serviceText=this.benefits()[0]?.name??'';this.from='';this.to='';await this.load();}
 setSort(key:string){if(this.sort===key)this.descending=!this.descending;else{this.sort=key;this.descending=false;}this.page=1;}
 pick(q:QueueRow){const found=this.selected().some(p=>p.id===q.id&&p.case===q.case);if(found)this.selected.update(rows=>rows.filter(p=>!(p.id===q.id&&p.case===q.case)));else if(this.selected().length<4)this.selected.update(rows=>[...rows,q]);}
 isPicked(q:QueueRow){return this.selected().some(p=>p.id===q.id&&p.case===q.case);}
 openFacility(q:QueueRow){location.hash='/facility?province='+q.province+'&code='+encodeURIComponent(q.providerCode)+'&queue='+q.id;}
 private async loadProvider(province:string,code:string,queue:string){this.loading.set(true);this.error.set('');try{const detail=await this.data.provider(province,code);this.detailRows.set([...detail.rows].sort((a,b)=>Number(b.id===queue)-Number(a.id===queue)));this.detailHistory.set(detail.history);}catch(e){this.error.set((e as Error).message);}finally{this.loading.set(false);}}
 chooseDetail(q:QueueRow){this.detailRows.set([q,...this.detailRows().filter(x=>x!==q)]);}
 private configurePeriods(){const periods=this.availablePeriods();if(!periods.includes(this.from))this.from=periods.length>1?periods[periods.length-2]:periods[0]??'';if(!periods.includes(this.to))this.to=periods.at(-1)??'';}
 availablePeriods(){return [...new Set(this.history().map(p=>this.metric==='pcusDays'?p.pcusUpdatedAt:p.reportingPeriod).filter((p):p is string=>!!p))].sort();}
 metricChanged(){this.configurePeriods();this.updateUrl();}
 templateChanged(){this.group=this.reportTemplate===3?'county':this.reportTemplate===4?'facility':'province';this.chartType=this.reportTemplate===1?'bar':'line';this.updateUrl();}
 async share(){this.updateUrl();try{await navigator.clipboard.writeText(location.href);this.copied=true;setTimeout(()=>this.copied=false,2500);}catch{this.error.set('Skopiuj adres widoczny w pasku przeglądarki — zawiera konfigurację widoku.');}}
 print(){this.generatedAt=new Date();window.print();}
 sum(rows:QueueRow[],key:'awaiting'|'removed'){const known=rows.map(q=>q[key]).filter((n):n is number=>n!==null);return known.length?known.reduce((a,b)=>a+b,0):null;}
 number(n:number|null|undefined){return n==null?'brak danych':new Intl.NumberFormat('pl-PL',{maximumFractionDigits:1}).format(n);}
 freshness(q:QueueRow){if(!q.reportingPeriod||!q.pcusUpdatedAt)return 'Brak dat';const days=(Date.now()-Date.parse(q.pcusUpdatedAt))/86400000;const period=Date.parse(q.reportingPeriod+'-01');const current=new Date();const cutoff=new Date(current.getFullYear(),current.getMonth()-2,1);return days>35||days<0||period<cutoff.getTime()?'Dane opóźnione':'Dane aktualne';}
 homeSearch(){const b=this.benefits().find(b=>b.name===this.serviceText);const params=new URLSearchParams({benefit:b?.id??this.benefits()[0]?.id??'',category:'1',province:this.filters.province});location.hash='/atlas?'+params;}
 regionSummary(code:string):Aggregate|undefined{return this.nationalRegions.find(r=>r.key===code);}
 readonly regionPositions:Record<string,[number,number]>={'01':[22,64],'02':[44,36],'03':[77,60],'04':[12,45],'05':[48,56],'06':[53,82],'07':[66,44],'08':[34,72],'09':[73,82],'10':[85,29],'11':[43,14],'12':[44,74],'13':[63,68],'14':[64,18],'15':[30,44],'16':[16,20]};
 regionStyle(code:string){const r=this.regionSummary(code);return r?{'left':this.regionPositions[code][0]+'%','top':this.regionPositions[code][1]+'%','background':r.freshPercent>=80?'#222b36':'#b60500'}:{'left':this.regionPositions[code][0]+'%','top':this.regionPositions[code][1]+'%','background':'#717985'};}
 openRegion(code:string){location.hash='/atlas?'+new URLSearchParams({province:code,benefit:this.benefits()[0]?.id??'',category:'1'});}
}
