// Local-only fixtures. Run: node test/local-data/generate-hanchan.js
// Uses production scoring/round/settlement paths, with in-memory wx storage.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Records = require('../../utils/game-records')
const Storage = require('../../utils/game-storage')
const { calculate } = require('../../utils/calculator')
const { settle } = require('../../utils/game-settlement')
const cases = require('../winning-hands.cases')
const clone = Records.clone
let definition, memory = {}
global.Page = value => { definition = value }
global.wx = { getStorageSync: key => memory[key], setStorageSync: (key, value) => { memory[key] = clone(value) },
  removeStorageSync: key => { delete memory[key] }, showToast: o => { throw Error(o.title) }, navigateTo() {}, showShareMenu() {} }
require('../../pages/game/board')
const parse = (s = '') => (s.match(/[1-9]+[mps]|[東南西北白发中]/g) || []).flatMap(t => t.length === 1 ?
  [27 + '東南西北白发中'.indexOf(t)] : [...t.slice(0, -1)].map(n => 9 * 'mps'.indexOf(t.at(-1)) + Number(n) - 1))
const records = []
function board(number, label, rules = {}, extra = {}) {
  memory = {}
  const b = { ...definition, data: clone(definition.data), setData(v) { Object.assign(this.data, v) } }
  // New UI uses free play; seed historical hanchan using existing hanchan rules.
  b._autoSave = function () { this._refreshHistoryCards(); if (!this.data.gameOver) Storage.saveCurrent(this.data) }
  b.onLoad({ config: encodeURIComponent(JSON.stringify({ gameType: 'hanchan', startPoints: 25000,
    returnPoints: 30000, uma: '10-20', players: ['测试·青岚', '测试·白露', '测试·秋叶', '测试·冬月'],
    rules: { multipleRon: true, bankruptcy: false, extension: false, dealerFinish: false, ...rules }, ...extra })) })
  b.setData({ gameId: `test-hanchan-20261003-${number}`, gameDate: '2026/10/03' })
  b.data.gameDate = ['2026/10/03','2026/10/02','2026/10/01','2026/09/30','2026/09/29','2026/09/28','2026/09/27','2026/09/26'][number-1]
  b.label = label
  b._autoSave()
  return b
}
function reset(b) { b.setData({ ...Records.input(definition.data), roundRiichi: [false,false,false,false] }) }
function calc(b, spec, winner) {
  const c = typeof spec === 'number' ? cases[spec-1] : spec
  const hand = parse(c.tiles), agariTile = parse(c.win)[0]
  assert(hand.includes(agariTile)); hand.splice(hand.indexOf(agariTile), 1)
  const melds = c.melds.map(m => ({ type: m.type, tiles: parse(m.tiles), redTiles: [] }))
  const context = { ...c.context, bakaze: 27+b.data.roundWind,
    jikaze: 27+(winner-b.data.dealerIdx+4)%4, honba: b.data.honba,
    dora: parse(c.context.dora), uraDora: parse(c.context.uraDora), redDora: { m5:0,p5:0,s5:0,...c.context.redDora } }
  const physical = [...hand, agariTile, ...melds.flatMap(m=>m.tiles)]
  if (!context.dora.length) {
    // Pick an actual indicator whose dora is absent to retain the selected hand's score.
    const next = t => t < 27 ? Math.floor(t/9)*9+(t+1)%9 : t < 31 ? 27+(t-26)%4 : 31+(t-30)%3
    context.dora = [Array.from({length:34},(_,i)=>i).find(i=>physical.filter(t=>t===i).length<4&&!physical.includes(next(i)))]
  }
  const counts=Array(34).fill(0)
  for(const t of [...physical,...context.dora,...context.uraDora]) assert(++counts[t]<=4)
  const result = calculate({hand,melds,agariTile,context})
  assert(!result.error, c.name+': '+result.error)
  const input = { hand, melds, agariTile, handRed: hand.map(()=>false), agariRed:false,
    ...Object.fromEntries(['riichi','doubleRiichi','ippatsu','haitei','rinshan','chankan','tenhou','chihou'].map(k=>[k,!!context[k]])),
    dora:context.dora, uraDora:context.uraDora, redM5:!!context.redDora.m5, redP5:!!context.redDora.p5, redS5:!!context.redDora.s5 }
  for(const [key,t] of [['m5',4],['p5',13],['s5',22]]) if(context.redDora[key]) {
    const i=hand.indexOf(t)
    if(i>=0) input.handRed[i]=true
    else if(agariTile===t) input.agariRed=true
    else melds.find(m=>m.tiles.includes(t)).redTiles=[t]
  }
  return { ...result, calculatorInput:input, seedCase:c.id||c.name }
}
function win(b, spec, winner=(b.data.dealerIdx+1)%4, loser=b.data.dealerIdx, otherRiichi=[]) {
  reset(b)
  const result = calc(b,spec,winner)
  b.setData({selectedWinner:winner,selectedLoser:loser,roundRiichi:[0,1,2,3].map(i=>otherRiichi.includes(i))})
  const count=b.data.roundHistory.length
  const agariType=(typeof spec==='number'?cases[spec-1]:spec).context.agariType
  b[agariType==='tsumo'?'_processCalcTsumo':'_processCalcRon'](result)
  assert.equal(b.data.roundHistory.length,count+1)
}
function draw(b, tenpai=[], reason='', riichi=[]) {
  reset(b)
  b.setData({drawTenpai:[0,1,2,3].map(i=>tenpai.includes(i)),drawType:reason?'abortive':'exhaustive',abortReason:reason||'九种九牌',
    roundRiichi:[0,1,2,3].map(i=>riichi.includes(i))})
  b.confirmDraw()
}
function multi(b,count) {
  reset(b)
  const loser=(b.data.dealerIdx+3)%4
  const hands=[
    {name:'双响A',tiles:'123m456m789s345p55s',win:'5p',melds:[],context:{agariType:'ron',riichi:true,dora:'北'}},
    {name:'双响B',tiles:'789m123s456s345p77p',win:'5p',melds:[],context:{agariType:'ron',riichi:true,dora:'北'}},
    {name:'三响C',tiles:'111m999p白白白55p',win:'5p',melds:[{type:'pon',tiles:'222s'}],context:{agariType:'ron',dora:'北'}}]
  const seats=[0,1,2,3].filter(i=>i!==loser).slice(0,count)
  const entries=seats.map((idx,i)=>{const r=calc(b,hands[i],idx);return {idx,name:b.data.players[idx].name,
    points:String(r.payment.total-b.data.honba*300),calcResult:r,calculatorInput:r.calculatorInput}})
  const counts=Array(34).fill(0)
  for(const e of entries) for(const t of [...e.calculatorInput.hand,...e.calculatorInput.melds.flatMap(m=>m.tiles)]) assert(++counts[t]<=4)
  assert(++counts[13]<=4);assert(++counts[30]<=4)
  b.setData({selectedLoser:loser,multiRonMode:true,ronEntries:entries,
    roundRiichi:[0,1,2,3].map(i=>entries.some(e=>e.idx===i&&e.calculatorInput.riichi))})
  b.confirmRon()
}
function finish(b, choices=[1,2,11,49,23,10,17,29]) {
  let n=0
  while(!b.data.gameOver) { assert(n<30,'finish loop');win(b,choices[n++%choices.length]) }
  const r=memory.gameHistory.find(r=>r.id===b.data.gameId)
  assert(r)
  r.testData={batch:'hanchan-20261003',scenario:b.label,synthetic:true}
  r.rounds.forEach((x,i)=>{x.id=`${r.id}-round-${String(i+1).padStart(2,'0')}`})
  r.gameState.roundHistory=clone(r.rounds)
  records.push(r)
}
let b=board(1,'门清、副露、赤宝牌、里宝牌、连庄与立直供托')
win(b,4,0,1);win(b,76,0,2);win(b,75,1,0,[2]);win(b,11);win(b,49);win(b,64);win(b,65);win(b,8);finish(b)
b=board(2,'荒牌0至4家听牌、五种途中流局、本场与供托累计')
for(const reason of ['九种九牌','四风连打','四家立直','四杠散了','三家和']) {draw(b,[],reason,reason==='四家立直'?[0,1,2,3]:[]);if(reason==='四家立直')win(b,1,0,1)}
draw(b,[0,1,2,3],'',[0,2]);draw(b,[0,1,2],'',[1]);draw(b,[0,1]);draw(b,[0]);draw(b,[]);finish(b)
b=board(3,'双响、三响、庄家参与、供托就近分配、同名玩家',{},{players:['测试·同名','测试·同名','测试·长昵称小林同学','测试·🀄']})
multi(b,2);multi(b,3);win(b,9);win(b,7);finish(b)
b=board(4,'满贯、跳满、倍满、三倍满、累计役满、役满、双倍与复合役满')
win(b,{...cases[35],context:{...cases[35].context,riichi:true,dora:'4m',redDora:{m5:1}}},0,1)
for(const id of [53,36,54,81,82,83,94,67])win(b,id)
finish(b)
b=board(5,'南四流局进入西入，延长战达标',{extension:true})
for(let i=0;i<8;i++)draw(b,[])
assert.equal(b.data.roundWind,2);win(b,36,1,0);assert.equal(b.data.endReason,'延长战达标');finish(b)
b=board(6,'南四庄家首位止',{dealerFinish:true})
for(let i=0;i<7;i++)win(b,1)
win(b,36,3,0);assert.equal(b.data.endReason,'庄家首位止');finish(b)
b=board(7,'南四役满放铳飞人终局',{bankruptcy:true})
for(let i=0;i<7;i++)win(b,1)
win(b,82,0,1);assert.equal(b.data.endReason,'飞人终局');finish(b)
b=board(8,'全场平分、同分按起始座次、终局未领取供托',{},{uma:'5-15'})
for(let i=0;i<7;i++)draw(b,[])
draw(b,[],'四家立直',[0,1,2,3]);draw(b,[]);finish(b)
for(const r of records) {
  assert(r.gameState.gameOver);assert.equal(r.config.gameType,'hanchan');assert.equal(r.rounds[0].before.roundWind,0)
  assert.equal(r.rounds[0].before.roundNum,1);assert.equal(r.rounds[0].before.honba,0)
  for(let i=0;i<r.rounds.length;i++) {
    const x=r.rounds[i];assert(x.before&&x.after&&x.input&&x.id)
    if(i)assert.deepEqual(x.before,r.rounds[i-1].after)
    for(const s of [x.before,x.after])assert.equal(s.players.reduce((n,p)=>n+p.points,0)+s.riichiSticks*1000,100000)
    if(x.type!=='draw') {
      if(x.winners)for(const e of x.input.ronEntries)assert(e.calculatorInput&&e.calcResult.yaku.length)
      else {
        assert(x.input.calculatorInput&&x.yaku.length&&x.han!==undefined&&x.fu!==undefined)
        if(x.yaku.some(y=>['门前清自摸和','岭上开花','海底摸月'].includes(y.name)))assert.equal(x.type,'tsumo')
      }
    }
  }
  assert.deepEqual(r.result,settle(r.config,r.gameState.players))
  assert.deepEqual(r.gameState.roundHistory,r.rounds)
}
const output=path.join(__dirname,'hanchan-20261003.json')
if (!process.argv.includes('--check')) fs.writeFileSync(output,JSON.stringify(records,null,2)+'\n')
console.log(JSON.stringify(records.map(r=>({id:r.id,scenario:r.testData.scenario,rounds:r.rounds.length,end:r.gameState.endReason,points:r.gameState.players.map(p=>p.points),sticks:r.gameState.riichiSticks})),null,2))
console.log('PASS: complete snapshots, continuity, scoring information, conservation, settlement; '+records.reduce((n,r)=>n+r.rounds.length,0)+' rounds.')
