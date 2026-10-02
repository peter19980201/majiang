const assert = require('assert')
const path = require('path')
const Quick = require('../utils/quick-score')
const View = require('../utils/round-view')
const fixtures = require('./fixtures/pre-stage-one.json')
const clone = x => JSON.parse(JSON.stringify(x))
const input = { kind: 'hanfu', han: 3, fu: 40, isOya: false, agariType: 'ron', honba: 0 }
const calc = patch => Quick.calculate({ ...input, ...patch })

// Fixed expected payments, not values recomputed from the scoring implementation.
for (const [patch, total, ko, oya] of [
  [{}, 5200], [{ isOya: true }, 7700],
  [{ han: 2, fu: 25 }, 1600], [{ han: 3, fu: 25, agariType: 'tsumo' }, 3200, 800, 1600],
  [{ han: 2, fu: 20, agariType: 'tsumo' }, 1500, 400, 700],
  [{ han: 1, fu: 40, agariType: 'tsumo' }, 1500, 400, 700],
  [{ han: 4, fu: 30 }, 8000], [{ han: 3, fu: 60 }, 7700],
  [{ han: 3, fu: 70 }, 8000], [{ han: 5 }, 8000], [{ han: 6 }, 12000],
  [{ han: 8 }, 16000], [{ han: 11 }, 24000], [{ han: 13 }, 32000],
  [{ han: 13, isOya: true }, 48000],
  [{ kind: 'yakuman', yakumanTimes: 2 }, 64000],
  [{ kind: 'yakuman', yakumanTimes: 2, isOya: true, agariType: 'tsumo', honba: 2 }, 96600, 32200],
  [{ honba: 2 }, 5800], [{ agariType: 'tsumo', honba: 2 }, 5800, 1500, 2800],
  [{ isOya: true, agariType: 'tsumo' }, 7800, 2600]
]) {
  const result = calc(patch)
  assert(!result.error, JSON.stringify(patch))
  assert.strictEqual(result.payment.total, total, JSON.stringify(patch))
  if (ko !== undefined) assert.strictEqual(result.payment.koPayment, ko)
  if (oya !== undefined) assert.strictEqual(result.payment.oyaPayment, oya)
  assert.deepStrictEqual(result.yaku, [])
}
for (const patch of [{ fu: 20 }, { han: 1, fu: 20, agariType: 'tsumo' },
  { han: 1, fu: 25 }, { han: 2, fu: 25, agariType: 'tsumo' },
  { han: 1, fu: 110, agariType: 'tsumo' }, { han: 0 }, { han: 14 }, { han: 2.5 },
  { fu: 35 }, { honba: -1 }, { honba: 100 }, { honba: 1.5 },
  { kind: 'yakuman', yakumanTimes: 0 }, { kind: 'yakuman', yakumanTimes: 7 }]) assert(calc(patch).error)
assert.strictEqual(calc({ han: 5, fu: 20 }).quickInput.fu, 0)
assert.strictEqual(calc({ han: 13 }).level, '累计役满')
assert.strictEqual(calc({ kind: 'yakuman', yakumanTimes: 1 }).han, -1)
assert.strictEqual(Quick.table(false, 'ron')[0].cells[1].text, '—')
assert.strictEqual(Quick.table(false, 'tsumo')[0].cells[1].text, '400/700')
assert.strictEqual(Quick.table(false, 'ron').find(row => row.fu === 30).cells[3].text, '8000')

let definition, storage = {}, navigation, sent, returns = 0
global.Page = value => { definition = value }
global.wx = { showShareMenu() {}, getStorageSync: key => storage[key] ? clone(storage[key]) : '',
  setStorageSync: (key, value) => { storage[key] = clone(value) }, removeStorageSync: key => { delete storage[key] },
  showToast() {}, showModal: options => options.success({ confirm: true }),
  navigateTo: options => { navigation = options }, navigateBack: () => { returns++ } }
