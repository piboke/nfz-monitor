import {Injectable,signal} from '@angular/core';
import {Manifest,QueueRow,HistoryPoint,Summary,Shard} from './models';
@Injectable({providedIn:'root'})
export class DataService {
 readonly manifest=signal<Manifest|null>(null);readonly summary=signal<Summary|null>(null);readonly error=signal('');
 private cache=new Map<string,Promise<unknown>>();
 async read<T>(path:string):Promise<T>{if(!/^[a-zA-Z0-9_./-]+$/.test(path)||path.includes('..'))throw new Error('Nieprawidłowa ścieżka danych.');
  if(!this.cache.has(path)){const task=fetch(new URL('data/'+path,document.baseURI)).then(async r=>{if(!r.ok)throw new Error('Nie udało się pobrać danych ('+r.status+'). Spróbuj ponownie.');return r.json();}).catch(e=>{this.cache.delete(path);throw e;});this.cache.set(path,task);}return await this.cache.get(path) as T;}
 async init(){try{const m=await this.read<Manifest>('manifest.json');if(m.schemaVersion!=='1.0')throw new Error('Nieobsługiwana wersja danych. Odśwież aplikację.');this.manifest.set(m);if(m.generation)this.summary.set(await this.read<Summary>(`aggregates/${m.generation}/summary.json`));}catch(e){this.error.set((e as Error).message);}}
 shards(benefit:string,province:string,category:string){return (this.manifest()?.shards||[]).filter(s=>s.benefitId===benefit&&(!province||s.province===province)&&(!category||String(s.case)===category));}
 async load(shards:Shard[],history=false){if(shards.length>32||shards.reduce((n,s)=>n+s.bytes,0)>30*1024*1024)throw new Error('Zawęź zakres do jednego świadczenia i mniejszego obszaru.');
 const rows:QueueRow[]=[];const points:HistoryPoint[]=[];for(let i=0;i<shards.length;i+=4){const batch=shards.slice(i,i+4);rows.push(...(await Promise.all(batch.map(s=>this.read<QueueRow[]>(s.path)))).flat());if(history)points.push(...(await Promise.all(batch.map(s=>this.read<HistoryPoint[]>(s.historyPath)))).flat());}return {rows,history:points};}
 async provider(province:string,code:string){if(!/^\d{1,20}$/.test(code))throw new Error('Nieprawidłowy kod świadczeniodawcy.');return this.read<{rows:QueueRow[];history:HistoryPoint[]}>(`aggregates/${this.manifest()!.generation}/providers/${province}/${code}.json`);}
}
