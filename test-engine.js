const assert=require('node:assert/strict'),E=require('./engine.js'),DATA=require('./data.json');
let assertions=0;function check(v,msg){assert(v,msg);assertions++;}
for(const r of DATA)for(let i=0;i<r.courses.length;i++){
 const p=E.createPlan(r,i),s=E.schedule(r,p);
 check(s.returnMinute<=960,r.id+' default arrives by 16:00');
 check(!s.unconfirmedService,r.id+' matches an actual reference service');
 check(s.days.every(d=>d.blocks.every((b,k)=>Number.isFinite(b.start)&&b.end>=b.start&&(k===0||b.start>=d.blocks[k-1].end))),r.id+' chronological non-overlapping blocks');
 check(!s.warnings.some(w=>w.includes('정기 휴무')),r.id+' avoids known closure');
 check(r.carAllowed||!s.edges.some(e=>e.mode==='car'),r.id+' no intercity car outside allowed regions');
 check(E.normalizePlan(r,JSON.parse(JSON.stringify(p))).items.flat().length===p.items.flat().length,'plan roundtrip');
}
const r=structuredClone(DATA.find(r=>r.id==='daejeon')),a=r.points[1],b=r.points[2],c=r.points[3];
r.routes={};for(const [from,to,seconds] of [[a,b,600],[b,a,1200],[a,c,1800]])r.routes[from.id+'>'+to.id+':road']={status:'ok',seconds,meters:5000,fromCoord:from.coord,toCoord:to.coord};
check(E.travel(r,a,b).minutes!==E.travel(r,b,a).minutes,'reverse routes are not symmetric');
check(E.travel(r,a,b).minutes!==E.travel(r,a,c).minutes,'candidate changes select a different route');
check(E.travel(r,a,b,'taxi',77).minutes===77,'manual override takes precedence');
check(E.travel(r,a,b,'transit').estimate,'taxi result is never mislabelled transit');
const changed=structuredClone(b);changed.coord=[130,36];check(E.travel(r,a,changed).estimate,'stale coordinate cache rejected');
const p=E.createPlan(r),before=E.schedule(r,p),first=p.items[1][0];first.duration+=30;const after=E.schedule(r,p);
check(after.days.find(d=>d.day===1).blocks.find(b=>b.uid===first.uid).end-before.days.find(d=>d.day===1).blocks.find(b=>b.uid===first.uid).end===30,'duration change is reflected exactly');
p.starts[2]=840;const late=E.schedule(r,p);check(late.unconfirmedService,'missed train is flagged');check(late.returnMinute>960,'missed train never teleports to earlier arrival');
assert.throws(()=>E.normalizePlan(r,null));assertions++;
console.log(assertions+' planning assertions passed across 46 courses.');
