const assert = require('assert')
const path = require('path')
const Records = require('../utils/game-records')
const { calculatePayment } = require('../utils/score')
let definition
let storage = {}
let confirm = true
let navigation
let toast
global.Page = value => { definition = value }
global.wx = {
  showShareMenu() {},
  getStorageSync(key) { return storage[key] ? Records.clone(storage[key]) : '' },
  setStorageSync(key, value) { storage[key] = Records.clone(value) },
  removeStorageSync(key) { delete storage[key] },
  showModal(options) { options.success({ confirm }) },
  showToast(options) { toast = options.title },
  navigateTo(options) { navigation = options },
  navigateBack() {},
  setNavigationBarTitle() {}
}
function page(file) {
  const filePath = path.resolve(__dirname, '..', file)
  delete require.cache[filePath]
  require(filePath)
  const instance = { ...definition, data: Records.clone(definition.data),
    setData(values) { Object.assign(this.data, values) } }
  // Native Page instances bind callbacks to the live page, even when inherited.
  Object.keys(definition).forEach(key => {
    if (typeof definition[key] === 'function') instance[key] = definition[key].bind(instance)
  })
  if (instance._openInputOverlay) instance._openInputOverlay = options => { navigation = options }
  return instance
}
const config = { gameType: 'hanchan', startPoints: 25000, returnPoints: 30000,
  uma: '10-20', players: ['同名', '同名', '西家', '北家'] }
function board() {
  const game = page('pages/game/board.js')
  game.onLoad({ config: encodeURIComponent(JSON.stringify(config)) })
  return game
}
function state(game) { return Records.snapshot(game.data) }
function ron(game, winner = 1, loser = 0, points = '3900') {
  game.setData({ selectedWinner: winner, selectedLoser: loser, inputPoints: points,
    roundRiichi: [true, true, false, false] })
  game.confirmRon()
}

// Every recording path can be undone, including honba, riichi, duplicate names and rotations.
for (const type of ['ron', 'tsumo', 'draw', 'calcRon', 'calcTsumo']) {
  storage = {}
  const game = board()
  game.setData({ honba: 2, riichiSticks: 3,
    players: game.data.players.map((p, i) => ({ ...p, points: p.points - (i === 0 ? 3000 : 0) })) })
  const before = state(game)
  game.setData({ selectedWinner: 1, selectedLoser: 0, inputPoints: '3900',
    inputKoPayment: '700', inputOyaPayment: '1300',
    drawTenpai: [false, true, false, false], roundRiichi: [true, true, false, false] })
  if (type === 'ron') game.confirmRon()
  if (type === 'tsumo') game.confirmTsumo()
  if (type === 'draw') game.confirmDraw()
  if (type === 'calcRon') game._processCalcRon({ payment: calculatePayment(640, false, false, 2) })
  if (type === 'calcTsumo') game._processCalcTsumo({ payment: calculatePayment(640, false, true, 2) })
  const record = game.data.roundHistory[0]
  assert.deepStrictEqual(record.before, before)
  assert(record.input && record.after && record.id)
  const persisted = wx.getStorageSync('currentGame').gameState.roundHistory[0]
  assert.deepStrictEqual(persisted.before, before)
  assert.deepStrictEqual(persisted.input, record.input)
  assert.deepStrictEqual(persisted.after, record.after)
  const reloaded = page('pages/game/board.js')
  reloaded.onLoad({ resume: '1' })
  assert.strictEqual(reloaded.data.historyCards[0].canChange, true)
  assert.deepStrictEqual(reloaded.data.roundHistory[0], Records.clone(record))
  assert.strictEqual(game.data.players.reduce((sum, p) => sum + p.points, 0) + game.data.riichiSticks * 1000, 100000)
  const after = state(game)
  confirm = false
  game.undoLastRound()
  assert.deepStrictEqual(state(game), after)
  confirm = true
  game.undoLastRound()
  assert.deepStrictEqual(state(game), before)
  assert.strictEqual(game.data.roundHistory.length, 0)
  const resumed = page('pages/game/board.js')
  resumed.onLoad({ resume: '1' })
  assert.deepStrictEqual(state(resumed), before)
}

storage = {}
const editing = board()
ron(editing)
const originalState = state(editing)
const originalRecords = Records.clone(editing.data.roundHistory)
const originalStorage = Records.clone(storage)
editing.editLastRound()
assert.strictEqual(editing.data.inputPoints, '3900')
assert.strictEqual(editing.data.showManualInput, true)
assert.strictEqual(editing.data.entryDealerIdx, 0)
assert.deepStrictEqual(state(editing), originalState)
editing.setData({ inputPoints: '8000', selectedWinner: 0 })
editing.closeRon()
assert.deepStrictEqual(state(editing), originalState)
assert.deepStrictEqual(editing.data.roundHistory, originalRecords)
assert.deepStrictEqual(storage, originalStorage)