function page(file) {
  const full = path.resolve(__dirname, '..', file)
  delete require.cache[full]; require(full)
  const p = { ...definition, data: clone(definition.data), setData(v) { Object.assign(this.data, v) } }
  Object.keys(definition).forEach(k => { if (typeof definition[k] === 'function') p[k] = definition[k].bind(p) })
  return p
}
function board() {
  storage = { currentGame: clone(fixtures.unfinished) }
  const p = page('pages/game/board.js'); p.onLoad({ resume: '1' })
  p.setData({ selectedWinner: 1, selectedLoser: 0, honba: 2, roundRiichi: [false, true, false, false] })
  return p
}
let p = board()
const before = clone(p.data.players)
p.goToQuickRon()
assert(navigation.url.startsWith('/pages/quick-score/quick-score?'))
assert(navigation.url.includes('honba=2'))
p.onShow() // cancel/back restores entry, no payment applied
assert(p.data.showRonModal)
assert.deepStrictEqual(p.data.players, before)
p.goToQuickRon(); navigation.events.calcResult(calc({ honba: 2 }))
assert.deepStrictEqual(p.data.players.map(x => x.points), [19200, 30800, 25000, 25000])
assert.strictEqual(p.data.roundHistory[0].input.source, 'hanfu')
assert.strictEqual(p.data.roundHistory[0].version, 4)
assert.strictEqual(View.describe(p.data.roundHistory[0]).source, 'hanfu')
p.onShow(); assert(!p.data.showRonModal)
p.editLastRound(); p.goToQuickRon()
navigation.success({ eventChannel: { emit: (event, data) => { sent = { event, data } } } })
assert.strictEqual(sent.event, 'restoreQuickInput')
assert.strictEqual(sent.data.han, 3)
navigation.events.calcResult(calc({ han: 2, fu: 25, honba: 2 }))
assert.strictEqual(p.data.roundHistory.length, 1)
assert.deepStrictEqual(p.data.players.map(x => x.points), [22800, 27200, 25000, 25000])
p.undoLastRound(); assert.deepStrictEqual(p.data.players, before)

p = board(); p.goToQuickTsumo(); navigation.events.calcResult(calc({ agariType: 'tsumo', honba: 2 }))
assert.deepStrictEqual(p.data.players.map(x => x.points), [22200, 30800, 23500, 23500])
const saved = clone(storage.currentGame)
const resumed = page('pages/game/board.js'); resumed.onLoad({ resume: '1' })
assert.deepStrictEqual(resumed.data.roundHistory, saved.gameState.roundHistory)

p = board(); p.setData({ multiRonMode: true, ronEntries: [{ idx: 1, points: '' }, { idx: 2, points: '8000' }] })
p.goToMultiQuick({ currentTarget: { dataset: { idx: 1 } } })
navigation.events.calcResult(calc({ honba: 2 }))
assert.strictEqual(p.data.roundHistory.length, 0) // no settlement until all winners confirmed
assert.strictEqual(p.data.ronEntries[0].points, '5200')
p.confirmRon()
assert.deepStrictEqual(p.data.players.map(x => x.points), [10600, 30800, 33600, 25000])
assert.strictEqual(p.data.roundHistory[0].winners[0].source, 'hanfu')
assert.strictEqual(View.describe(p.data.roundHistory[0]).winners[0].han, 3)
p.editLastRound(); p.goToMultiQuick({ currentTarget: { dataset: { idx: 1 } } })
navigation.success({ eventChannel: { emit: (event, data) => { sent = { event, data } } } })
assert.strictEqual(sent.data.han, 3)
p.closeRon()

// Existing snapshots are readable without migration or mutation.
for (const key of ['unfinished', 'manual', 'multiRon']) {
  storage = { currentGame: clone(fixtures[key]) }
  const old = clone(fixtures[key].gameState.roundHistory)
  const loaded = page('pages/game/board.js'); loaded.onLoad({ resume: '1' })
  assert.deepStrictEqual(loaded.data.roundHistory, old)
}
const legacy = clone(fixtures.legacy[0].rounds[0])
assert.strictEqual(View.describe(legacy).points, 4200)
assert.deepStrictEqual(legacy, fixtures.legacy[0].rounds[0])
storage = { gameHistory: clone(fixtures.earlyCompleted) }
const ended = page('pages/game/board.js'); ended.onLoad({ historyId: fixtures.earlyCompleted[0].id })
assert(ended.data.gameOver)

