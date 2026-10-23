// Executes the shipped event handlers and scheduling state with a lightweight DOM fixture.
// This validates interaction logic, not rendered geometry or real touch hardware.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('ui.js','utf8'),DATA=require('./data.json'),E=require('./engine.js');
const nodes=new Map(),listeners={},windowListeners={};let checks=0,clock=1000;
const classList=()=>{const s=new Set();return{add:x=>s.add(x),remove:x=>s.delete(x),contains:x=>s.has(x)}};
function el(id){if(!nodes.has(id))nodes.set(id,{id,tagName:'DIV',innerHTML:'',textContent:'',value:'',dataset:{},style:{},attrs:{},hidden:false,open:false,scrollLeft:0,scrollTop:0,scrollWidth:1440,clientWidth:600,classList:classList(),children:[],
 setAttribute(k,v){this.attrs[k]=String(v)},removeAttribute(k){delete this.attrs[k]},getBoundingClientRect(){return{left:0,top:0,right:600,bottom:400,width:600,height:400}},addEventListener(){},focus(){doc.activeElement=this},showModal(){this.open=true},close(){this.open=false},closest(){return{scrollIntoView(){}}},querySelectorAll(){return[]},setSelectionRange(){}});return nodes.get(id)}
const doc={getElementById:el,activeElement:{tagName:'BODY',dataset:{}},addEventListener(type,fn){(listeners[type]??=[]).push(fn)},querySelectorAll(){return[]},hidden:false};
el('travelData').textContent=JSON.stringify(DATA);el('embeddedPlans').textContent='{}';
const context={TripEngine:E,document:doc,window:{addEventListener(type,fn){(windowListeners[type]??=[]).push(fn)}},localStorage:{getItem:()=>null,setItem(){}},matchMedia:()=>({matches:false}),performance:{now:()=>clock},location:{hash:''},requestAnimationFrame(){},setTimeout:()=>1,clearTimeout(){},Map,Set};
vm.createContext(context);vm.runInContext(source.slice(0,source.indexOf('new ResizeObserver(')),context);
vm.runInContext('for(const name of ["renderPins","renderRoutes","updatePins","closeRegions"])this[name]=()=>{};',context);
const run=s=>vm.runInContext(s,context),snap=()=>run('JSON.stringify(plan())'),check=(v,m)=>{assert(v,m);checks++};
function target(data={},id='',value=''){const t={id,value,dataset:data,tagName:'BUTTON',classList:classList(),closest(sel){for(const selector of sel.split(',')){const m=selector.trim().match(/^\[data-([\w-]+)\]$/);if(m){const k=m[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase());if(k in data)return t;}}return null}};return t;}
function click(data){const t=target(data);for(const fn of listeners.click||[])fn({target:t,clientX:0,clientY:0,preventDefault(){}})}
function change(id,value){const t=target({},id,value);for(const fn of listeners.change||[])fn({target:t})}
function key(k,extra={}){let prevented=false;for(const fn of listeners.keydown||[])fn({key:k,code:'',target:target(),preventDefault(){prevented=true},...extra});return prevented}
const uid=()=>run('plan().items[state.day][0]?.uid'),select=(id,c=0)=>run(`selectRegion(${JSON.stringify(id)},${c},false);undo=[];redo=[];`);
const fragments=[];
for(const r of DATA)for(let c=0;c<r.courses.length;c++){
 select(r.id,c);const before=snap(),n=run('plan().items[0].length'),candidate=r.points.find(p=>!['hotel','transit'].includes(p.type));
 click({action:'add-place'});check(el('dialog').open&&el('dialog').dataset.kind==='place-picker','add button opens picker');
 fragments.push({name:r.id+'/'+c+'/picker',html:el('dialogBody').innerHTML});const beforeUid=uid();change('pickerBefore',beforeUid);click({pick:candidate.id});const added=run('state.editUid');
 check(run('plan().items[0][0].uid')===added,'picker inserts before a specified visit');
 check(run('plan().items[0].length')===n+1,'insertion preserves existing visits');
 check(el('dialogBody').innerHTML.includes('이 날짜에 포함'),'picker immediately reflects additions');el('dialog').close();
 const duration=run('findItem(state.editUid).item.duration');click({resizeStop:added,delta:'15'});
 check(run('findItem(state.editUid).item.duration')===duration+15,'duration increase from card');
 click({resizeStop:added,delta:'-15'});check(run('findItem(state.editUid).item.duration')===duration,'duration decrease from card');
 click({shiftStop:added,delta:'1'});check(run('findItem(state.editUid).index')===1,'card arrow reorders');
 check(run('result.days[0].blocks.filter(b=>b.kind==="visit")[1].uid')===added,'schedule uses reordered visits');
 click({relocate:added});el('moveDay').value='1';change('moveDay','1');el('movePosition').value='0';click({action:'apply-move'});
 check(run('findItem(state.editUid).day')===1&&run('findItem(state.editUid).index')===0,'move dialog changes date and position');
 check(!el('dialog').open&&run('state.day')===1,'move opens target date and closes dialog');
 const moved=snap();click({removeStop:added});check(!run(`findItem(${JSON.stringify(added)})`),'delete removes correct occurrence');
 click({action:'undo'});check(snap()===moved,'undo restores exact item settings and order');
 click({action:'redo'});check(!run(`findItem(${JSON.stringify(added)})`),'redo deletes same occurrence');
 click({action:'undo'});click({resizeStop:added,delta:'15'});check(run('redo.length')===0,'new edit clears redo branch');
 for(let day=0;day<3;day++){run(`state.day=${day};renderPlanner();`);fragments.push({name:r.id+'/'+c+'/day'+day,html:el('planner').innerHTML});check(el('planner').innerHTML.includes('data-planner-view="sequence"'),'visit order view is always accessible');check(el('planner').innerHTML.includes('id="timeCanvas"'),'24h timeline remains available');}
 // Preserve generated fragments for independent HTML structure validation.
 fragments.push({name:r.id+'/'+c,html:el('planner').innerHTML});
 click({plannerView:'sequence'});fragments.push({name:r.id+'/'+c+'/sequence',html:el('planner').innerHTML});check(run('state.plannerView')==='sequence','view switch selects editable sequence');
 click({plannerView:'timeline'});click({action:'expand-planner'});check(run('state.plannerExpanded'),'expand works');click({action:'expand-planner'});
 run('result=E.schedule(region(),plan());');for(const day of run('result.days'))for(let i=1;i<day.blocks.length;i++)check(day.blocks[i].start>=day.blocks[i-1].end,'edited blocks remain chronological');
}
// Limits and duplicates: rejected operations must never drop or silently truncate visits.
select('geoje');run('plan().items=[[],[],[]];refresh();');const poi=DATA.find(r=>r.id==='geoje').points.find(p=>p.type==='cafe').id;
for(let i=0;i<30;i++)context.addPoint(poi,1);const full=snap(),history=run('undo.length');check(context.addPoint(poi,1)===false&&snap()===full,'31st addition rejected without data loss');
context.addPoint(poi,0);let moving=run('state.editUid');const beforeFullMove=snap();check(!context.moveStop(moving,1,0)&&snap()===beforeFullMove,'move into full day rejected without removing source');
check(!context.moveStop(moving,-1,0)&&!context.moveStop(moving,8,0),'invalid days rejected');check(!context.moveStop('missing',0,0),'unknown uid rejected');check(!context.moveStop(moving,0,NaN),'invalid index rejected');
run('undo=[];redo=[];');check(!context.moveStop(moving,0,0)&&run('undo.length')===0,'no-op move has no history');
context.adjustDuration(moving,10000);check(run('selectedItem().item.duration')===720,'upper stay limit');context.adjustDuration(moving,-10000);check(run('selectedItem().item.duration')===15,'lower stay limit');
// Exact duplicate places stay distinct by uid and can be independently removed.
run('state.day=1;');const duplicates=run('plan().items[1].map(v=>v.uid)');context.removeStop(duplicates[15]);check(run('plan().items[1].length')===29&&run(`findItem(${JSON.stringify(duplicates[16])})`)!=null,'duplicate deletion only removes the chosen instance');
context.historyStep();check(run('plan().items[1].length')===30,'undo restores duplicate');
// Manual values travel with their visit through reorder/move and restore.
select('seoul');const id=uid();context.editSelect(id);fragments.push({name:'editor',html:el('dialogBody').innerHTML});change('preferredStart','15:15');change('legMinutes','37');change('legMode','walk');change('duration','91');
check(run('selectedItem().item.start')===915&&run('selectedItem().item.travel')===37,'manual start/travel accepted');
change('editDay','2');check(run('selectedItem().day')===2&&run('selectedItem().item.duration')===91&&run('selectedItem().item.mode')==='walk','editor move preserves all fields');
click({action:'clear-start'});check(run('selectedItem().item.start')===null&&run('selectedItem().item.travel')===null,'automatic timing can be restored');
click({action:'undo'});check(run(`findItem(${JSON.stringify(id)}).item.travel`)===37,'undo restores explicit transfer time');
// Friday, zoom, global history, search escaping and overflow display.
run('plan().friday=true;state.day=-1;refresh();');check(el('planner').innerHTML.includes('선출발'),'Friday tab present');context.openPlacePicker();check(run('state.pickerDay')===0,'Friday add defaults to Saturday');
run('state.pickerQuery="<img src=x onerror=alert(1)>";');context.refreshPicker();check(!el('dialogBody').innerHTML.includes('<img src=x'),'picker escapes user input');el('dialog').close();
for(let i=0;i<9;i++)click({action:'time-in'});check(run('state.timeZoom')===3,'timeline upper zoom bound');for(let i=0;i<9;i++)click({action:'time-out'});check(run('state.timeZoom')===1,'timeline lower zoom bound');
check(context.timeBlock({kind:'visit',start:1445,end:1500,title:'late'})==='','after-midnight block does not overflow the 24h canvas');
const clipped=context.timeBlock({kind:'visit',start:1430,end:1500,title:'partial',uid:'p'});check(clipped.includes('width:0.694444'),'midnight overlap is clipped accurately');
select('geoje');const first=uid();context.adjustDuration(first,15);const changed=snap();doc.activeElement={tagName:'BODY'};check(key('z',{ctrlKey:true}),'undo shortcut handled');check(snap()!==changed,'shortcut undoes');key('Z',{metaKey:true,shiftKey:true});check(snap()===changed,'redo shortcut restores');doc.activeElement={tagName:'INPUT'};check(!key('z',{ctrlKey:true}),'text input retains native undo');doc.activeElement={tagName:'BODY'};
run('selectRegion("seoul",0,false);');context.historyStep();check(run('state.region')==='geoje','cross-region undo returns to affected region');
// Persisted and exported plan schema retains all edited items across normalize/reload.
const exported=JSON.parse(run('JSON.stringify(saved)'));for(const [k,p]of Object.entries(exported)){const r=DATA.find(r=>r.id===p.region),normalized=E.normalizePlan(r,p);check(normalized.items.flat().length===p.items.flat().length,'normalization preserves edited visit count');check(JSON.stringify(normalized.items.map(d=>d.map(x=>[x.poi,x.duration,x.start,x.travel,x.mode])))===JSON.stringify(p.items.map(d=>d.map(x=>[x.poi,x.duration,x.start,x.travel,x.mode]))),'normalization preserves edit fields');}

