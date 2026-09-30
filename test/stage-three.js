const assert = require('assert')
const path = require('path')
const Records = require('../utils/game-records')
const { nextRound, DEFAULT_RULES, ABORT_REASONS } = require('../utils/game-rules')
let definition, storage = {}, navigation, toast
global.Page = value => { definition = value }
global.wx = {
  getStorageSync: key => storage[key] ? Records.clone(storage[key]) : '',
  setStorageSync: (key, value) => { storage[key] = Records.clone(value) },
  removeStorageSync: key => { delete storage[key] },
  showToast: options => { toast = options.title },
  showModal: options => options.success({ confirm: true }),
  navigateTo: options => { navigation = options },
  redirectTo: options => { navigation = options },
  navigateBack() {}
}
function page(file) {
  const target = path.resolve(__dirname, '..', file)
  delete require.cache[target]
  require(target)
  return { ...definition, data: Records.clone(definition.data),
    setData(values) { Object.assign(this.data, values) } }
}
const config = { gameType: 'hanchan', startPoints: 25000, returnPoints: 30000,
  uma: '10-20', players: ['A', 'B', 'C', 'D'], playerIds: ['a', 'b', 'c', 'd'] }
function game(rules = {}) {
  storage = {}
  const board = page('pages/game/board.js')
  board.onLoad({ config: encodeURIComponent(JSON.stringify({ ...config, rules })) })
  return board
}
function total(board) { return board.data.players.reduce((sum, p) => sum + p.points, 0) + board.data.riichiSticks * 1000 }

// Creation persists rule switches and uses plain nicknames without profile writes.
const setup = page('pages/game/setup.js')
storage.playerProfiles = [{ id: 'a', name: 'A' }]
for (const key of Object.keys(DEFAULT_RULES)) setup.toggleRule({ currentTarget: { dataset: { key } }, detail: { value: true } })
setup.startGame()
const created = JSON.parse(decodeURIComponent(navigation.url.split('config=')[1]))
assert.deepStrictEqual(created.rules, Object.fromEntries(Object.keys(DEFAULT_RULES).map(key => [key, true])))
assert.deepStrictEqual(created.players, ['東家', '南家', '西家', '北家'])
assert.strictEqual(created.playerIds, undefined)
assert.strictEqual(created.rules.collectStats, undefined)
assert.deepStrictEqual(storage.playerProfiles, [{ id: 'a', name: 'A' }])

// Double/triple ron: every discarder and dealer, each pays honba separately;
// only nearest winner takes sticks, and the dealer continues iff among winners.
for (let dealer = 0; dealer < 4; dealer++) for (let loser = 0; loser < 4; loser++) {
  for (const count of [2, 3]) {
    const board = game({ multipleRon: true })
    const winners = [1, 2, 3].map(offset => (loser + offset) % 4).slice(0, count).reverse()
    board.setData({ dealerIdx: dealer, honba: 2, riichiSticks: 2,
      players: board.data.players.map((p, idx) => ({ ...p, points: p.points - (idx === loser ? 2000 : 0) })),
      selectedLoser: loser, multiRonMode: true,
      ronEntries: winners.map((idx, i) => ({ idx, name: config.players[idx], points: String(3900 + i * 100) })),
      roundRiichi: [true, true, false, false] })
    const before = Records.snapshot(board.data)
    const expected = before.players.map((p, idx) => p.points - (idx < 2 ? 1000 : 0))
    winners.forEach((idx, i) => { expected[idx] += 4500 + i * 100; expected[loser] -= 4500 + i * 100 })
    const nearest = (loser + 1) % 4
    expected[nearest] += 4000
    board.confirmRon()
    assert.deepStrictEqual(board.data.players.map(p => p.points), expected)
    assert.strictEqual(total(board), 100000)
    assert.strictEqual(board.data.roundHistory[0].winners.length, count)
    assert.strictEqual(board.data.roundHistory[0].riichiRecipient, config.players[nearest])
    assert.strictEqual(board.data.dealerIdx, winners.includes(dealer) ? dealer : (dealer + 1) % 4)
    board.editLastRound()
    assert.deepStrictEqual(Records.snapshot(board.data), board.data.roundHistory[0].after)
    board.setData({ ronEntries: board.data.ronEntries.map(entry => ({ ...entry, points: '8000' })) })
    board.confirmRon()
    assert.strictEqual(board.data.roundHistory.length, 1)
    assert.strictEqual(total(board), 100000)
    board.undoLastRound()
    assert.deepStrictEqual(Records.snapshot(board.data), before)
  }
}

