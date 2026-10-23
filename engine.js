/* Planning engine. Recorded directional routes and published services take priority. */
(function(root){
'use strict';
const ORIGIN={id:'busan',name:'부산역',type:'transit',coord:[129.0415,35.1152]};
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n)),round5=n=>Math.ceil(n/5)*5;
const finite=(v,f)=>Number.isFinite(Number(v))&&v!==null&&v!==''?Number(v):f;
function origin(r,back=false){return{...ORIGIN,...(back?r.transport?.return?.busanHub:r.transport?.busanHub),id:'busan'};}
function km(a,b){const rad=Math.PI/180,p1=a.coord[1]*rad,p2=b.coord[1]*rad,dp=p2-p1,dl=(b.coord[0]-a.coord[0])*rad;return 6371*2*Math.asin(Math.sqrt(Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2));}
function travel(r,a,b,mode='taxi',override){
 if(!a||!b||a.id===b.id)return{minutes:0,low:0,high:0,mode,note:'같은 장소'};
 if(mode==='car'&&!r.carAllowed)mode='taxi';
 if(Number.isFinite(override)){const n=clamp(Math.round(override),0,600);return{minutes:n,low:n,high:n,mode,note:'직접 입력한 이동시간',manual:true};}
 if(a.complex&&a.complex===b.complex)return{minutes:10,low:5,high:20,mode:'walk',estimate:true,onsite:true,note:'같은 시설·단지 내부 이동입니다. 주차 후 도보10분을 확보한 계획값이며, 실내 출입구·동선은 현장에서 확인하세요.'};
 const known=(r.transferOverrides||[]).find(x=>x.from===a.id&&x.to===b.id&&x.mode===mode);
 const routeMode=mode==='car'||mode==='taxi'?'road':mode;
 const rec=r.routes?.[a.id+'>'+b.id+':'+routeMode],intercity=a.id==='busan'||b.id==='busan';
 const routeA=routeMode==='road'&&a.roadCoord?{coord:a.roadCoord}:a,routeB=routeMode==='road'&&b.roadCoord?{coord:b.roadCoord}:b,access=routeMode==='road'?(a.roadAccessMinutes||0)+(b.roadAccessMinutes||0):0;
 if(rec?.status==='ok'&&rec.seconds>=0&&(!rec.fromCoord||km(routeA,{coord:rec.fromCoord})<.03)&&(!rec.toCoord||km(routeB,{coord:rec.toCoord})<.03)){
  const raw=Math.ceil(rec.seconds/60),buffer=mode==='car'?10:mode==='taxi'?8:mode==='transit'?10:0,traffic=intercity?Math.max(20,round5(raw*.2)):0,n=round5(Math.max(5,raw)+buffer+traffic+access);
  return{minutes:n,low:raw+buffer+access,high:n+round5(Math.max(5,raw*.2)),rawMinutes:raw,bufferMinutes:buffer+traffic+access,meters:rec.meters,mode,verified:true,checkedAt:rec.checkedAt,sourceUrl:rec.sourceUrl,note:'카카오 '+(routeMode==='road'?'자동차 경로':mode==='walk'?'도보 경로':'대중교통 경로')+' 조회 '+raw+'분 + '+(buffer+traffic)+'분 '+(intercity?'도로 지연·승하차':'승하차·대기')+' 여유.'+(access?' 차량 하차점↔시설 도보 '+access+'분 추가(계획값).':'')+' 조회 시점 결과이며 여행일 평균·실시간 보장은 아닙니다.'};
 }
 if(known&&Number.isFinite(known.minutes))return{minutes:known.minutes,low:round5(known.minutes*.85),high:round5(known.minutes*1.2),mode,note:known.note||'별도 조사한 구간의 계획 이동시간',sourceUrl:known.sourceUrl,recorded:true};
 const distance=km(routeA,routeB),urban=['seoul','daejeon','suwon','sejong','changwon','ulsan','gimhae'].includes(r.id);
 let base, note;
 if(intercity&&r.carAllowed){
  const hub=r.points.find(x=>x.id===r.transport?.hubId)||{coord:r.center},reference=Math.max(10,km(origin(r),hub)),baseline=(b.id==='busan'?r.return:r.arrival).minutes;
  base=baseline*clamp(distance/reference,.35,2)+Math.max(20,baseline*.2)+10;
  note='부산역↔지역 도심 대표시간을 실제 방문지 거리로 보정하고 도로 지연·주차 여유를 더한 계획치. 해당 구간 길찾기 조회 전입니다.';
 }else{
  const road=distance*(urban?1.4:1.6);
  base=mode==='walk'?road/4*60:mode==='transit'?road/(urban?19:22)*60+(distance<1?10:25):road/(distance>25?45:urban?25:30)*60+(mode==='car'?10:8);
  note=mode==='transit'?'이 구간 대중교통 노선은 미조회입니다. 거리·대기 추정으로 실제 환승·배차에 따라 크게 달라질 수 있습니다.':'이 구간 길찾기는 미조회입니다. 좌표 거리·우회·승하차 여유를 반영한 임시 계획치입니다.';
 }
 const failed=r.routeFailures?.[a.id+'>'+b.id+':'+routeMode];if(failed)note=(failed==='NO_RESULTS'?'지도 조회에서 이용 가능한 경로를 찾지 못했습니다. 배차·운영 여부를 직접 확인하세요. ':'지도 조회가 완료되지 않은 구간입니다. ')+note.replace('이 구간 대중교통 노선은 미조회입니다. ','').replace('이 구간 길찾기는 미조회입니다. ','');
 const mid=round5(Math.max(mode==='walk'?5:10,base)+access);
 return{minutes:mid,low:round5(mid*.8),high:round5(mid*1.35),mode,note,estimate:true};
}
function createPlan(r,index=0){
 index=clamp(Math.trunc(finite(index,0)),0,r.courses.length-1);
 const c=r.courses[index]||r.courses[0],hotel=c.hotel||r.points.find(p=>p.type==='hotel')?.id,t=r.transport||{},first=t.arrival?.services?.[0];
 const p={version:2,region:r.id,baseCourse:index,name:c.name,hotel,friday:false,departFriday:1140,departSaturday:first?Math.max(0,first.departureMinute-30-(t.boardingBuffer||25)):Math.max(240,540-(r.arrival.minutes||90)-30),busanAccess:30,starts:[540,540,540],mode:r.defaultMode||(r.carAllowed?'car':'taxi'),items:c.days.map((ids,d)=>ids.map((id,i)=>({uid:r.id+'-'+index+'-'+d+'-'+i,poi:id,duration:c.durations?.[id]||r.points.find(p=>p.id===id)?.visitMin||60,start:null,mode:c.modes?.[id]||null,travel:null}))),extra:0};
 const h=r.points.find(x=>x.id===hotel),hub=r.points.find(x=>x.id===t.hubId)||r.points.find(x=>x.type==='transit');
 let prev=h,total=30;for(const item of p.items[2]){const q=r.points.find(x=>x.id===item.poi);total+=travel(r,prev,q,p.mode).minutes+item.duration;prev=q;}
 const service=t.return?.services?.[0],target=service?service.departureMinute-(t.boardingBuffer||25):900;
 total+=travel(r,prev,r.carAllowed?origin(r,true):hub,p.mode).minutes;
 p.starts[2]=Math.min(540,Math.max(300,Math.floor((target-total)/5)*5));
 return p;
}
function normalizePlan(r,input){
 if(!input||!Array.isArray(input.items)||input.items.length!==3)throw Error('3일 일정 형식이 아닙니다.');
 const p=createPlan(r,input.baseCourse);
 p.edited=Boolean(input.edited);p.name=String(input.name||p.name).slice(0,80);p.hotel=r.points.some(x=>x.id===input.hotel&&x.type==='hotel')?input.hotel:p.hotel;
 p.friday=Boolean(input.friday);p.departFriday=clamp(finite(input.departFriday,1140),900,1380);p.departSaturday=clamp(finite(input.departSaturday,p.departSaturday),0,1380);p.busanAccess=clamp(finite(input.busanAccess,30),0,180);
 p.starts=[0,1,2].map(i=>clamp(finite(input.starts?.[i],p.starts[i]),0,1380));p.mode=['walk','taxi','transit','car'].includes(input.mode)?input.mode:p.mode;if(!r.carAllowed&&p.mode==='car')p.mode='taxi';
 p.extra=clamp(finite(input.extra,0),0,10000000);
 p.items=input.items.map((items,d)=>{if(!Array.isArray(items))throw Error('일자별 장소 배열이 필요합니다.');return items.slice(0,30).filter(x=>x&&r.points.some(v=>v.id===x.poi&&!['hotel','transit'].includes(v.type))).map((x,i)=>({uid:r.id+'-saved-'+d+'-'+i,poi:x.poi,duration:clamp(finite(x.duration,60),15,720),start:x.start==null?null:clamp(finite(x.start,0),0,1439),mode:['car','taxi','transit','walk'].includes(x.mode)?x.mode:null,travel:x.travel==null?null:clamp(finite(x.travel,0),0,600)}));});
 return p;
}
function schedule(r,p){
 const tr=r.transport||{},lookup=id=>id==='busan'?origin(r):r.points.find(x=>x.id===id),hotel=lookup(p.hotel),hub=lookup(tr.hubId)||r.points.find(x=>x.type==='transit')||hotel;
 const out={days:[],warnings:[],steps:[],edges:[],hotel,cost:0,costParts:{hotel:0,intercity:0,local:0,food:0,tickets:0,extra:p.extra||0},returnMinute:0,returnHub:origin(r,true).name,routeCoverage:{verified:0,estimate:0,manual:0,onsite:0},unconfirmedService:false};
 if(!hotel)throw Error('숙소 후보가 없습니다.');
 const weekday={0:6,1:0,2:1,'-1':5};
 function makeDay(day){const v={day,blocks:[],warnings:[],travelMin:0,visitMin:0};out.days.push(v);return v;}
 function add(d,kind,start,end,point,title,extra={}){const b={kind,start,end,poi:point?.id,title:title||point?.name,...extra};d.blocks.push(b);if(point&&kind!=='wait')out.steps.push({day:d.day,poi:point.id,start,end,uid:extra.uid,kind});return b;}
 function warn(d,text){d.warnings.push(text);out.warnings.push(text);}
 function leg(d,a,b,t,mode,override,itemUid){const v=travel(r,a,b,mode,override);if(v.minutes){add(d,'travel',t,t+v.minutes,b,a.name+' → '+b.name,{...v,from:a.id,to:b.id,uid:itemUid?'travel-'+itemUid:undefined});d.travelMin+=v.minutes;out.edges.push({from:a.id,to:b.id,day:d.day,mode:v.mode,minutes:v.minutes});out.routeCoverage[v.onsite?'onsite':v.verified?'verified':v.manual?'manual':'estimate']++;
   if(v.mode==='taxi')out.costParts.local+=Math.max(5000,Math.round((3500+(v.meters?v.meters/1000:km(a,b)*1.5)*1400)/1000)*1000);else if(v.mode==='car')out.costParts.local+=Math.round((v.meters?v.meters/1000:km(a,b)*1.5)*250)+2500;else if(v.mode==='transit')out.costParts.local+=5000;
  }return t+v.minutes;
 }
 function intercity(d,a,b,t,back=false){
  const conf=back?(tr.return||r.return):(tr.arrival||r.arrival),services=back?conf.services:(d.day===-1?conf.fridayServices:conf.services),board=tr.boardingBuffer||25,ready=t+board;
  const service=(services||[]).filter(s=>s.departureMinute>=ready).sort((a,b)=>a.departureMinute-b.departureMinute)[0];
  let depart,end;
  if(service){depart=service.departureMinute;end=service.arrivalMinute;add(d,'wait',t,depart,null,'승차 준비 '+board+'분'+(depart-ready>0?' · 배차 대기 '+(depart-ready)+'분':''));}
  else{depart=ready;end=depart+conf.minutes;add(d,'wait',t,depart,null,'승차 준비 · 실제 배차 미확인');warn(d,(back?'귀환':'출발')+' 참고편에 맞지 않습니다. '+time(ready)+' 이후 실제 배차를 확인해야 하며, 아래 도착은 탑승시간만 더한 가정입니다.');out.unconfirmedService=true;}
  const note=service?service.service+' · '+service.status:'배차 미확인 · '+conf.summary;
  add(d,'travel',depart,end,b,a.name+' → '+b.name,{minutes:end-depart,low:end-depart,high:end-depart+(service?.delayBufferMin||0),mode:conf.mode,from:a.id,to:b.id,note,serviceName:service?.service,sourceUrl:service?.sourceUrl||conf.bookingUrl,scheduled:Boolean(service)});out.edges.push({from:a.id,to:b.id,day:d.day,mode:conf.mode,minutes:end-depart});d.travelMin+=end-depart;
  if(service?.delayBufferMin){add(d,'wait',end,end+service.delayBufferMin,null,'광역 이동 지연 여유 '+service.delayBufferMin+'분');end+=service.delayBufferMin;}return end;
 }
 function depart(d,t,destination){
  if(r.carAllowed){add(d,'origin',t,t+10,origin(r),'부산 출발 준비');return leg(d,origin(r),destination,t+10,'car');}
  add(d,'origin',t,t+p.busanAccess,origin(r),'부산 내 출발역·터미널 접근 '+p.busanAccess+'분 (설정 가능)');return intercity(d,origin(r),hub,t+p.busanAccess);
 }
 if(p.friday){const d=makeDay(-1);let t=depart(d,p.departFriday,hotel);if(!r.carAllowed)t=leg(d,hub,hotel,t,p.mode);add(d,'hotel',t,Math.max(1440,t+30),hotel,'체크인 · 금요일 숙박');if(t>1320)warn(d,'금요일 늦은 체크인('+time(t)+') 가능 여부를 숙소에 확인하세요.');if(t>1440)warn(d,'금요일 이동이 자정을 넘습니다. 숙소의 예약 날짜와 야간 입실을 확인하세요.');}
 for(let day=0;day<3;day++){
  const d=makeDay(day);let t,prev=hotel,firstDirect=false;
  if(day===0&&!p.friday){
   if(r.carAllowed){prev=origin(r);t=p.departSaturday;add(d,'origin',t,t+10,prev,'부산 출발 준비 · 짐은 차량 보관');t+=10;firstDirect=true;}
   else{t=depart(d,p.departSaturday);t=leg(d,hub,hotel,t,p.mode);add(d,'hotel',t,t+20,hotel,'숙소 짐 보관 (사전 확인)');t+=20;}
  }else{t=p.starts[day];add(d,'hotel',0,t,hotel,day===2?'숙박 · 조식 · 체크아웃 준비':'숙박 · 조식');if(day===2){add(d,'hotel',t,t+30,hotel,'체크아웃');t+=30;if(t>(hotel.checkOutMin||660))warn(d,'숙소 체크아웃 '+time(t)+'가 퇴실 시각 '+time(hotel.checkOutMin||660)+'보다 늦습니다.');}}
  for(const item of p.items[day]){
   const q=lookup(item.poi);if(!q)continue;t=leg(d,prev,q,t,firstDirect?'car':item.mode||p.mode,item.travel,item.uid);firstDirect=false;
   if(item.start!=null){if(item.start>t){add(d,'wait',t,item.start,null,'여유·대기');t=item.start;}else if(item.start<t)warn(d,q.name+': 희망 시작 '+time(item.start)+'보다 이동 완료가 '+time(t)+'로 늦습니다.');}
   const h={...(q.hours||{}),...(q.hours?.byDay?.[weekday[day]]||{})};if(Array.isArray(h.closedDays)&&h.closedDays.includes(weekday[day]))warn(d,q.name+': '+date(day)+' 정기 휴무와 겹칩니다.');
   if(Number.isFinite(h.open)&&t<h.open){add(d,'wait',t,h.open,null,q.name+' 개장 대기');t=h.open;}
   if(!Number.isFinite(h.open)&&Number.isFinite(h.planningStart)&&t<h.planningStart){add(d,'wait',t,h.planningStart,null,q.name+' 계획 방문 시각까지 여유 (영업 확인 필요)');t=h.planningStart;}
   if(h.planningStart)warn(d,q.name+': 영업시간 미확인으로 계획 방문 시각을 사용했습니다. 예약 전 운영 여부를 확인하세요.');
   const plannedDuration=clamp(finite(item.duration,q.visitMin||60),15,720);
   for(const [start,end] of h.breaks||[]){if(t<end&&t+plannedDuration>start){add(d,'wait',t,end,null,q.name+' 준비시간 이후 방문');t=end;}}
   if(h.sessions?.length){const next=h.sessions.find(s=>s>=t);if(next!==undefined&&next>t){add(d,'wait',t,next,null,q.name+' 예약 회차 대기');t=next;}else if(next===undefined)warn(d,q.name+': 마지막 안내 회차를 지났습니다. 예약 회차를 바꿔주세요.');}
   const duration=clamp(finite(item.duration,q.visitMin||60),15,720);add(d,'visit',t,t+duration,q,null,{uid:item.uid,duration});d.visitMin+=duration;
   if(Number.isFinite(h.close)&&t+duration>h.close)warn(d,q.name+': 계획 종료 '+time(t+duration)+'가 안내된 마감 '+time(h.close)+'보다 늦습니다.');
   if(t+duration>1440)warn(d,date(day)+' 일정이 자정을 넘습니다. 장소 수나 체류시간을 줄여주세요.');
   if(q.type==='food'||q.type==='cafe')out.costParts.food+=(q.cost||0)*2;else out.costParts.tickets+=(q.cost||0)*2;t+=duration;prev=q;
  }
  if(day===2){if(r.carAllowed)t=leg(d,prev,origin(r,true),t,'car');else{t=leg(d,prev,hub,t,p.mode);t=intercity(d,hub,origin(r,true),t,true);}add(d,'origin',t,t+10,origin(r,true),'부산 도착 · '+origin(r,true).name);out.returnMinute=t;if(t>960)warn(d,'월요일 부산 도착 '+time(t)+' — 16:00보다 '+(t-960)+'분 늦습니다.');else if(t>930)warn(d,'부산 도착 '+time(t)+' — 16시까지 여유가 30분 미만입니다.');}
  else{t=leg(d,prev,hotel,t,firstDirect?'car':p.mode);const checkin=day===0&&!p.friday?Math.max(hotel.checkInMin||900,t):t;if(checkin>t)add(d,'wait',t,checkin,null,'체크인 전 여유');add(d,'hotel',checkin,Math.max(1440,checkin+15),hotel,'같은 객실에서 숙박');if(checkin>1380)warn(d,date(day)+' 숙소 복귀가 '+time(checkin)+'로 늦습니다.');}
 }
 out.costParts.hotel=(hotel.cost||150000)*(p.friday?3:2);
 const fares={namhae:80000,yeosu:100000,suncheon:100000,imsil:150000,pohang:70000,yeongdeok:90000,mungyeong:100000,andong:100000,daejeon:150000,sejong:170000,jeonju:130000,uljin:110000,yongin:210000,suwon:190000,seoul:220000};
 out.costParts.intercity=r.carAllowed?30000:(r.intercityCost||fares[r.id]||150000);
 const meals=p.items.flat().map(x=>lookup(x.poi)).filter(x=>x?.type==='food').length;out.costParts.food+=Math.max(0,(p.friday?9:7)-meals)*40000;
 out.cost=Object.values(out.costParts).reduce((a,b)=>a+b,0);
 if(hotel.room?.bathStatus!=='confirmed')out.warnings.push('선택한 숙소는 객실 내 욕조·스파 확약이 필요합니다.');
 if(out.cost>1200000)out.warnings.push('2인 예상 합계가 목표 120만원을 넘습니다. 실제 예약가와 교통비를 비교하세요.');
 out.hoursUnconfirmed=[...new Set(out.steps.filter(s=>s.kind==='visit').map(s=>lookup(s.poi)).filter(q=>!Number.isFinite(q.hours?.open)||!Number.isFinite(q.hours?.close)).map(q=>q.name))];
 const aquaria=r.points.filter(x=>x.aquarium);if(aquaria.length&&!p.items.flat().some(x=>aquaria.some(a=>a.id===x.poi)))out.warnings.push('이 지역 아쿠아리움이 아직 내 일정에 없습니다.');
 return out;
}
function time(n){const next=n>=1440?'익일 ':'';const m=((Math.round(n)%1440)+1440)%1440;return next+String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');}
function date(d){return ['11.28 토','11.29 일','11.30 월'][d]||'11.27 금';}
const api={ORIGIN,origin,km,travel,createPlan,normalizePlan,schedule,time,date,clamp};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TripEngine=api;
})(typeof window!=='undefined'?window:this);
