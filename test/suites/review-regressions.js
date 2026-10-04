// Run with node test/review-regressions.js [name-filter].
const assert = require('assert')
const path = require('path')
const { calculate } = require('../../utils/calculator')
const { parseTiles } = require('../../utils/tiles')
const { calculatePayment } = require('../../utils/score')
const Records = require('../../utils/game-records')
const View = require('../../utils/round-view')
let definition, storage = {}, passed = 0, failed = 0
global.Page = value => { definition = value }
global.wx = {
  showShareMenu() {}, showToast() {}, navigateTo() {}, navigateBack() {},
  getStorageSync: key => storage[key] ? Records.clone(storage[key]) : '',
  setStorageSync: (key, value) => { storage[key] = Records.clone(value) },
  removeStorageSync: key => { delete storage[key] },
  showModal: options => options.success({ confirm: true })
}
function test(name, run) {
  if (process.argv[2] && !name.includes(process.argv[2])) return
  try { run(); passed++; console.log('PASS', name) }
  catch (error) { failed++; console.error('FAIL', name, '\n', error.message) }
}
function page(file) {
  const target = path.resolve(__dirname, '../..', file)
  delete require.cache[target]
  require(target)
  const instance = { ...definition, data: Records.clone(definition.data),
    setData(values) { Object.assign(this.data, values) } }
  Object.keys(definition).forEach(key => {
    if (typeof definition[key] === 'function') instance[key] = definition[key].bind(instance)
  })
  return instance
}
function score(hand, agari, context = {}) {
  return calculate({ hand: parseTiles(hand), melds: [], agariTile: parseTiles(agari)[0],
    context: { agariType: 'ron', bakaze: 27, jikaze: 28, honba: 0, ...context } })
}
function expectScore(result, han, fu, total, yaku, wait) {
  assert.strictEqual(result.error, undefined)
  assert.strictEqual(result.han, han)
  assert.strictEqual(result.fu, fu)
  assert.strictEqual(result.payment.total, total)
  if (yaku) assert(result.yaku.some(y => y.name === yaku), yaku)
  const waits = result.fuDetail.filter(d => ['单骑', '边张', '嵌张'].includes(d.name)).map(d => d.name)
  assert.deepStrictEqual(waits, wait ? [wait] : [])
}

test('engine: edge/ryanmen ambiguity uses pinfu without edge fu', () => {
  expectScore(score('12345m45556p678s', '3m'), 1, 30, 1000, '平和')
})
test('engine: pair/sequence ambiguity uses ryanmen without tanki fu', () => {
  expectScore(score('3455m234456p678s', '5m'), 2, 30, 2000, '平和')
})
test('engine: sequence win preserves three concealed triplets on ron', () => {
  expectScore(score('33345m55777p888s', '3m'), 3, 50, 6400, '三暗刻')
})
test('engine: ambiguous pinfu tsumo remains 20 fu', () => {
  expectScore(score('12345m45556p678s', '3m', { agariType: 'tsumo' }), 2, 20, 1500, '平和')
})
test('engine: actual edge, closed and pair waits retain their fu', () => {
  expectScore(score('12m45556p678999s', '3m', { riichi: true }), 1, 40, 1300, '立直', '边张')
  expectScore(score('13m45556p678999s', '2m', { riichi: true }), 1, 40, 1300, '立直', '嵌张')
  expectScore(score('123m4556p678999s', '5p', { riichi: true }), 1, 40, 1300, '立直', '单骑')
})
test('engine: winning triplet is open for ron, concealed for tsumo', () => {
  const ron = score('33m55777p888999s', '3m')
  assert(!ron.yaku.some(y => y.name === '四暗刻'))
  assert(ron.yaku.some(y => y.name === '三暗刻'))
  assert(ron.fuDetail.some(d => d.name === '明刻(三万)' && d.fu === 2))
  assert(score('33m55777p888999s', '3m', { agariType: 'tsumo' }).yaku.some(y => y.name === '四暗刻'))
})
test('engine: dora never supplies a yaku and input remains immutable', () => {
  const input = { hand: parseTiles('12m45556p678999s'), melds: [], agariTile: 2,
    context: { agariType: 'ron', bakaze: 27, jikaze: 28, dora: [1] } }
  const before = Records.clone(input)
  assert.strictEqual(calculate(input).error, '无成立役种')
  assert.deepStrictEqual(input, before)
})
test('engine: a concealed kan prevents pinfu and retains kan fu', () => {
  const result = calculate({ hand: parseTiles('123m45556p78s'),
    melds: [{ type: 'ankan', tiles: [31,31,31,31] }], agariTile: 26,
    context: { agariType: 'ron', bakaze: 27, jikaze: 28 } })
  expectScore(result, 1, 70, 2300, '役牌:白')
  assert(!result.yaku.some(y => y.name === '平和'))
  assert(result.fuDetail.some(d => d.name === '暗杠(白)' && d.fu === 32))
})