for (const rules of [{}, { multipleRon: true }]) {
  const board = game(rules)
  const before = Records.snapshot(board.data)
  board.setData({ multiRonMode: true, selectedLoser: 0,
    ronEntries: [{ idx: 0, points: '3900' }, { idx: 1, points: '3900' }] })
  board.confirmRon()
  assert.deepStrictEqual(Records.snapshot(board.data), before)
  assert.strictEqual(board.data.roundHistory.length, 0)
}

// Each multi-ron winner can use a calculator independently, without committing early.
const multiCalc = game({ multipleRon: true })
multiCalc.setData({ multiRonMode: true, selectedLoser: 0, honba: 2,
  ronEntries: [{ idx: 1, name: 'B', points: '' }, { idx: 2, name: 'C', points: '' }] })
multiCalc.goToMultiCalc({ currentTarget: { dataset: { idx: 1 } } })
navigation.events.calcResult({ payment: { total: 4500 }, yaku: [{ name: '立直', han: 1 }],
  calculatorInput: { hand: [0], riichi: true } })
assert.strictEqual(multiCalc.data.ronEntries[0].points, '3900')
assert.strictEqual(multiCalc.data.roundHistory.length, 0)
assert(multiCalc.data.roundRiichi[1])
multiCalc.onShow()
assert(multiCalc.data.showRonModal)
multiCalc.setData({ ronEntries: multiCalc.data.ronEntries.map(e => ({ ...e, points: '3900' })) })
multiCalc.confirmRon()
assert.strictEqual(multiCalc.data.roundHistory.length, 1)
multiCalc.editLastRound()
assert(multiCalc.data.multiRonMode)
assert(multiCalc.data.ronEntries[0].calculatorInput)

// Abortive draws keep the dealer, carry sticks, and never charge noten.
for (const reason of ABORT_REASONS) {
  const board = game()
  const before = Records.snapshot(board.data)
  board.setData({ drawType: 'abortive', abortReason: reason, drawTenpai: [true, false, false, false],
    roundRiichi: reason === '四家立直' ? [true, true, true, true] : [false, true, false, false] })
  board.updateDrawPreview()
  const deltas = board.data.drawPreview.map(p => p.delta)
  board.confirmDraw()
  assert.deepStrictEqual(board.data.players.map(p => p.points - 25000), deltas)
  assert.strictEqual(board.data.dealerIdx, 0)
  assert.strictEqual(board.data.roundNum, 1)
  assert.strictEqual(board.data.honba, 1)
  assert(board.data.roundHistory[0].abortive)
  assert.strictEqual(total(board), 100000)
  const resumed = page('pages/game/board.js')
  resumed.onLoad({ resume: '1' })
  resumed.editLastRound()
  assert.strictEqual(resumed.data.drawType, 'abortive')
  resumed.undoLastRound() // editing prevents undo until cancelled
  assert.strictEqual(resumed.data.roundHistory.length, 1)
  resumed.closeDraw()
  resumed.undoLastRound()
  assert.deepStrictEqual(Records.snapshot(resumed.data), before)
}
const invalidAbort = game()
invalidAbort.setData({ drawType: 'abortive', abortReason: '无效原因' })
invalidAbort.confirmDraw()
assert.strictEqual(invalidAbort.data.roundHistory.length, 0)

