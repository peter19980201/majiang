const assert = require('assert')
const Round = require('../../utils/game-round')
const Records = require('../../utils/game-records')

// The domain module must run without a Page instance or any platform API.
global.wx = new Proxy({}, { get() { throw new Error('Round evaluation must not access wx') } })
const before = Records.clone(require('../fixtures/pre-stage-one.json').unfinished.gameState)
before.config.gameType = 'free'
before.honba = 2
before.riichiSticks = 1
const input = {
  selectedWinner: 1, selectedLoser: 0, inputPoints: '3900',
  inputKoPayment: '700', inputOyaPayment: '1300',
  roundRiichi: [false, true, false, false],
  drawTenpai: [true, false, true, false], drawType: 'exhaustive', abortReason: '九种九牌',
  ronEntries: [{ idx: 1, points: '3900' }, { idx: 2, points: '8000' }]
}
function freeze(value) {
  Object.freeze(value)
  Object.values(value).forEach(child => {
    if (child && typeof child === 'object' && !Object.isFrozen(child)) freeze(child)
  })
  return value
}
freeze(before)
freeze(input)
const initial = JSON.stringify({ before, input })
for (const action of ['ron', 'tsumo', 'multiRon', 'draw']) {
  const result = Round.evaluate(before, input, action)
  assert(!result.error, result.error)
  assert.strictEqual(result.state.roundHistory.length, 1)
  assert.strictEqual(result.record.round, '東1局 2本场')
  const total = state => state.players.reduce((sum, p) => sum + p.points, 0) + state.riichiSticks * 1000
  assert.strictEqual(total(result.state), total(before), action + ' must conserve points including riichi')
  assert.strictEqual(JSON.stringify({ before, input }), initial)
  result.state.players[0].points = -999
  assert.strictEqual(JSON.stringify({ before, input }), initial, 'result must not share mutable state with inputs')
}
const ron = Round.evaluate(before, input, 'ron')
assert.deepStrictEqual(ron.state.players.map((p, i) => p.points - before.players[i].points), [-4500, 5500, 0, 0])
const calculator = freeze({ payment: { total: 4500 }, calculatorInput: { riichi: true }, yaku: [{ name: '立直', han: 1 }] })
const calculated = Round.evaluate(before, input, 'calcRon', calculator)
assert.deepStrictEqual(calculated.state.players, ron.state.players)
calculated.record.yaku[0].han = 99
assert.strictEqual(calculator.yaku[0].han, 1)
const failed = Round.evaluate(before, input, 'calcRon', { payment: { total: 123 }, calculatorInput: { doubleRiichi: true } })
assert(failed.error)
assert.strictEqual(failed.state, undefined)
assert.strictEqual(JSON.stringify({ before, input }), initial)
const abort = Round.evaluate(before, { ...input, drawType: 'abortive' }, 'draw')
assert.strictEqual(abort.state.dealerIdx, before.dealerIdx)
assert.strictEqual(abort.state.honba, 3)
assert.strictEqual(abort.record.round, '東1局 2本场')
assert.throws(() => Round.evaluate(before, input, 'unknown'), /Unknown round action/)
console.log('Round domain passed: no platform APIs, immutable inputs, isolated outputs, point conservation, invalid payments and abortive draws.')

// Record preparation also works without platform APIs and preserves correction identity.
const Transaction = require('../../utils/round-transaction')
const originalGame = freeze({ ...cloneState(before), ...cloneState(input), roundHistory: [] })
function cloneState(value) { return JSON.parse(JSON.stringify(value)) }
const prepared = Transaction.prepare(originalGame, before, null, 'ron', 'manual')
assert(!prepared.error)
const savedRecord = prepared.state.roundHistory[0]
const replacement = Transaction.prepare({ ...originalGame, ...prepared.state, inputPoints: '8000' },
  savedRecord.before, savedRecord, 'ron', 'manual')
assert.strictEqual(replacement.state.roundHistory.length, 1)
assert.strictEqual(replacement.state.roundHistory[0].id, savedRecord.id)
assert.strictEqual(savedRecord.points, 4500)
assert.strictEqual(replacement.state.roundHistory[0].points, 8600)
assert.strictEqual(originalGame.roundHistory.length, 0)
assert(Transaction.prepare({ ...originalGame, inputPoints: '123' }, before, null, 'ron', 'manual').error)
console.log('Record preparation passed: isolated append/replace, stable IDs and invalid-input rejection.')