const config = { gameType: 'hanchan', startPoints: 25000, returnPoints: 30000,
  uma: '10-20', players: ['A', 'B', 'C', 'D'] }
function board() {
  storage = {}
  const game = page('pages/game/board.js')
  game.onLoad({ config: encodeURIComponent(JSON.stringify(config)) })
  game.setData({ gameId: 'regression', honba: 2, selectedWinner: 1, selectedLoser: 0,
    inputPoints: '1000', inputKoPayment: '700', inputOyaPayment: '1300' })
  // Keep storage identity in sync when choosing a deterministic test ID.
  game._autoSave()
  return game
}
test('record: manual and calculator ron both display total including honba', () => {
  const manual = board()
  manual.confirmRon()
  const automatic = board()
  automatic._processCalcRon({ payment: { total: 1600 } })
  assert.deepStrictEqual(manual.data.players, automatic.data.players)
  assert.strictEqual(manual.data.roundHistory[0].points, 1600)
  assert.strictEqual(automatic.data.roundHistory[0].points, 1600)
  assert.strictEqual(manual.data.historyCards[0].points, 1600)
  for (const game of [manual, automatic]) {
    assert.strictEqual(game.data.roundHistory[0].basePayment, 1000)
    assert.strictEqual(game.data.roundHistory[0].honbaBonus, 600)
  }
})
test('record: all seats, honba and riichi agree across manual/calculator paths', () => {
  for (let dealer = 0; dealer < 4; dealer++) for (let winner = 0; winner < 4; winner++) {
    for (const tsumo of [false, true]) for (const honba of [0, 2]) for (let mask = 0; mask < 16; mask++) {
      const base = calculatePayment(640, dealer === winner, tsumo, 0)
      const payment = calculatePayment(640, dealer === winner, tsumo, honba)
      const play = automatic => {
        const game = board()
        game.setData({ dealerIdx: dealer, selectedWinner: winner, selectedLoser: (winner + 1) % 4,
          honba, riichiSticks: 2, roundRiichi: [0,1,2,3].map(i => Boolean(mask & (1 << i))),
          inputPoints: String(base.total), inputKoPayment: String(base.koPayment || ''),
          inputOyaPayment: String(base.oyaPayment || '') })
        if (automatic) game[tsumo ? '_processCalcTsumo' : '_processCalcRon']({ payment })
        else game[tsumo ? 'confirmTsumo' : 'confirmRon']()
        const record = game.data.roundHistory[0]
        return { state: Records.snapshot(game.data), points: record.points, basePayment: record.basePayment,
          honbaBonus: record.honbaBonus, riichiCollected: record.riichiCollected }
      }
      assert.deepStrictEqual(play(false), play(true))
    }
  }
})
test('record: legacy manual ron adds honba once; calculator/tsumo remain unchanged', () => {
  const legacy = { version: 2, type: 'ron', points: 1000, honbaBonus: 600 }
  assert.strictEqual(View.describe(legacy).points, 1600)
  assert.strictEqual(legacy.points, 1000)
  assert.strictEqual(View.describe({ type: 'ron', points: 1600 }).points, 1600)
  assert.strictEqual(View.describe({ version: 3, type: 'ron', points: 1600, honbaBonus: 600 }).points, 1600)
  assert.strictEqual(View.describe({ type: 'tsumo', points: 3300 }).points, 3300)
})
test('record: cards omit snapshots while correction, cancel and undo preserve them', () => {
  const game = board()
  const before = Records.snapshot(game.data)
  game.confirmRon()
  const saved = Records.clone(game.data.roundHistory)
  for (const key of ['before', 'after', 'input']) assert(!(key in game.data.historyCards[0]), key)
  game.editLastRound()
  game.onPointsInput({ detail: { value: '2000' } })
  game.closeRon()
  assert.deepStrictEqual(game.data.roundHistory, saved)
  game.editLastRound()
  game.onPointsInput({ detail: { value: '2000' } })
  game.confirmRon()
  assert.strictEqual(game.data.roundHistory.length, 1)
  assert.strictEqual(game.data.roundHistory[0].points, 2600)
  game.undoLastRound()
  assert.deepStrictEqual(Records.snapshot(game.data), before)
})
test('record: invalid calculator payments cannot change scores or storage', () => {
  for (const payment of [{ total: -100 }, { total: 1250 },
    { type: 'tsumo_ko', total: 3400, koPayment: 900, oyaPayment: 1500 }]) {
    const game = board()
    game.setData({ roundRiichi: [true, false, false, false] })
    const before = Records.clone(game.data)
    const saved = Records.clone(storage)
    game[payment.type ? '_processCalcTsumo' : '_processCalcRon']({ payment })
    assert.deepStrictEqual(game.data, before)
    assert.deepStrictEqual(storage, saved)
  }
})
test('storage: all three settlement entries retain snapshots and unique game IDs', () => {
  const results = []
  for (const source of ['board', 'home', 'history']) {
    const game = board()
    game.confirmRon()
    const saved = Records.clone(storage.currentGame)
    if (source === 'board') game.earlySettlement()
    if (source === 'home') page('pages/index/index.js')._settleAndSave(saved)
    if (source === 'history') {
      const history = page('pages/game/history.js')
      history.onShow(); history.abandonGame()
    }
    const record = storage.gameHistory[0]
    assert.strictEqual(storage.gameHistory.length, 1)
    assert.strictEqual(storage.currentGame, undefined)
    assert(record.gameState.gameOver && (record.gameState.endReason === '手动结束' || record.gameState.endedEarly))
    assert.deepStrictEqual(record.rounds, saved.gameState.roundHistory)
    assert.deepStrictEqual(record.gameState.roundHistory, saved.gameState.roundHistory)
    results.push(record.result)
    page('pages/index/index.js')._settleAndSave(saved)
    assert.strictEqual(storage.gameHistory.length, 1)
  }
  assert.deepStrictEqual(results[0], results[1])
  assert.deepStrictEqual(results[1], results[2])
})
test('storage: deleting another game preserves raw correction snapshots', () => {
  const game = board()
  game.confirmRon(); game.earlySettlement()
  const preserved = Records.clone(storage.gameHistory[0])
  storage.gameHistory.push({ id: 'delete-me', config, result: [], rounds: [] })
  const history = page('pages/game/history.js')
  history.onShow()
  history.deleteRecord({ currentTarget: { dataset: { id: 'delete-me' } } })
  assert.deepStrictEqual(storage.gameHistory, [preserved])
})
test('storage: legacy history displays honba while preserving original records', () => {
  storage = { gameHistory: [{ id: 'legacy', config, result: [], rounds: [
    { version: 2, type: 'ron', winner: 'B', loser: 'A', points: 1000, honbaBonus: 600 }
  ] }] }
  const before = Records.clone(storage)
  const history = page('pages/game/history.js')
  history.onShow()
  history.viewSettlement({ currentTarget: { dataset: { id: 'legacy' } } })
  assert.strictEqual(history.data.settlementVisible, true)
  assert.strictEqual(history.data.settlementReport.rounds[0].winners[0].pointsText, '1,600')
  assert.strictEqual(View.card(storage.gameHistory[0].rounds[0]).canChange, false)
  assert.deepStrictEqual(storage['gameHistory.migration-backup'], before.gameHistory)
  assert.strictEqual(storage.gameHistory[0].rounds[0].points, 1600)
  history.onShow()
  assert.strictEqual(storage.gameHistory[0].rounds[0].points, 1600)
})
console.log(`Review regressions: ${passed} passed, ${failed} failed.`)
if (failed) process.exitCode = 1
