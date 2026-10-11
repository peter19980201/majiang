// Independent expected values: basic-point formula rounded per payer;
// three-player tsumo-loss, 200/honba, 2000 noten pool. Four-player legacy is unchanged.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Score = require('../../utils/score')
const Quick = require('../../utils/quick-score')
const Calc = require('../../utils/calculator')
const Tiles = require('../../utils/tiles')
const Round = require('../../utils/game-round')
const Rules = require('../../utils/game-rules')
const Records = require('../../utils/game-records')
const Storage = require('../../utils/game-storage')
const Migrations = require('../../utils/game-migrations')
const Reports = require('../../utils/battle-report')
const { settle } = require('../../utils/game-settlement')
const clone = Records.clone
const event = dataset => ({currentTarget:{dataset}})
let definition, storage = {}, toast = ''
global.Page = d => { definition = d }
// Flush the board's entry animation delay before interacting with its controls.
global.setTimeout = fn => { fn(); return 1 }
global.clearTimeout = () => {}
global.wx = {
 getStorageSync: k => storage[k] ? clone(storage[k]) : '', setStorageSync: (k,v) => {storage[k]=clone(v)},
 removeStorageSync: k => {delete storage[k]}, showToast: o => {toast=o.title},
 showModal: o => o.success({confirm:true}), navigateTo(){}, redirectTo(){}, navigateBack(){}, nextTick: f=>f(), showShareMenu(){}
}
function page(file) {
 const p = path.resolve(__dirname,'../..',file); delete require.cache[p]; require(p)
 const instance = {...definition,data:clone(definition.data),setData(v,done){Object.assign(this.data,v); if(done)done()}}
 Object.keys(definition).forEach(k=>{if(typeof definition[k]==='function')instance[k]=definition[k].bind(instance)})
 return instance
}
const config = {gameType:'free',playerCount:3,sanmaRuleVersion:1,startPoints:35000,returnPoints:40000,uma:'10-20',sanmaUma:15,players:['A','B','C']}
function board(){storage={};const p=page('pages/game/board.js');p.onLoad({config:encodeURIComponent(JSON.stringify(config))});return p}
function conserve(p){assert.equal(p.data.players.reduce((s,v)=>s+v.points,0)+p.data.riichiSticks*1000,105000)}
// Fixed payment cases, including rounded small hands and original kiriage policy.
for(const [base,oya,tsumo,honba,total,ko,op] of [
 [2000,false,true,0,6000,2000,4000],[2000,true,true,0,8000,4000,undefined],
 [640,false,true,2,2400,900,1500],[640,true,true,2,3000,1500,undefined],
 [2000,false,false,2,8400,undefined,undefined],[2000,true,false,2,12400,undefined,undefined]]){
 const p=Score.calculatePayment(base,oya,tsumo,honba,3);assert.equal(p.total,total)
 if(ko!==undefined)assert.equal(p.koPayment,ko);if(op!==undefined)assert.equal(p.oyaPayment,op)
}
assert.equal(Score.calculatePayment(640,false,true,0).total,2700)
assert.equal(Score.calculatePayment(2000,true,true,0).total,12000)
assert.equal(Quick.calculate({kind:'hanfu',han:4,fu:30,isOya:false,agariType:'ron',honba:0,playerCount:3}).payment.total,8000)
for(let d=0;d<3;d++)for(let w=0;w<3;w++)for(let mask=0;mask<8;mask++){
 const p=board();p.setData({dealerIdx:d,entryDealerIdx:d,selectedWinner:w,honba:2,inputKoPayment:d===w?'1300':'700',inputOyaPayment:'1300',roundRiichi:[0,1,2].map(i=>!!(mask&(1<<i)))})
 p._refreshTsumoEntry();assert.equal(p.data.tsumoBaseTotal,d===w?2600:2000)
 const expected=[35000,35000,35000].map((v,i)=>v-((mask&(1<<i))?1000:0)+(i===w?(d===w?3000:2400)+p.data.roundRiichi.filter(Boolean).length*1000:-(i===d||d===w?1500:900)))
 p.confirmTsumo();assert.deepEqual(p.data.players.map(p=>p.points),expected);conserve(p)
 assert.equal(p.data.roundHistory[0].honbaBonus,400)
 assert.equal(p.data.dealerIdx,d===w?d:(d+1)%3)
 p.undoLastRound();assert.deepEqual(p.data.players.map(p=>p.points),[35000,35000,35000]);assert.equal(p.data.honba,2)
}
for(let mask=0;mask<8;mask++){
 const tenpai=[0,1,2].map(i=>!!(mask&(1<<i))),n=tenpai.filter(Boolean).length
 const expected=n===0||n===3?[0,0,0]:tenpai.map(t=>t?(n===1?2000:1000):(n===1?-1000:-2000))
 assert.deepEqual(Round.drawTransfers(tenpai),expected)
 const p=board();p.startDraw();p.setData({drawTenpai:tenpai});p.confirmDraw();conserve(p)
 assert.deepEqual(p.data.players.map(p=>p.points),expected.map(v=>35000+v))
}
assert.deepEqual(Round.nagashiTransfers([true,false,false],0),[8000,-4000,-4000])
assert.deepEqual(Round.nagashiTransfers([false,true,false],0),[-4000,6000,-2000])
for(let d=0;d<3;d++)for(let mask=1;mask<8;mask++){
 const p=board();p.setData({dealerIdx:d,drawType:'nagashi',nagashiWinners:[0,1,2].map(i=>!!(mask&(1<<i))),drawTenpai:[false,false,false]});p.confirmDraw();conserve(p);assert.equal(p.data.roundHistory[0].nagashi,true)
 const record=p.data.roundHistory[0]
 for(const winner of record.achievers){
  const expected=winner.idx===d?8000:6000
  assert.equal(winner.payment,expected)
  assert.ok(record.desc.includes(`${winner.name} 流局满贯 ${expected}点`))
 }
}
const rotation=board()
for(let n=0;n<24;n++){
 assert.equal(rotation.data.roundNum,n%3+1);assert.equal(rotation.data.roundWind,Math.floor(n/3)%4);assert.equal(rotation.data.roundCycle,Math.floor(n/12)+1)
 rotation.advanceRound(false,false);assert.equal(rotation.data.gameOver,false)
}
const double=board();double.setData({selectedLoser:0,honba:2,roundRiichi:[false,true,true]})
double._setRonEntries([{idx:1,name:'B',points:'8000'},{idx:2,name:'C',points:'3900'}]);double.confirmRon()
assert.deepEqual(double.data.players.map(p=>p.points),[22300,44400,38300]);conserve(double)
assert.equal(double.data.roundHistory[0].riichiRecipient,'B')
const resumed=page('pages/game/board.js');resumed.onLoad({resume:'1'});assert.equal(resumed.data.playerCount,3)
resumed.editLastRound();resumed._setRonEntries([{idx:1,name:'B',points:'1000'},{idx:2,name:'C',points:'2000'}]);resumed.confirmRon()
assert.equal(resumed.data.roundHistory.length,1);conserve(resumed)
resumed.undoLastRound();assert.deepEqual(resumed.data.players.map(p=>p.points),[35000,35000,35000])
const invalid=board();invalid.setData({drawType:'abortive',abortReason:'四家立直'});const before=clone(invalid.data);invalid.confirmDraw();assert.deepEqual(invalid.data,before)
invalid.startDraw();invalid.selectDrawType(event({type:'abortive'}));assert.deepEqual(invalid.data.abortReasons,['九种九牌','四杠散了'])
invalid.setData({abortReason:'九种九牌'});invalid.confirmDraw();assert.equal(invalid.data.honba,1);conserve(invalid)
const hand={hand:[9,10,11,12,13,14,18,19,20,24,25,27,27],agariTile:26,context:{playerCount:3,nuki:2,agariType:'ron',bakaze:27,jikaze:28,riichi:true}}
let r=Calc.calculate(hand);assert.equal(r.han,3);assert.equal(r.fu,40);assert.equal(r.payment.total,5200);assert.equal(r.yaku.filter(y=>y.name==='拔北').length,1)
assert.equal(Calc.calculate({...hand,context:{...hand.context,riichi:false}}).error,'无成立役种')
r=Calc.calculate({...hand,context:{...hand.context,dora:[29]}});assert.equal(r.han,5)
assert.equal(Tiles.doraFromIndicator(0,3),8);assert.equal(Tiles.doraFromIndicator(8,3),0);assert.equal(Tiles.doraFromIndicator(0),1)
for(const change of [{hand:[1,...hand.hand.slice(1)]},{melds:[{type:'chi',tiles:[9,10,11]}]},{context:{...hand.context,nuki:5}},{context:{...hand.context,jikaze:30}},{context:{...hand.context,nuki:4,dora:[30]}}])assert(Calc.calculate({...hand,...change}).error)
// Embedded hand and quick forms inherit the live board's mode and only commit on confirmation.
function form(p,kind){const def=require('../../utils/embedded-entry')(require('../../pages/'+kind+'/definition'));const c={...def.methods,data:clone(def.data),properties:{config:p.data.inputOverlayConfig},setData(v){Object.assign(this.data,v)},triggerEvent(n,v){if(n==='result')p.receiveInputOverlayResult({detail:v});else p.closeInputOverlay()}};def.lifetimes.attached.call(c);return c}
const p=board();p.setData({honba:2});p.startRon();p.selectMultiRonWinner(event({idx:1}));p.selectRonLoser(event({idx:0}));p.goToMultiQuick(event({idx:1}))
const q=form(p,'quick-score');assert.equal(q.data.playerCount,3);q.setData({han:5,fu:0});q.confirm();assert.equal(p.data.ronEntries[0].points,'8000');p.confirmRon();assert.deepEqual(p.data.players.map(p=>p.points),[26600,43400,35000]);conserve(p)
p.undoLastRound();p.startRon();p.selectMultiRonWinner(event({idx:1}));p.selectRonLoser(event({idx:0}));p.goToMultiCalc(event({idx:1}))
const h=form(p,'calculator');h.setData({hand:hand.hand,agariTile:26,nuki:2,riichi:true});h.updateRemaining();assert.equal(h.data.tileRemaining[1],0);assert.equal(h.data.tileRemaining[30],2);h.doCalculate();assert(h.data.boardResult);h.confirmBoardResult();p.confirmRon();conserve(p)
p.editLastRound();p.goToMultiCalc(event({idx:1}));const restored=form(p,'calculator');assert.equal(restored.data.nuki,2);assert.equal(restored.data.playerCount,3);p.closeInputOverlay();p._cancelEntry()
p.earlySettlement();const record=Storage.history()[0];assert.equal(record.result.length,3);assert.equal(Reports.build(record).title,'三麻对局战报');assert.equal(record.config.playerCount,3)
assert.deepEqual(settle(config,[{name:'A',points:45000},{name:'B',points:35000},{name:'C',points:25000}]).map(p=>p.finalPt),[20,-5,-30])
assert.throws(()=>Migrations.state({config:{playerCount:3},players:[]}))
// Tsumo goes through the same embedded result -> confirm -> correction contract.
for (const winner of [0, 1]) {
 const game=board();game.setData({honba:2});game.startTsumo();game.selectTsumoWinner(event({idx:winner}));game.goToTsumoCardQuick()
 const input=form(game,'quick-score');input.setData({han:5,fu:0});input.confirm()
 assert.equal(game.data.tsumoBaseTotal,winner===0?8000:6000)
 game.confirmTsumo();assert.deepEqual(game.data.players.map(p=>p.points),winner===0?[43400,30800,30800]:[30800,41400,32800]);conserve(game)
 game.editLastRound();game.goToTsumoCardQuick();const edit=form(game,'quick-score');assert.equal(edit.data.han,5);edit.setData({han:6});edit.confirm();game.confirmTsumo();assert.equal(game.data.roundHistory.length,1);conserve(game)
 game.undoLastRound();assert.deepEqual(game.data.players.map(p=>p.points),[35000,35000,35000])
}
const maxWinners=board();maxWinners.startRon();[0,1,2].forEach(idx=>maxWinners.selectMultiRonWinner(event({idx})));assert.equal(maxWinners.data.ronEntries.length,2)
const resultPage=page('pages/result/result.js');resultPage.onLoad({data:encodeURIComponent(JSON.stringify({input:{playerCount:3},payment:{type:'tsumo_oya',koPayment:4000,total:8000}}))});assert.equal(resultPage.data.paymentRows[0].label,'两家各付')
const table=page('pages/quick-score/quick-score.js');table.onLoad({playerCount:3,tab:'table'});table.setData({tableType:'tsumo',tableOya:true});table.refreshTable();assert.equal(table.data.limits[0].payment,'子家各付 4000点')
// Standalone selectors and nuki physical limits.
const standalone=page('pages/calculator/calculator.js');standalone.onLoad({});standalone.setPlayerCount(event({count:3}));assert.equal(standalone.data.tileRemaining[4],0);standalone.startMeldInput(event({type:'chi'}));assert.equal(standalone.data.editingMeldType,'')
for(let i=0;i<5;i++)standalone.changeNuki(event({delta:1}));assert.equal(standalone.data.nuki,4);assert.equal(standalone.data.tileRemaining[30],0)
standalone.setPlayerCount(event({count:4}));assert.equal(standalone.data.nuki,0);assert.equal(standalone.data.tileRemaining[4],4)
const setup=page('pages/game/setup.js');setup.onLoad({playerCount:'3'});assert.equal(setup.data.players.length,3);assert.equal(setup.data.startPoints,35000);setup.onLoad({playerCount:'4'});assert.equal(setup.data.players.length,4);assert.equal(setup.data.startPoints,25000)
assert.equal(Reports.build({config:{playerCount:3,gameType:'free'}}).type,'三麻 · 自由记分')
assert.equal(Reports.build({config:{gameType:'free'}}).type,'自由记分')
// Three-player boards retain the four cardinal positions, leaving north vacant.
const boardTemplate=fs.readFileSync(path.join(__dirname,'../../pages/game/board.wxml'),'utf8')
const boardStyles=fs.readFileSync(path.join(__dirname,'../../pages/game/board.wxss'),'utf8')
assert.match(boardTemplate,/rotate\(\{\{roundFeedbackAngle !== null \? roundFeedbackAngle : players\[dealerIdx\]\.seatWind \* 90\}\}deg\)/)
for(const [direction,label] of [['east','东'],['south','南'],['west','西'],['north','北']]) {
 assert.ok(boardTemplate.includes(`<text class="compass-${direction}">${label}</text>`))
}
assert.doesNotMatch(boardStyles,/\.mode-3\s+\.(?:seat-\d|compass-)/)
assert.deepEqual(board().data.players.map(player=>player.seatWind),[0,1,2])
console.log('Sanma: fixed payments, all seats/riichi masks, draws, rotations, multi-ron, embedded hand/quick, nuki, undo/edit/resume, settlement and cardinal-seat UI passed.')