const tripleDraw = game({ abortiveDraw: false, tripleRonDraw: false })
tripleDraw.selectDrawType({ currentTarget: { dataset: { type: 'abortive' } } })
tripleDraw.selectAbortReason({ currentTarget: { dataset: { reason: '三家和' } } })
tripleDraw.confirmDraw()
assert.strictEqual(tripleDraw.data.roundHistory[0].type, 'draw')
assert.strictEqual(tripleDraw.data.roundHistory[0].reason, '三家和')
assert.strictEqual(total(tripleDraw), 100000)
tripleDraw.editLastRound()
assert.strictEqual(tripleDraw.data.drawType, 'abortive')

// Legacy switches no longer override a user's explicit three-winner ron entry.
const explicitRon = game({ multipleRon: true, tripleRonDraw: true, abortiveDraw: true })
explicitRon.setData({ multiRonMode: true, selectedLoser: 0,
  ronEntries: [1, 2, 3].map(idx => ({ idx, points: '1000' })) })
explicitRon.confirmRon()
assert.strictEqual(explicitRon.data.roundHistory[0].type, 'ron')
assert.strictEqual(explicitRon.data.roundHistory[0].winners.length, 3)
assert.strictEqual(total(explicitRon), 100000)

// 0 points is allowed; below 0 ends even if the dealer otherwise continues.
for (const bankruptcy of [false, true]) for (const remaining of [0, -100]) {
  const board = game({ bankruptcy })
  board.setData({ selectedWinner: 0, selectedLoser: 1, inputPoints: '1000',
    players: board.data.players.map((p, idx) => ({ ...p, points: idx === 1 ? 1000 + remaining : p.points })) })
  board.confirmRon()
  assert.strictEqual(board.data.gameOver, bankruptcy && remaining < 0)
  if (board.data.gameOver) {
    assert.strictEqual(board.data.endReason, '飞人终局')
    assert.strictEqual(storage.gameHistory.length, 1)
    board.undoLastRound()
    assert.strictEqual(board.data.gameOver, false)
    assert.strictEqual(storage.gameHistory.length, 0)
  }
}

// End rules for both match lengths, extended-round caps, dealer finish and abort precedence.
for (const gameType of ['tonpuu', 'hanchan']) {
  const normalEnd = gameType === 'tonpuu' ? 1 : 2
  const board = game({ extension: true, dealerFinish: true })
  const state = { ...board.data, config: { ...board.data.config, gameType },
    roundWind: normalEnd - 1, roundNum: 4, dealerIdx: 3 }
  assert.strictEqual(nextRound(state, false, false).roundWind, normalEnd)
  assert.strictEqual(nextRound(state, false, false).gameOver, undefined)
  const reached = { ...state, players: state.players.map((p, i) => ({ ...p, points: i === 3 ? 30000 : 23000 })) }
  assert.strictEqual(nextRound(reached, true, false).endReason, '庄家首位止')
  assert.strictEqual(nextRound(reached, true, true).gameOver, true)
  assert.strictEqual(nextRound(reached, true, true, true).gameOver, undefined)
  const extended = { ...state, roundWind: normalEnd, roundNum: 1 }
  assert.strictEqual(nextRound({ ...extended, players: reached.players }, true, false).endReason, '延长战达标')
  assert.strictEqual(nextRound({ ...extended, roundNum: 4 }, false, false).endReason, '延长场结束')
  assert.strictEqual(nextRound({ ...state, config: { ...state.config, rules: {} } }, false, false).gameOver, true)
  assert.strictEqual(nextRound({ ...reached, config: { ...reached.config, rules: {} } }, true, false).gameOver, undefined)
}

// History beyond 50 games remains available without automatic deletion.
const many = game()
storage.gameHistory = Array.from({ length: 60 }, (_, i) => ({ id: `old-${i}`, config, result: [], rounds: [] }))
many.setData({ roundWind: 1, roundNum: 4, dealerIdx: 3, selectedWinner: 1, selectedLoser: 0, inputPoints: '1000' })
many.confirmRon()
assert.strictEqual(storage.gameHistory.length, 61)
console.log('Stage three passed: creation switches/nicknames, 32 multi-ron cases, hand input, abortive draws, bankruptcy, extension/dealer stop, correction and history retention.')