// Replacement calculates from the original baseline rather than applying another transfer.
editing.editLastRound()
editing.setData({ inputPoints: '8000' })
editing.confirmRon()
assert.strictEqual(editing.data.roundHistory.length, 1)
assert.strictEqual(editing.data.roundHistory[0].id, originalRecords[0].id)
assert.deepStrictEqual(editing.data.players.map(p => p.points), [16000, 34000, 25000, 25000])
assert.deepStrictEqual(editing.data.roundHistory[0].before, originalRecords[0].before)

// Invalid correction leaves persisted data untouched; changing result type recalculates rotation.
editing.editLastRound()
editing.setData({ inputPoints: '' })
const validState = state(editing)
const validStorage = Records.clone(storage)
editing.confirmRon()
assert.deepStrictEqual(state(editing), validState)
assert.deepStrictEqual(storage, validStorage)
assert(editing.data.editingLastRound)
editing.changeEditType({ currentTarget: { dataset: { type: 'draw' } } })
editing.setData({ drawTenpai: [true, false, false, false] })
editing.updateDrawPreview()
const deltas = editing.data.drawPreview.map(p => p.delta)
editing.confirmDraw()
assert.strictEqual(editing.data.roundHistory.length, 1)
assert.strictEqual(editing.data.roundHistory[0].type, 'draw')
assert.deepStrictEqual(editing.data.players.map(p => p.points - 25000), deltas)
assert.strictEqual(editing.data.dealerIdx, 0)
assert.strictEqual(editing.data.honba, 1)
assert.strictEqual(editing.data.riichiSticks, 2)

// A previous record stays unchanged when the latest one is replaced or undone.
ron(editing, 2, 3)
const earlier = Records.clone(editing.data.roundHistory[0])
editing.editLastRound()
editing.setData({ inputPoints: '5200' })
editing.confirmRon()
assert.deepStrictEqual(editing.data.roundHistory[0], earlier)
editing.undoLastRound()
assert.strictEqual(editing.data.roundHistory.length, 1)
assert.deepStrictEqual(state(editing), earlier.after)

// End-of-game correction replaces the same archive. Undo reopens the game after restart.
storage = {}
const ended = board()
ended.setData({ roundWind: 1, roundWindName: '南', roundNum: 4, dealerIdx: 3 })
ron(ended, 0, 1)
assert(!ended.data.gameOver)
ended.earlySettlement()
assert(ended.data.gameOver)
assert.strictEqual(storage.gameHistory.length, 1)
assert.strictEqual(storage.currentGame, undefined)
const id = ended.data.gameId
const restored = page('pages/game/board.js')
restored.onLoad({ historyId: id })
assert(restored.data.gameOver)
restored.editLastRound()
restored.setData({ inputPoints: '8000' })
restored.confirmRon()
assert.strictEqual(storage.gameHistory.length, 1)
assert.strictEqual(storage.gameHistory[0].id, id)
assert.deepStrictEqual(storage.gameHistory[0].result, restored.data.finalResult)
restored.undoLastRound()
assert.strictEqual(storage.gameHistory.length, 0)
assert.strictEqual(storage.currentGame.gameState.gameId, id)
assert.strictEqual(restored.data.gameOver, false)
assert.strictEqual(restored.data.roundNum, 4)
assert.strictEqual(restored.data.roundWind, 1)
assert.strictEqual(restored.data.dealerIdx, 3)
assert.deepStrictEqual(restored.data.players.map(p => p.points), [25000, 25000, 25000, 25000])

// Correcting a terminal result to dealer win resumes instead of retaining a stale settlement.
ron(restored, 0, 1)
restored.editLastRound()
restored.setData({ selectedWinner: 3, selectedLoser: 1 })
restored.confirmRon()
assert.strictEqual(restored.data.gameOver, false)
assert.strictEqual(restored.data.honba, 1)
assert.strictEqual(storage.gameHistory.length, 0)
assert(storage.currentGame)

// Explicitly ended games stay ended on edit, but can be reopened by undo.
storage = {}
const early = board()
ron(early)
early.earlySettlement()
early.editLastRound()
early.setData({ inputPoints: '5200' })
early.confirmRon()
assert(early.data.gameOver)
assert.strictEqual(storage.gameHistory.length, 1)
early.editLastRound()
early.setData({ inputPoints: '8000' })
early.confirmRon()
assert(early.data.gameOver, 'repeated correction must preserve explicit early ending')
assert.strictEqual(storage.gameHistory.length, 1)
early.undoLastRound()
assert.strictEqual(early.data.gameOver, false)

