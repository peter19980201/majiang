require('../harness/confirmation-mock')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const clone = value => JSON.parse(JSON.stringify(value))
let definition, storage, timers = new Map(), nextId = 0, failSave = false
Page = value => { definition = value }
global.setTimeout = (fn, ms) => { const id = ++nextId; timers.set(id,{fn,ms}); return id }
global.clearTimeout = id => timers.delete(id)
global.wx = {
 getStorageSync:k=>storage[k] ? clone(storage[k]) : '',
 setStorageSync(k,v){ if(failSave) throw Error('disk full'); storage[k]=clone(v) },
 removeStorageSync:k=>delete storage[k], showToast(){}, showShareMenu(){}, navigateTo(){},
 showModal:options=>options.success({confirm:true})
}
require('../../pages/game/board')
function board(count=4){
 storage={};timers.clear();failSave=false
 const p={...definition,data:clone(definition.data),setData(v,done){Object.assign(this.data,v);if(done)done()}}
 p.onLoad({config:encodeURIComponent(JSON.stringify({gameType:'free',playerCount:count,startPoints:25000,returnPoints:30000,uma:'10-20',sanmaUma:15,players:['A','B','C','D'].slice(0,count)}))})
 return p
}
function tick(ms){ const entry=[...timers].find(([,t])=>t.ms===ms);assert.ok(entry,`timer ${ms}`);timers.delete(entry[0]);entry[1].fn() }
function ron(p,winner=1){p.setData({selectedWinner:winner,selectedLoser:0,inputPoints:'8000'});p.confirmRon()}
for(const count of [3,4]){
 const p=board(count);p.setData({roundRiichi:[false,true,...Array(count-2).fill(false)]});ron(p)
 assert.deepEqual(p.data.players.map(v=>v.points),[17000,33000,...Array(count-2).fill(25000)])
 const effect=p.data.roundFeedback[0]
 assert.deepEqual(effect.deltas,[-8000,8000,...Array(count-2).fill(0)])
 assert.deepEqual(effect.winners,[false,true,...Array(count-2).fill(false)])
 assert.equal(effect.roundChanged,true);assert.equal(p.data.roundFeedbackRunning,false)
 const saved=JSON.stringify(storage);assert.ok(!saved.includes('roundFeedback'))
 tick(230);assert.equal(p.data.roundFeedbackRunning,true);assert.equal(p.data.roundFeedbackAngle,0)
 assert.equal(p.data.roundFeedbackTransition,false)
 tick(1600);assert.equal(p.data.roundFeedbackRunning,false);assert.equal(p.data.roundFeedbackTransition,true)
 assert.equal(p.data.roundFeedbackAngle,90);assert.equal(JSON.stringify(storage),saved)
 tick(800);assert.deepEqual(p.data.roundFeedback,[]);assert.equal(JSON.stringify(storage),saved)
 // Resume never replays; another input can be opened during the feedback.
 p.onLoad({resume:'1'});assert.deepEqual(p.data.roundFeedback,[])
 ron(p,2);tick(230);p.startDraw();assert.deepEqual(p.data.roundFeedback,[]);assert.equal(p.data.roundFeedbackRunning,false)
 p.onUnload()
 const tsumo=board(count);tsumo.setData({selectedWinner:0,inputKoPayment:'4000'});tsumo.confirmTsumo()
 assert.deepEqual(tsumo.data.roundFeedback[0].deltas,[4000*(count-1),...Array(count-1).fill(-4000)])
 assert.equal(tsumo.data.roundFeedback[0].winners[0],true)
 assert.equal(tsumo.data.roundFeedback[0].roundChanged,true) // dealer repeat updates honba
 tsumo.onHide();assert.equal(timers.size,0)
 const draw=board(count);draw.setData({drawTenpai:[true,...Array(count-1).fill(false)]});draw.confirmDraw()
 assert.deepEqual(draw.data.roundFeedback[0].deltas,[count===3?2000:3000,...Array(count-1).fill(-1000)])
 assert.ok(draw.data.roundFeedback[0].winners.every(v=>!v));draw.onUnload()
 const abort=board(count);abort.setData({drawType:'abortive',abortReason:'九种九牌'});abort.confirmDraw()
 assert.ok(abort.data.roundFeedback[0].deltas.every(v=>v===0));abort.onUnload()
 const multi=board(count);multi.setData({selectedLoser:0,multiRonMode:true});multi._setRonEntries([{idx:1,name:'B',points:'8000'},{idx:2,name:'C',points:'3900'}]);multi.confirmRon()
 assert.deepEqual(multi.data.roundFeedback[0].winners,[false,true,true,...Array(count-3).fill(false)]);multi.onUnload()
 const nagashi=board(count);nagashi.setData({drawType:'nagashi',nagashiWinners:[false,true,...Array(count-2).fill(false)]});nagashi.confirmDraw()
 assert.equal(nagashi.data.roundFeedback[0].winners[1],true);nagashi.onUnload()
}
const p=board();ron(p);const stale=[...timers.values()][0].fn
p.onHide();const hidden=structuredClone(p.data);stale();assert.deepEqual(p.data,hidden);assert.equal(timers.size,0)
ron(p);tick(230);const staleEnd=[...timers.values()][0].fn
ron(p,2);const fresh=clone(p.data.roundFeedback);staleEnd();assert.deepEqual(p.data.roundFeedback,fresh)
p.editLastRound();p.confirmRon();assert.deepEqual(p.data.roundFeedback,[])
ron(p);p.undoLastRound();assert.deepEqual(p.data.roundFeedback,[]);assert.equal(timers.size,0)
ron(p);p.doSettlement();assert.deepEqual(p.data.roundFeedback,[]);assert.equal(timers.size,0)
// Cancelling during the second phase must also invalidate its pending cleanup.
const transitioning=board();ron(transitioning);tick(230);tick(1600)
const obsoleteTransitionEnd=[...timers.values()][0].fn
transitioning.onHide();assert.equal(transitioning.data.roundFeedbackTransition,false);assert.equal(timers.size,0)
ron(transitioning);const restarted=structuredClone(transitioning.data)
obsoleteTransitionEnd();assert.deepEqual(transitioning.data,restarted);transitioning.onUnload()
const invalid=board();invalid.confirmRon();assert.deepEqual(invalid.data.roundFeedback,[]);assert.equal(timers.size,0)
const failed=board();failSave=true;assert.throws(()=>ron(failed),/disk full/);assert.deepEqual(failed.data.roundFeedback,[]);assert.equal(timers.size,0)
const unloaded=board();ron(unloaded);const callback=[...timers.values()][0].fn;unloaded.onUnload();unloaded.setData=()=>{throw Error('write after unload')};callback();assert.equal(timers.size,0)
const {feedback,rollingPoints,flights}=require('../../utils/round-feedback')
const record={before:{players:[0,1,2,3].map(seatWind=>({seatWind,points:25000})),dealerIdx:3},after:{players:[0,1,2,3].map(seatWind=>({seatWind,points:25000})),dealerIdx:0},type:'draw'}
assert.equal(feedback(record,1).toAngle,360) // north -> east takes one quarter turn
const css=fs.readFileSync(path.join(__dirname,'../../pages/game/board.wxss'),'utf8')
assert.match(css,/@media \(prefers-reduced-motion:reduce\)[\s\S]*round-score-delta/)
assert.match(css,/\.round-score-delta\s*\{[^}]*pointer-events:none/)
console.log('Round feedback: three/four seats, payments, winners, draws, correction, cancellation, persistence, errors and lifecycle passed.')

