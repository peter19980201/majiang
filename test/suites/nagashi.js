const assert = require('assert')
const Round = require('../../utils/game-round')
const Transaction = require('../../utils/round-transaction')
const Records = require('../../utils/game-records')
const View = require('../../utils/round-view')
const Reports = require('../../utils/battle-report')
const before = Records.clone(require('../fixtures/pre-stage-one.json').unfinished.gameState)
before.config.gameType = 'free'
before.dealerIdx = 0
before.honba = 2
before.riichiSticks = 2
const input = { drawType: 'nagashi', nagashiWinners: [true,false,false,false],
  drawTenpai: [false,false,false,false], roundRiichi: [false,false,false,false] }
// Independent fixed payments: dealer 4000 each, child receives 4000+2000+2000.
const examples = [
  [[true,false,false,false], [12000,-4000,-4000,-4000]],
  [[false,true,false,false], [-4000,8000,-2000,-2000]],
  [[true,true,false,false], [8000,4000,-6000,-6000]],
  [[false,true,true,false], [-8000,6000,6000,-4000]],
  [[true,true,true,true], [0,0,0,0]]
]
for (const [selected, expected] of examples) {
  const original = JSON.stringify(before)
  const result = Round.evaluate(before, {...input,nagashiWinners:selected}, 'draw')
  assert(!result.error, result.error)
  assert.deepStrictEqual(result.state.players.map((p,i)=>p.points-before.players[i].points), expected)
  assert.strictEqual(result.state.honba,3)
  assert.strictEqual(result.state.riichiSticks,2)
  assert.strictEqual(result.state.dealerIdx,1)
  assert.strictEqual(result.record.nagashi,true)
  assert.strictEqual(result.record.nagashiRule,'draw-mangan-v1')
  assert.strictEqual(JSON.stringify(before),original)
}
const ready = {...input,drawTenpai:[true,false,false,false],roundRiichi:[true,false,false,false]}
const continued = Round.evaluate(before, ready, 'draw')
assert.strictEqual(continued.state.dealerIdx,0)
assert.strictEqual(continued.state.riichiSticks,3)
assert.deepStrictEqual(continued.state.players.map((p,i)=>p.points-before.players[i].points), [11000,-4000,-4000,-4000])
for (const selected of [[],[false,false,false,false],[1,false,false,false],undefined]) {
  assert(Round.evaluate(before,{...input,nagashiWinners:selected},'draw').error)
}
// Exhaust all qualifier sets and dealer seats: point + deposit conservation.
for(let dealer=0;dealer<4;dealer++) for(let mask=1;mask<16;mask++) {
  const selected = [0,1,2,3].map(i=>Boolean(mask & (1<<i)))
  const state = {...before,dealerIdx:dealer}
  const result = Round.evaluate(state,{...ready,nagashiWinners:selected},'draw')
  const total = s=>s.players.reduce((sum,p)=>sum+p.points,0)+s.riichiSticks*1000
  assert.strictEqual(total(result.state),total(state))
}
const original = {...before,...ready,roundHistory:[]}
const saved = Transaction.prepare(original,before,null,'draw','manual').state
const record = saved.roundHistory[0]
assert(record.correctionAvailable)
assert.deepStrictEqual(record.input.nagashiWinners,input.nagashiWinners)
assert.deepStrictEqual(record.before,Records.snapshot(before)) // undo source includes deposits and round
const replacement = Transaction.prepare({...original,...saved,nagashiWinners:[false,true,false,false]},record.before,record,'draw','manual').state
assert.strictEqual(replacement.roundHistory.length,1)
assert.strictEqual(replacement.roundHistory[0].id,record.id)
assert.deepStrictEqual(replacement.players.map((p,i)=>p.points-before.players[i].points),[-5000,8000,-2000,-2000])
assert.strictEqual(View.card(record).typeLabel,'流局满贯')
const report = Reports.build({config:before.config,result:[],rounds:[record]})
assert.strictEqual(report.rounds[0].typeLabel,'流局满贯')
assert(Reports.text(report).includes('流局满贯'))
assert.strictEqual(report.highlights.length,0) // draw treatment, not ordinary winning-hand statistics
console.log('Nagashi passed: fixed transfers, all dealer/qualifier combinations, deposits, continuation, input validation, correction snapshots and reports.')

// Page integration: live preview, cancel, persisted correction and deletion.
let definition
let store = {}
global.Page = value => { definition = value }
global.wx = {
  showShareMenu() {}, showToast() {}, setNavigationBarTitle() {},
  getStorageSync(key) { return store[key] ? Records.clone(store[key]) : '' },
  setStorageSync(key,value) { store[key] = Records.clone(value) },
  removeStorageSync(key) { delete store[key] },
  showModal(options) { options.success({confirm:true}) }
}
require('../../pages/game/board')
function board() {
  const page = {...definition,data:Records.clone(definition.data),setData(value){Object.assign(this.data,value)}}
  for(const key of Object.keys(definition)) if(typeof definition[key]==='function') page[key]=definition[key].bind(page)
  page.onLoad({config:encodeURIComponent(JSON.stringify({gameType:'free',startPoints:25000,returnPoints:30000,uma:'10-20',players:['東家','南家','西家','北家']}))})
  return page
}
const page = board()
const initial = Records.snapshot(page.data)
page.selectDrawType({currentTarget:{dataset:{type:'nagashi'}}})
page.toggleNagashi({currentTarget:{dataset:{idx:1}}})
assert.deepStrictEqual(page.data.drawPreview.map(p=>p.delta),[-4000,8000,-2000,-2000])
page.closeDraw()
assert.deepStrictEqual(Records.snapshot(page.data),initial)
page.setData({drawType:'nagashi',nagashiWinners:[false,true,false,false]})
page.confirmDraw()
assert.strictEqual(page.data.roundHistory.length,1)
assert(page.data.roundHistory[0].nagashi)
assert.deepStrictEqual(page.data.players.map((p,i)=>p.points-initial.players[i].points),[-4000,8000,-2000,-2000])
page.editLastRound()
assert.strictEqual(page.data.drawType,'nagashi')
assert.deepStrictEqual(page.data.nagashiWinners,[false,true,false,false])
page.toggleNagashi({currentTarget:{dataset:{idx:0}}})
assert.deepStrictEqual(page.data.drawPreview.map(p=>p.delta),[8000,4000,-6000,-6000])
page.confirmDraw()
assert.strictEqual(page.data.roundHistory.length,1)
page.undoLastRound()
assert.deepStrictEqual(Records.snapshot(page.data),initial)
console.log('Nagashi page passed: preview, cancel without score changes, confirm, edit restore/replacement and undo.')