// Re-entering the calculator restores the full hand; backing out preserves the original result.
storage = {}
const handGame = board()
handGame.setData({ selectedWinner: 1, selectedLoser: 0 })
const handInput = {
  hand: [0,1,2,3,4,5,10,11,12,19,20,22,22], melds: [], agariTile: 21,
  riichi: true, doubleRiichi: false, ippatsu: false, haitei: false, rinshan: false,
  chankan: false, tenhou: false, chihou: false, dora: [], uraDora: [],
  redM5: false, redP5: false, redS5: false
}
handGame._processCalcRon({ payment: calculatePayment(640, false, false, 0), calculatorInput: handInput })
assert.strictEqual(handGame.data.roundHistory[0].input.roundRiichi[1], true)
handGame.editLastRound()
handGame.goToCalcRon()
assert(navigation.url.includes('honba=0'))
assert(navigation.url.includes('riichi=1'))
assert(navigation.url.includes('jikaze=28'))
const calculator = page('pages/calculator/calculator.js')
let restoreListener
calculator.getOpenerEventChannel = () => ({ on(name, listener) {
  assert.strictEqual(name, 'restoreInput')
  restoreListener = listener
} })
calculator.onLoad({ mode: 'board', agariType: 'ron', bakaze: '27', jikaze: '28', honba: '0', riichi: '1' })
navigation.success({ eventChannel: { emit(name, input) { restoreListener(input) } } })
assert.deepStrictEqual(calculator.data.hand, handInput.hand)
assert.deepStrictEqual(calculator.data.melds, [])
assert.strictEqual(calculator.data.agariTile, 21)
assert.strictEqual(calculator.data.handCount, 13)
calculator.doCalculate()
assert(calculator.data.boardResult.calculatorInput)
assert.strictEqual(calculator.data.boardResult.calculatorInput.riichi, true)
handGame.onShow()
assert(handGame.data.showRonModal)
assert(handGame.data.editingLastRound)
handGame.closeRon()
assert.strictEqual(handGame.data.roundHistory.length, 1)

// Old records can be viewed, but missing snapshots never fabricate a correction.
const legacy = board()
legacy.setData({ roundHistory: [{ type: 'ron', winner: '同名', points: 3900 }] })
const legacyBefore = state(legacy)
legacy.editLastRound()
legacy.undoLastRound()
assert.deepStrictEqual(state(legacy), legacyBefore)
assert.strictEqual(legacy.data.editingLastRound, false)

// A different active game cannot be overwritten while correcting an archive.
storage.gameHistory = [{ id: 'archive', date: '2026-09-30', gameState: handGame.data }]
toast = ''
const blocked = page('pages/game/board.js')
blocked.onLoad({ historyId: 'archive' })
assert.strictEqual(toast, '请先结束当前对局再修改历史')
assert.notStrictEqual(storage.currentGame.gameState.gameId, 'archive')

// Numeric legacy IDs and string IDs both remain expandable and deletable.
storage.gameHistory = [{ id: 123, rounds: [] }, { id: 'game-string', rounds: [] }]
const historyPage = page('pages/game/history.js')
historyPage.onShow()
historyPage.onExpandTap({ currentTarget: { dataset: { id: '123' } } })
assert.strictEqual(historyPage.data.expandedId, 123)
historyPage.onExpandTap({ currentTarget: { dataset: { id: 'game-string' } } })
assert.strictEqual(historyPage.data.expandedId, 'game-string')
historyPage.deleteRecord({ currentTarget: { dataset: { id: '123' } } })
assert.deepStrictEqual(storage.gameHistory.map(h => h.id), ['game-string'])

// Ending from either the home screen or history retains correction data and identity.
for (const location of ['home', 'history']) {
  storage = {}
  const game = board()
  ron(game)
  const gameId = game.data.gameId
  if (location === 'home') {
    page('pages/index/index.js')._settleAndSave(wx.getStorageSync('currentGame'))
  } else {
    const list = page('pages/game/history.js')
    list.onShow()
    list.abandonGame()
  }
  assert.strictEqual(storage.gameHistory[0].id, gameId)
  assert.strictEqual(storage.gameHistory[0].gameState.endReason, '手动结束')
  const archived = page('pages/game/board.js')
  archived.onLoad({ historyId: gameId })
  archived.editLastRound()
  archived.setData({ inputPoints: '8000' })
  archived.confirmRon()
  assert(archived.data.gameOver)
  assert.strictEqual(storage.gameHistory.length, 1)
  assert.strictEqual(storage.gameHistory[0].id, gameId)
}
console.log('Round corrections passed: five result paths, cancel/replace/type switch, resume, settlement rollback, hand restore and legacy protection.')
