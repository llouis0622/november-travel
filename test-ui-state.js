// Pure JavaScript state regression tests; this does not emulate browser rendering.
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync('ui.js','utf8'),DATA=require('./data.json'),E=require('./engine.js');
const elements={travelData:{textContent:JSON.stringify(DATA)},embeddedPlans:{textContent:'{}'},main:{classList:{remove(){}},scrollTop:0},playCaption:{hidden:true}};
const context={TripEngine:E,document:{getElementById:id=>elements[id]},matchMedia:()=>({matches:false}),localStorage:{getItem:()=>null,setItem(){}},Map,Set,location:{hash:''},performance:{now:()=>0}};
vm.createContext(context);
vm.runInContext(source.slice(0,source.indexOf('/* Geographic overview')),context);
vm.runInContext('for(const name of ["renderHeader","renderRegions","renderCourseBar","renderCandidatePanel","renderPlanner","renderPins","renderRoutes","fitSelected","closeRegions","cancelSort","stopPlayback","startArrival","updatePlaybackControls"])this[name]=()=>{};',context);
let checks=0;
function check(code,message){assert(vm.runInContext(code,context),message);checks++;}
for(const value of [null,[],3,'bad',{'seoul:0':null},{'seoul:0':{region:'seoul',baseCourse:0,items:null}},{'bad-key':E.createPlan(DATA.find(r=>r.id==='seoul'))}]){
 vm.runInContext('saved='+JSON.stringify(value)+';restoreSaved();',context);
 check('Object.keys(saved).length===0','invalid stored plans are discarded without crashing');
}
vm.runInContext('saved={"seoul:0":E.createPlan(DATA.find(r=>r.id==="seoul"),0)};restoreSaved();',context);
check('saved["seoul:0"].items.length===3','valid storage survives normalization');
vm.runInContext('selectRegion("seoul",1.5)',context);
check('state.course===1&&location.hash==="seoul/1"','fractional fragment selects a valid course');
vm.runInContext('selectRegion("seoul","nonsense")',context);
check('state.course===0','invalid fragment uses first course');
vm.runInContext('plan().friday=true;state.day=-1;changeCourse(1)',context);
check('state.day===0&&!plan().friday','switching away from a Friday plan selects Saturday');
vm.runInContext('plan().friday=true;state.day=-1;refresh()',context);
check('state.day===-1','Friday remains selected when supported');
vm.runInContext('plan().friday=false;refresh()',context);
check('state.day===0','resetting Friday keeps map and timeline on a valid day');
check('courseIndex(region(),999)===region().courses.length-1','out-of-range course is bounded');
check('E.normalizePlan(region(),{...plan(),baseCourse:1.5}).baseCourse===1','import normalization uses integer course');
console.log(checks+' UI state checks passed; no browser or physical device rendering was tested.');