// Pointer reordering: pointer capture is isolated to the drag handle; body remains scrollable.
function dragFixture(vertical=false){
 const ids=run('plan().items[0].map(v=>v.uid)'),scroll={scrollLeft:0,scrollTop:0,getBoundingClientRect:()=>({left:0,right:900,top:0,bottom:900})},list={classList:classList(),closest:()=>scroll,querySelectorAll:()=>cards};
 if(vertical)list.classList.add('vertical');
 const cards=ids.map((id,i)=>({dataset:{sortItem:id},classList:classList(),removeAttribute(k){if(k==='data-drop')delete this.dataset.drop},getBoundingClientRect:()=>({left:i*300,top:i*200,width:280,height:180}),closest:selector=>selector==='[data-sort-item]'?cards[i]:list}));
 const handles=cards.map((card,i)=>{const captured=new Set();return{dataset:{dragStop:ids[i]},closest:s=>s==='[data-drag-stop]'?handles[i]:s==='[data-sort-item]'?card:list,setPointerCapture:id=>captured.add(id),releasePointerCapture:id=>captured.delete(id),hasPointerCapture:id=>captured.has(id)}});
 return{ids,cards,handles,list,scroll};
}
function pointer(handle,x,y,type='pointermove',id=11){return{target:handle,clientX:x,clientY:y,pointerId:id,type,button:0,isPrimary:true,preventDefault(){}}}
select('geoje');context.resetPlan();let fixture=dragFixture();let initial=snap();context.onSortDown(pointer(fixture.handles[0],10,10,'pointerdown'));context.onSortMove(pointer(fixture.handles[0],12,12));context.onSortEnd(pointer(fixture.handles[0],12,12,'pointerup'));check(snap()===initial,'tap/jitter on handle does not reorder');
fixture=dragFixture();context.onSortDown(pointer(fixture.handles[0],10,10,'pointerdown'));doc.elementFromPoint=()=>fixture.cards[2];context.onSortMove(pointer(fixture.handles[0],800,30));check(run('sortGesture.target')===2,'drop after card excludes removed source index');context.onSortEnd(pointer(fixture.handles[0],800,30,'pointerup'));check(run('plan().items[0][2].uid')===fixture.ids[0],'drag commits correct order');check(!fixture.handles[0].hasPointerCapture(11),'capture released after drop');check(run('suppressSortClick')>clock,'post-drag click suppressed');clock+=1000;
fixture=dragFixture(true);initial=snap();context.onSortDown(pointer(fixture.handles[2],10,410,'pointerdown'));doc.elementFromPoint=()=>fixture.cards[0];context.onSortMove(pointer(fixture.handles[2],10,5));context.onSortEnd(pointer(fixture.handles[2],10,5,'pointercancel'));check(snap()===initial,'cancel leaves original order');
fixture=dragFixture(true);context.onSortDown(pointer(fixture.handles[2],10,410,'pointerdown'));doc.elementFromPoint=()=>fixture.cards[0];context.onSortMove(pointer(fixture.handles[2],10,5));context.onSortEnd(pointer(fixture.handles[2],10,5,'pointerup'));check(run('plan().items[0][0].uid')===fixture.ids[2],'vertical drag moves later item first');clock+=1000;
fixture=dragFixture();context.onSortDown(pointer(fixture.handles[0],10,10,'pointerdown'));doc.elementFromPoint=()=>fixture.cards[1];context.onSortMove(pointer(fixture.handles[0],500,10));context.cancelSort();check(!run('sortGesture'),'lost capture/blur can cancel a drag safely');check(!fixture.handles[0].hasPointerCapture(11),'cancel releases capture');
const count=run('undo.length');context.onSortDown({...pointer(fixture.handles[0],10,10,'pointerdown'),isPrimary:false});check(!run('sortGesture')&&run('undo.length')===count,'secondary touch cannot begin a reorder');
clock+=1000;const grip=fixture.handles[0],oldIndex=run(`findItem(${JSON.stringify(fixture.ids[0])}).index`);for(const fn of listeners.keydown)fn({key:'ArrowDown',code:'ArrowDown',target:grip,preventDefault(){}});check(run(`findItem(${JSON.stringify(fixture.ids[0])}).index`)===oldIndex+1,'keyboard grip arrows reorder without drag');
fs.writeFileSync('/tmp/travel-edit-fragments.json',JSON.stringify(fragments));
console.log(`${checks} editing checks passed across all ${DATA.reduce((n,r)=>n+r.courses.length,0)} courses. Event/state tests only; no rendered browser verification.`);
