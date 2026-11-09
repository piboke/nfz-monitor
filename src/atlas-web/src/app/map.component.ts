import {AfterViewInit,Component,ElementRef,EventEmitter,Input,OnChanges,OnDestroy,Output,ViewChild} from '@angular/core';
import {QueueRow} from './models';
import * as L from 'leaflet';
import 'leaflet.markercluster';
@Component({selector:'app-map',standalone:true,template:`<div #map class="map" aria-label="Mapa placówek" role="region"></div><p class="caption">{{located}} z {{rows.length}} kolejek ma współrzędne NFZ. Pozostałe są dostępne na liście. <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener">Zgłoś błąd mapy</a>.</p>`})
export class MapComponent implements AfterViewInit,OnChanges,OnDestroy {
 @Input() rows:QueueRow[]=[];@Output() selectQueue=new EventEmitter<QueueRow>();@ViewChild('map') el!:ElementRef;private map?:L.Map;private markers?:L.MarkerClusterGroup;located=0;
 ngAfterViewInit(){this.map=L.map(this.el.nativeElement).setView([52,19],6);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',updateWhenIdle:true,keepBuffer:1}).addTo(this.map);this.markers=L.markerClusterGroup();this.map.addLayer(this.markers);this.update();}
 ngOnChanges(){this.update();}ngOnDestroy(){this.map?.remove();}
 private update(){if(!this.map||!this.markers)return;this.markers.clearLayers();const valid=this.rows.filter(q=>q.latitude!==null&&q.longitude!==null&&!(q.latitude===0&&q.longitude===0));this.located=valid.length;
 for(const q of valid){const popup=document.createElement('div');const title=document.createElement('strong');title.textContent=q.provider;popup.append(title,document.createElement('br'),document.createTextNode(q.locality+' · '+(q.pcus??'brak PCUŚ')),document.createElement('br'));const button=document.createElement('button');button.textContent='Szczegóły placówki';button.addEventListener('click',()=>this.selectQueue.emit(q));popup.append(button);
 L.marker([q.latitude!,q.longitude!],{icon:L.divIcon({className:'nfz-marker',html:'<span></span>',iconSize:[16,16]})}).bindPopup(popup).addTo(this.markers);}
 if(valid.length)this.map.fitBounds(L.latLngBounds(valid.map(q=>[q.latitude!,q.longitude!] as L.LatLngTuple)),{padding:[35,35],maxZoom:11});}
}
