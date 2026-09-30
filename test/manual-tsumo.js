// Run with node test/manual-tsumo.js.
const assert = require('assert')
const { calculatePayment } = require('../utils/score')
let definition
let toast
global.Page = value => { definition = value }
global.wx = {
  setStorageSync() {},
  showToast(options) { toast = options.title }
}
require('../pages/game/board')

function board(dealerIdx = 0, selectedWinner = 1) {
  return {
    ...definition,
    data: {
      ...JSON.parse(JSON.stringify(definition.data)),
      config: { gameType: 'hanchan' },
      players: ['東家', '南家', '西家', '北家'].map(name => ({ name, points: 25000 })),
      dealerIdx, selectedWinner,
      inputKoPayment: '700', inputOyaPayment: '1300', showTsumoModal: true
    },
    setData(value) { Object.assign(this.data, value) }
  }
}

// Regression: 700/1300 must remain 2700, never become 2800.
const example = board()
example.confirmTsumo()
assert.deepStrictEqual(example.data.players.map(p => p.points), [23700, 27700, 24300, 24300])
assert.strictEqual(example.data.roundHistory[0].points, 2700)
assert.strictEqual(example.data.roundHistory[0].desc, '庄家1300点/子家700点')

// Every seat, honba and current-round riichi combination matches exact engine payments.
for (let dealer = 0; dealer < 4; dealer++) {
  for (let winner = 0; winner < 4; winner++) {
    for (const honba of [0, 2]) {
      for (let mask = 0; mask < 16; mask++) {
        const game = board(dealer, winner)
        const isOya = winner === dealer
        const base = calculatePayment(640, isOya, true, 0)
        const payment = calculatePayment(640, isOya, true, honba)
        game.data.inputKoPayment = String(base.koPayment)
        game.data.inputOyaPayment = isOya ? '' : String(base.oyaPayment)
        game.data.honba = honba
        game.data.riichiSticks = 2
        game.data.roundRiichi = [0, 1, 2, 3].map(i => Boolean(mask & (1 << i)))
        const newSticks = game.data.roundRiichi.filter(Boolean).length
        const expected = game.data.players.map((p, i) => {
          const riichi = game.data.roundRiichi[i] ? 1000 : 0
          if (i === winner) return p.points - riichi + payment.total + (2 + newSticks) * 1000
          return p.points - riichi - (i === dealer ? payment.oyaPayment : payment.koPayment)
        })
        game.confirmTsumo()
        assert.deepStrictEqual(game.data.players.map(p => p.points), expected)
        assert.strictEqual(game.data.players.reduce((sum, p) => sum + p.points, 0), 102000)
        assert.strictEqual(game.data.riichiSticks, 0)
        assert.strictEqual(game.data.roundHistory[0].points, payment.total)
        assert.strictEqual(game.data.roundHistory[0].riichiCollected, 2 + newSticks)
        assert.strictEqual(game.data.dealerIdx, isOya ? dealer : (dealer + 1) % 4)
        assert.strictEqual(game.data.honba, isOya ? honba + 1 : 0)
        assert.strictEqual(game.data.showTsumoModal, false)
      }
    }
  }
}

// Invalid input cannot change scores, history, riichi or round state.
for (const field of ['inputKoPayment', 'inputOyaPayment']) {
  for (const invalid of ['', '0', '-100', '750', '700.5', '700abc', 'Infinity']) {
    const game = board()
    game.data[field] = invalid
    game.data.roundRiichi[0] = true
    const before = JSON.stringify(game.data)
    toast = ''
    game.confirmTsumo()
    assert(toast)
    assert.strictEqual(JSON.stringify(game.data), before)
  }
}
const missingWinner = board(0, -1)
const before = JSON.stringify(missingWinner.data)
missingWinner.confirmTsumo()
assert.strictEqual(JSON.stringify(missingWinner.data), before)
assert.strictEqual(toast, '请选择和了者')

// Switching the winner clears amounts so a different payer arrangement is re-entered.
const switching = board()
switching.selectTsumoWinner({ currentTarget: { dataset: { idx: '1' } } })
assert.strictEqual(switching.data.inputKoPayment, '700')
switching.selectTsumoWinner({ currentTarget: { dataset: { idx: '0' } } })
assert.strictEqual(switching.data.inputKoPayment, '')
assert.strictEqual(switching.data.inputOyaPayment, '')
console.log('Manual tsumo passed: exact 700/1300 split, 512 payment/riichi scenarios, invalid input and winner switching.')