assert.match(css,/\.round-feedback-running \.round-score-delta\s*\{[^}]*round-score-float 1600ms/)
assert.match(css,/\.round-feedback-running \.round-winner-glow\s*\{[^}]*round-soft-glow 1600ms/)
assert.match(css,/\.round-feedback-transition \.round-feedback-glow\s*\{[^}]*round-soft-glow 800ms/)
const template=fs.readFileSync(path.join(__dirname,'../../pages/game/board.wxml'),'utf8')
assert.ok(template.includes("roundFeedbackTransition ? 'round-feedback-transition'"))

// Fixed endpoints/midpoint plus monotonicity, including crossing zero and large totals.
assert.deepEqual(rollingPoints(25000,33000).filter((_,i)=>[0,8,16].includes(i)).map(f=>f.points),[25000,31000,33000])
for(const [from,to] of [[25000,17000],[1000,-7000],[-8000,4000],[128000,152000],[25000,25000]]){
 const frames=rollingPoints(from,to)
 assert.equal(frames.length,17);assert.equal(frames[0].points,from);assert.equal(frames[16].points,to)
 assert.equal(new Set(frames.map(f=>f.id)).size,17)
 for(let i=1;i<frames.length;i++)assert.ok(to>=from ? frames[i].points>=frames[i-1].points : frames[i].points<=frames[i-1].points)
}
const seats=[0,1,2,3].map(seatWind=>({seatWind}))
const routes=(deltas)=>flights(deltas,seats.slice(0,deltas.length)).map(f=>[f.from,f.to,f.amount])
assert.deepEqual(routes([-8000,8000,0]),[[0,1,8000]])
assert.deepEqual(routes([-4000,8000,-2000,-2000]),[[0,1,4000],[2,1,2000],[3,1,2000]])
assert.deepEqual(routes([-11900,8000,3900]),[[0,1,8000],[0,2,3900]])
assert.deepEqual(routes([2000,-1000,-1000]),[[1,0,1000],[2,0,1000]])
assert.deepEqual(routes([0,-1000,0]),[[1,-1,1000]])
assert.deepEqual(routes([-8000,9000,0]),[[0,1,8000],[-1,1,1000]])
assert.deepEqual(routes([0,0,0]),[])
assert.deepEqual(flights([0,0,-1000,1000],seats).map(f=>[f.fromX,f.fromY,f.toX,f.toY]),[[50,77,18,50]])
const animated=board(3);ron(animated)
assert.deepEqual(animated.data.roundFeedback[0].rolls[1].map(f=>f.points).filter((_,i)=>[0,8,16].includes(i)),[25000,31000,33000])
assert.equal(animated.data.players[1].points,33000)
assert.equal(storage.currentGame.gameState.players[1].points,33000)
assert.ok(!JSON.stringify(storage).includes('rolls'))
assert.ok(!JSON.stringify(storage).includes('flights'))
tick(230);animated.startTsumo();assert.deepEqual(animated.data.roundFeedback,[]);assert.equal(animated.data.players[1].points,33000);animated.onUnload()
assert.match(css,/round-points-roll 1600ms steps\(16,end\)/)
assert.match(css,/\.round-flight-layer\s*\{[^}]*pointer-events:none/)
assert.match(css,/@media \(prefers-reduced-motion:reduce\)[\s\S]*round-points-window,\.round-flight-layer \{ display:none/)
assert.ok(template.includes('fmt.points(pointsFrame.points)'))
assert.ok(template.includes('roundFeedbackRunning ? flight.toX : flight.fromX'))

assert.match(css,/\.player-points-final\.negative,\.round-points-frame\.negative\s*\{\s*color:#f3b3a3/ )

// Centered timeline: three/four-player boundaries and the next full wind cycle.
const {progress}=require('../../utils/round-feedback')
for(const count of [3,4]){
 const config={playerCount:count}
 assert.deepEqual(progress({config,roundNum:1,roundWind:0}).map(p=>p.label),['','','东1','东2','东3',count===3?'南1':'东4'])
 assert.deepEqual(progress({config,roundNum:count,roundWind:0}).map(p=>p.label),count===3?['东1','东2','东3','南1','南2','南3']:['东2','东3','东4','南1','南2','南3'])
 assert.deepEqual(progress({config,roundNum:1,roundWind:0,roundCycle:2}).map(p=>p.label),count===3?['北2','北3','东1','东2','东3','南1']:['北3','北4','东1','东2','东3','东4'])
 for(const wind of [0,1,2,3]){
  const game=board(count)
  game.setData({roundNum:count,roundWind:wind,roundWindName:['東','南','西','北'][wind],dealerIdx:count-1})
  game._refreshHistoryCards()
  const oldItems=clone(game.data.roundProgressItems)
  game.setData({selectedWinner:1,selectedLoser:0,inputPoints:'8000'});game.confirmRon()
  assert.equal(game.data.roundProgressItems[2].label,['东','南','西','北'][wind]+count)
  assert.equal(game.data.roundProgressMoving,false)
  tick(230);assert.equal(game.data.roundProgressMoving,false)
  tick(1600);assert.equal(game.data.roundFeedbackTransition,true);assert.equal(game.data.roundProgressMoving,true)
  assert.equal(game.data.roundProgressItems[3].label,['南','西','北','东'][wind]+'1')
  tick(800);assert.equal(game.data.roundProgressMoving,false)
  assert.equal(game.data.roundProgressItems[2].label,['南','西','北','东'][wind]+'1')
  assert.equal(game.data.roundProgressItems[2].id,oldItems[2].id+1)
  game.onLoad({resume:'1'});assert.equal(game.data.roundProgressMoving,false)
  game.undoLastRound();assert.deepEqual(game.data.roundProgressItems,oldItems);game.onUnload()
 }
 const repeat=board(count);repeat.setData({selectedWinner:0,inputKoPayment:'4000'});repeat.confirmTsumo()
 tick(230);tick(1600);assert.equal(repeat.data.roundProgressMoving,false);assert.equal(repeat.data.roundFeedbackAngle,0)
 assert.equal(repeat.data.roundProgressItems[2].label,'东1');repeat.onUnload()
 const interrupted=board(count);ron(interrupted);tick(230);tick(1600)
 interrupted.startDraw();assert.equal(interrupted.data.roundProgressMoving,false)
 assert.equal(interrupted.data.roundProgressItems[2].label,'东2');interrupted.onUnload()
}
assert.match(css,/\.round-progress-track\.progress-moving\s*\{[^}]*translateX\(-16\.666667%\)[^}]*transform 280ms cubic-bezier\(\.77,0,\.175,1\)/)
assert.match(css,/\.round-feedback-transition \.compass-direction\s*\{[^}]*transform 280ms cubic-bezier\(\.77,0,\.175,1\)/)
assert.match(css,/\.progress-current-marker\s*\{[^}]*left:50%[^}]*scale\(1\.3\)/)
assert.ok(template.includes('roundProgressItems'))

// The right-hand connector must already cover the viewport at every slide frame,
// including the final position before the items are rebased (previously ended at 83.33%).
const trackRule=css.match(/\.round-progress-track\s*\{([^}]+)\}/)[1]
const stopRule=css.match(/\.progress-stop\s*\{([^}]+)\}/)[1]
const movingRule=css.match(/\.round-progress-track\.progress-moving\s*\{([^}]+)\}/)[1]
const trackWidth=Number(trackRule.match(/width:([\d.]+)%/)[1])
const trackLeft=Number(trackRule.match(/left:([-\d.]+)%/)[1])
const stopWidth=trackWidth*Number(stopRule.match(/flex:0 0 ([\d.]+)%/)[1])/100
const shift=trackWidth*Number(movingRule.match(/translateX\(([-\d.]+)%\)/)[1])/100
for(const count of [3,4]){
 const before=progress({config:{playerCount:count},roundNum:count,roundWind:3})
 const after=progress({config:{playerCount:count},roundNum:1,roundWind:0,roundCycle:2})
 assert.equal(before[5].label,'东3')
 assert.deepEqual(before.slice(1).map(p=>p.id),after.slice(0,5).map(p=>p.id))
 for(const fraction of [0,.25,.5,.75,1]){
  const lastDot=trackLeft+(before.length-.5)*stopWidth+shift*fraction
  assert.ok(lastDot>=100,`right edge covered throughout slide: ${count}, ${fraction}`)
 }
 assert.ok(Math.abs(trackLeft+2.5*stopWidth-50)<.0001)
 assert.ok(Math.abs(trackLeft+3.5*stopWidth+shift-50)<.0001)
}

// A newly committed record animates on its first reveal, not on every drawer open.
const arrival=board(3);ron(arrival)
const latestId=arrival.data.roundHistory[0].id
assert.equal(arrival.data.freshRecordId,latestId);assert.equal(arrival.data.revealedRecordId,'')
arrival.toggleRecords();assert.equal(arrival.data.revealedRecordId,latestId);assert.equal(arrival.data.freshRecordId,'')
arrival.toggleRecords();arrival.toggleRecords();assert.equal(arrival.data.revealedRecordId,'')
ron(arrival,2);assert.equal(arrival.data.revealedRecordId,arrival.data.roundHistory[1].id)
arrival.undoLastRound();assert.equal(arrival.data.revealedRecordId,'');arrival.onUnload()