// Board context is immutable in the quick calculator; confirm emits once.
const quick = page('pages/quick-score/quick-score.js')
const handlers = {}; let emits = 0
quick.getOpenerEventChannel = () => ({ on: (event, fn) => { handlers[event] = fn }, emit: () => { emits++ } })
quick.onLoad({ mode: 'board', jikaze: '27', agariType: 'tsumo', honba: '2', sticks: '3' })
quick.select({ currentTarget: { dataset: { key: 'isOya', value: 'false' } } })
quick.changeHonba({ currentTarget: { dataset: { delta: 1 } } })
assert(quick.data.isOya); assert.strictEqual(quick.data.honba, 2)
handlers.restoreQuickInput({ kind: 'hanfu', han: 2, fu: 20, yakumanTimes: 0 })
assert.strictEqual(quick.data.result.payment.total, 2700)
quick.confirm(); quick.confirm(); assert.strictEqual(emits, 1)
// Direct winner selection works for old configs that disabled multiple ron.
p = board()
p.setData({ config: { ...p.data.config, rules: { multipleRon: false } }, selectedWinner: -1 })
const pick = idx => p.selectMultiRonWinner({ currentTarget: { dataset: { idx } } })
pick(1)
assert.strictEqual(p.data.multiRonMode, false)
p.onPointsInput({ detail: { value: '3900' } })
pick(2)
assert.strictEqual(p.data.multiRonMode, true)
assert.strictEqual(p.data.ronEntries[0].points, '3900')
pick(2)
assert.strictEqual(p.data.multiRonMode, false)
assert.strictEqual(p.data.selectedWinner, 1)
assert.strictEqual(p.data.inputPoints, '3900')
pick(0) // cannot select the discarder
assert.strictEqual(p.data.ronEntries.length, 1)
pick(2)
p.onMultiRonPoints({ currentTarget: { dataset: { idx: 2 } }, detail: { value: '8000' } })
p.confirmRon()
assert.strictEqual(p.data.roundHistory[0].winners.length, 2)
p.editLastRound()
assert.strictEqual(p.data.ronChoices.filter(c => c.active).length, 2)
pick(1)
assert.strictEqual(p.data.inputPoints, '8000')
p.confirmRon()
assert.strictEqual(p.data.roundHistory.length, 1)
assert.strictEqual(p.data.roundHistory[0].winner, '西家')
assert.strictEqual(p.data.roundHistory[0].winners, undefined)
p.editLastRound()
p.selectRonLoser({ currentTarget: { dataset: { idx: 2 } } })
assert.strictEqual(p.data.selectedWinner, -1)
assert.strictEqual(p.data.ronEntries.length, 0)
p.closeRon()

// A remaining calculated winner keeps the input source and yaku metadata.
p = board()
p.setData({ multiRonMode: true, ronEntries: [
  { idx: 1, points: '5200', calcResult: calc({ honba: 2 }) }, { idx: 2, points: '8000' }
] })
p.selectMultiRonWinner({ currentTarget: { dataset: { idx: 2 } } })
p.confirmRon()
assert.strictEqual(p.data.roundHistory[0].input.source, 'hanfu')
assert.strictEqual(p.data.roundHistory[0].han, 3)
assert.strictEqual(p.data.roundHistory[0].points, 5800)

// Per-player cards save manual drafts without settling or changing other winners.
p = board()
p.setData({ multiRonMode: true, ronEntries: [{ idx: 1, points: '5200', calcResult: calc({ honba: 2 }) }, { idx: 2, points: '' }] })
const cardEvent = idx => ({ currentTarget: { dataset: { idx } } })
p.openMultiRonPoints(cardEvent(2))
p.onMultiRonDraft({ ...cardEvent(2), detail: { value: '125' } })
p.saveMultiRonPoints(cardEvent(2))
assert.strictEqual(p.data.ronEntries[1].points, '')
p.onMultiRonDraft({ ...cardEvent(2), detail: { value: '8000' } })
p.saveMultiRonPoints(cardEvent(2))
assert.strictEqual(p.data.ronEntries[1].points, '8000')
assert.strictEqual(p.data.ronEntries[1].editingPoints, false)
assert.strictEqual(p.data.ronEntries[0].calcResult.source, 'hanfu')
assert.strictEqual(p.data.roundHistory.length, 0)
p.goToMultiQuick(cardEvent(2))
navigation.events.calcResult(calc({ han: 2, fu: 40, honba: 2 }))
p.onShow()
assert.strictEqual(p.data.showRonModal, true)
assert.strictEqual(p.data.ronEntries[1].points, '2600')
assert.strictEqual(p.data.ronEntries[1].calcResult.han, 2)
assert.strictEqual(p.data.roundHistory.length, 0)
p.openMultiRonPoints(cardEvent(2))
assert.strictEqual(p.data.ronEntries[1].draftPoints, '2600')
p.onMultiRonDraft({ ...cardEvent(2), detail: { value: '3900' } })
p.saveMultiRonPoints(cardEvent(2))
assert.strictEqual(p.data.ronEntries[1].calcResult, null)
p.confirmRon()
assert.strictEqual(p.data.roundHistory[0].winners[1].source, 'manual')

console.log('Quick scoring passed: 20 fixed payment examples, invalid inputs, lookup table, board integration, correction, multi-ron, old fixtures, locked context and duplicate confirmation.')
