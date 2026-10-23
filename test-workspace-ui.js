// Structural/state checks for the responsive workspace. This is not browser layout testing.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const DATA=require('./data.json'),E=require('./engine.js'),source=fs.readFileSync('ui.js','utf8');
const elements=new Map();let checks=0;
function element(id){if(!elements.has(id))elements.set(id,{id,innerHTML:'',textContent:'',dataset:{},style:{},scrollTop:0,scrollLeft:0,open:false,hidden:false,attrs:{},classList:{add(){},remove(){}},setAttribute(k,v){this.attrs[k]=v;},showModal(){this.open=true;},close(){this.open=false;},focus(){},closest(){return{scrollIntoView(){}};}});return elements.get(id);}
element('travelData').textContent=JSON.stringify(DATA);element('embeddedPlans').textContent='{}';
const context={TripEngine:E,document:{getElementById:element,activeElement:null},localStorage:{getItem:()=>null,setItem(){}},matchMedia:()=>({matches:false}),performance:{now:()=>1000},location:{hash:''},setTimeout:()=>1,clearTimeout(){},Map,Set};
vm.createContext(context);vm.runInContext(source.slice(0,source.indexOf("$('viewport').addEventListener('pointerdown'")),context);
vm.runInContext(source.slice(source.indexOf('function handleAction('),source.indexOf("document.addEventListener('pointerdown',onSortDown)")),context);
vm.runInContext('for(const name of ["renderRegions","renderPins","renderRoutes","updatePins","closeRegions"])this[name]=()=>{};',context);
const run=c=>vm.runInContext(c,context),check=(value,message)=>{assert(value,message);checks++;};
for(const d of DATA)for(let c=0;c<d.courses.length;c++){
 run(`selectRegion(${JSON.stringify(d.id)},${c},false)`);
 check(!element('courseBar').innerHTML.includes('course-description')&&!element('courseBar').innerHTML.includes('<details'),'course descriptions do not consume persistent map height');
 check((element('courseBar').innerHTML.match(/data-course=/g)||[]).length===d.courses.length,'all recommended courses remain selectable');
 context.courseInfo();check(element('dialogBody').innerHTML.includes(run('esc(region().courses[state.course].desc)')),'description remains accessible in course information');element('dialog').close();
 for(const p of d.points.filter(p=>p.type!=='transit')){
  const card=context.card(p);check(card.includes(run('esc') (p.name))&&card.includes(run('esc') (p.desc)),'candidate cards retain full title and explanation');
  check(card.includes('candidate-meta')&&card.includes('data-add=')&&card.includes('data-detail='),'candidate cards expose useful facts, add and booking controls');
 }
 for(const day of [0,1,2]){
  run(`state.day=${day};renderPlanner();`);
  check(element('planner').innerHTML.includes('day-buttons')&&element('planner').innerHTML.includes('time-canvas'),'date tabs and 24h timeline are present');
  check(!element('planner').innerHTML.includes('id="duration"')&&!element('planner').innerHTML.includes('editor-empty'),'editing form does not consume permanent workspace height');
  context.dayList();check(element('dialogBody').innerHTML.includes('day-stop-list'),'full visit names can be opened from the compact schedule');element('dialog').close();
 }
}
run('selectRegion("geoje",0,false);state.day=0;');
const uid=run('plan().items[0][0].uid');context.editSelect(uid);
check(element('dialog').open&&element('dialog').dataset.kind==='stop-editor','a timeline item opens the editor');
check(element('dialogBody').innerHTML.includes('id="duration"')&&element('dialogBody').innerHTML.includes('id="editDay"'),'editor exposes duration and date controls');
const oldEnd=run('result.days[0].blocks.find(b=>b.uid===state.editUid).end');
run('mutate(()=>selectedItem().item.duration+=15)');
check(run('result.days[0].blocks.find(b=>b.uid===state.editUid).end')===oldEnd+15,'duration edit recalculates schedule');
check(element('dialog').open&&element('dialogBody').innerHTML.includes('value="145"'),'open editor refreshes after a change');
run('mutate(p=>{const v=selectedItem();p.items[v.day].splice(v.index,1);p.items[1].push(v.item);state.day=1;});');
check(run('selectedItem().day')===1&&element('dialog').open,'moving to another day keeps the editor and timeline in sync');
context.handleAction('remove');check(!element('dialog').open,'removing the edited item closes its form');
run('state.day=0;editSelect(plan().items[0][0].uid);changeCourse(1);');check(!element('dialog').open,'course switching closes a stale editor');
context.handleAction('expand-planner');check(element('planner').className.includes('expanded')&&element('planner').innerHTML.includes('planner-extra'),'large schedule exposes the visit list');
context.handleAction('expand-planner');check(!element('planner').className.includes('expanded'),'schedule collapses back to its compact size');
context.togglePlay();context.setPane('places');check(run('!state.playing')&&element('main').dataset.pane==='places','opening candidates pauses hidden-map playback');
run('state.plannerExpanded=true;renderPlanner();togglePlay();');check(element('main').dataset.pane==='map'&&!run('state.plannerExpanded'),'starting playback reveals the map and collapses the expanded schedule');
context.stopPlayback();context.scheduleInfo();check(element('dialogBody').innerHTML.includes('schedule-summary'),'return time, cost, and warnings remain accessible');
console.log(`${checks} workspace UI structure and editing checks passed. Browser layout and physical devices were not tested.`);
