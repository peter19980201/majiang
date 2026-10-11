const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const read = f => fs.readFileSync(path.join(__dirname,'../..',f),'utf8')
const clone = x => JSON.parse(JSON.stringify(x))
const event = dataset => ({currentTarget:{dataset}})
const {geometry} = require('../../utils/tile-motion')
const source={left:300,top:600,width:42,height:54}
const target={left:20,top:80,width:21,height:27}
const root={left:12,top:-100}
assert.deepEqual(geometry(source,target,root),{left:288,top:700,width:42,height:54,dx:-280,dy:-520,sx:.5,sy:.5})
assert.equal(geometry(source,null,root),null)
assert.equal(geometry({...source,width:0},target,root),null)
let timers=new Map(),timerId=0,queries=[],scopes=[],dataWrites=0
const originalTimeout=global.setTimeout,originalClear=global.clearTimeout
global.setTimeout=(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id}
global.clearTimeout=id=>timers.delete(id)
function tick(ms){const t=[...timers].find(([,v])=>v.ms===ms);assert.ok(t,`timer ${ms}`);timers.delete(t[0]);t[1].fn()}
global.wx={showToast(){},createSelectorQuery(){
 const selectors=[];let allCallback
 const q={in(scope){scopes.push(scope);return q},select(sel){selectors.push(sel);return q},selectAll(sel){selectors.push(sel);return q},boundingClientRect(callback){allCallback=callback || allCallback;return q},exec(done){queries.push({selectors,done:done || (values=>allCallback(values))})}}
 return q
}}
const definition=require('../../pages/calculator/definition')
function calculator(){timers.clear();queries=[];return {...definition,data:clone(definition.data),setData(patch,done){dataWrites++;Object.assign(this.data,patch);if(done)done()}}}
for(const count of [3,4]){
 const p=calculator();p.initializeInput({playerCount:count})
 p.selectTile(event({id:9}));p.selectTile(event({id:10}))
 assert.deepEqual(p.data.hand,[9,10]);assert.equal(queries.length,2)
 assert.deepEqual(p.data.hiddenHandSlots,[true,true],'destinations hidden before measurement returns')
 assert.deepEqual(queries[0].selectors,['#pick-9-plain','#hand-flight-0','.calculator'])
 assert.deepEqual(queries[1].selectors,['#pick-10-plain','#hand-flight-1','.calculator'])
 assert.equal(scopes.at(-1),p)
 // Replies may arrive out of order; each flight still lands at its reserved slot.
 queries[1].done([source,{...target,left:45},root]);queries[0].done([source,target,root])
 assert.deepEqual(p.data.hiddenHandSlots,[true,true]);assert.equal(p.data.tileFlights.length,2)
 const writes=dataWrites;tick(20);tick(20);assert.equal(dataWrites-writes,2,'no per-frame JS loop')
 assert.ok(p.data.tileFlights.every(f=>f.arrived));assert.deepEqual(p.data.hand,[9,10])
 tick(260);tick(260);assert.equal(p.data.tileFlights.length,0);assert.deepEqual(p.data.hiddenHandSlots,[false,false])
 p.switchTarget(event({target:'agari'}));p.selectTile(event({id:13,red:true}))
 assert.deepEqual(queries.at(-1).selectors,['#pick-13-red','#agari-flight-target','.calculator'])
 assert.equal(p.data.hiddenAgari,true,'agari hidden on its first rendered frame')
 queries.at(-1).done([source,target,root]);assert.equal(p.data.tileFlights[0].red,true)
 assert.equal(p.data.agariTile,13);assert.equal(p.data.agariRed,true);assert.equal(p.data.hiddenAgari,true)
 p.onHide();assert.equal(p.data.hiddenAgari,false);assert.equal(timers.size,0)
}
// Full/illegal choices do not create a flight, and missing geometry never hides data.
const p=calculator();p.initializeInput({playerCount:3});p.selectTile(event({id:1}));assert.equal(queries.length,0)
p.selectTile(event({id:9}));queries[0].done([null,target,root]);assert.equal(p.data.tileFlights.length,0);assert.deepEqual(p.data.hand,[9])
p.selectTile(event({id:10}));const stale=queries.at(-1);p.clearHand();stale.done([source,target,root]);assert.deepEqual(p.data.tileFlights,[])
p.selectTile(event({id:13,red:true}));queries.at(-1).done([source,target,root]);const n=queries.length
p.selectTile(event({id:13,red:true}));assert.equal(queries.length,n);p.onPageScroll();assert.equal(timers.size,0)
p.selectTile(event({id:11}));const afterSwitch=queries.at(-1);p.setPlayerCount(event({count:4}));afterSwitch.done([source,target,root]);assert.deepEqual(p.data.hand,[]);assert.equal(p.data.tileFlights.length,0)
p.selectTile(event({id:9}));queries.at(-1).done([source,target,root]);const oldTimer=[...timers.values()][0].fn
p.onUnload();p.setData=()=>{throw Error('setData after unload')};oldTimer();assert.equal(timers.size,0)
// Even an already-queued setData callback must not start measuring after unload.
const delayed=calculator();let renderDone
delayed.setData=function(v,done){Object.assign(this.data,v);if(done)renderDone=done}
delayed.selectTile(event({id:9}));delayed.onUnload();const queriesBefore=queries.length
renderDone();assert.equal(queries.length,queriesBefore)
const remove=calculator();remove.setData({hand:[9,10,11],handRed:[false,true,false]});remove.updateRemaining()
remove.removeHandTile(event({index:0}));queries.at(-1).done([{left:20,top:80},{left:45,top:80},{left:70,top:80}])
assert.deepEqual(remove.data.hand,[10,11]);assert.deepEqual(remove.data.handRed,[true,false]);assert.deepEqual(remove.data.handShift,[{x:25,y:0},{x:25,y:0}])
tick(20);assert.deepEqual(remove.data.handShift,[{x:0,y:0},{x:0,y:0}]);remove.onUnload()
// Embedded detach invokes the same cleanup; navigation remains host-owned.
const embedded=require('../../utils/embedded-entry')(definition)
const c={...embedded.methods,data:clone(embedded.data),setData(patch,done){Object.assign(this.data,patch);if(done)done()}}
c.initializeInput({playerCount:4});c.selectTile(event({id:9}));queries.at(-1).done([source,target,root]);embedded.lifetimes.detached.call(c);assert.equal(timers.size,0)
// Every render containing a newly entered tile already carries the hidden flag.
const atomic=calculator(),frames=[]
atomic.setData=function(v,done){Object.assign(this.data,v);frames.push(clone(this.data));if(done)done()}
atomic.selectTile(event({id:9}))
assert.ok(frames.filter(f=>f.hand.length).every(f=>f.hiddenHandSlots[0]))
atomic.selectTile(event({id:10}))
queries[0].done([source,target,root]);tick(20);tick(260)
assert.deepEqual(atomic.data.hiddenHandSlots,[false,true],'one landing cannot reveal another pending measurement')
queries[1].done([source,target,root]);tick(20);tick(260)
assert.deepEqual(atomic.data.hiddenHandSlots,[false,false]);assert.equal(timers.size,0)
// Bad/missing geometry or API errors fall back to the already-committed tile.
const missing=calculator();missing.selectTile(event({id:9}));queries[0].done([null,target,root]);assert.deepEqual(missing.data.hiddenHandSlots,[false]);assert.equal(timers.size,0)
missing.selectTile(event({id:10}));const lateQuery=queries.at(-1);tick(600)
assert.deepEqual(missing.data.hiddenHandSlots,[false,false]);lateQuery.done([source,target,root]);assert.deepEqual(missing.data.tileFlights,[])
const queryFactory=wx.createSelectorQuery
wx.createSelectorQuery=()=>{throw Error('measurement unavailable')}
missing.selectTile(event({id:11}));assert.deepEqual(missing.data.hiddenHandSlots,[false,false,false]);assert.equal(timers.size,0)
wx.createSelectorQuery=queryFactory
missing.selectTile(event({id:12}));const pendingScroll=queries.at(-1);missing.cancelTileMotionOnTouch();pendingScroll.done([source,target,root]);assert.deepEqual(missing.data.hiddenHandSlots,[]);assert.equal(missing.data.tileFlights.length,0)
missing.onUnload()
// Existing UI actions remain immediate while their persistent shells animate.
let pageDef
Page=d=>{pageDef=d}
function page(file){delete require.cache[require.resolve('../../'+file)];require('../../'+file);return {...pageDef,data:clone(pageDef.data),setData(v,cb){Object.assign(this.data,v);if(cb)cb()}}}
const reference=page('pages/reference/reference');reference.onLoad();reference.onExpandTap(event({idx:0}));assert.equal(reference.data.expandedIndex,0);assert.equal(reference.data.expandedYaku[reference.data.filteredYaku[0]._index],true);reference.onExpandTap(event({idx:0}));assert.equal(reference.data.expandedIndex,-1)
const result=page('pages/result/result');result.toggleFuDetail();assert.equal(result.data.showFuDetail,true);result.toggleFuDetail();assert.equal(result.data.showFuDetail,false)
const store=require('../../utils/game-storage'),oldHistory=store.history
store.history=()=>[{id:'motion',config:{playerCount:3,gameType:'free'},result:[],rounds:[]}]
const settlement=page('pages/settlement/settlement');wx.showShareMenu=()=>{}
settlement.onLoad({id:'motion',source:'board'});settlement.onShow();assert.equal(settlement.data.celebrate,true);settlement.onShow();assert.equal(settlement.data.celebrate,false)
const history=page('pages/settlement/settlement');history.onLoad({id:'motion'});history.onShow();assert.equal(history.data.celebrate,false);store.history=oldHistory
const report=page('pages/battle-report/battle-report');report.onPosterLoad();assert.equal(report.data.posterReady,true);report.onPosterError();assert.equal(report.data.posterReady,false);assert.match(report.data.error,/加载失败/)
const css=read('styles/motion.wxss'), calc=read('pages/calculator/calculator.wxml')
assert.match(css,/grid-template-rows:0fr/);assert.match(css,/grid-template-rows:1fr/)
assert.match(css,/prefers-reduced-motion/)
assert.ok(calc.includes('id="hand-flight-{{index}}"'));assert.ok(calc.includes('id="pick-{{4}}-red"'));assert.ok(calc.includes('id="agari-flight-target"'))
assert.ok(calc.includes('motion-sheet-mask'));assert.ok(!calc.includes('wx:if="{{showMeldModal}}"'))
assert.match(read('pages/calculator/calculator.wxss'),/\.tile-flight\s*\{[^}]*pointer-events:none/)
for(const f of ['pages/game/setup.wxml','pages/calculator/calculator.wxml','pages/quick-score/quick-score.wxml','pages/reference/reference.wxml','components/points-table/table.wxml'])assert.ok(read(f).includes('motion-selection'),f)
assert.ok(read('custom-tab-bar/index.wxml').includes("newGameVisible ? 'motion-open'"))
global.setTimeout=originalTimeout;global.clearTimeout=originalClear
console.log('UI motion: measured geometry, rapid input, red fives, invalid input, cancellation, embedded cleanup, details, settlement and poster readiness passed.')
