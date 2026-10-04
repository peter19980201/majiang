const assert = require('assert')
const path = require('path')
const Records = require('../../utils/game-records')
const View = require('../../utils/round-view')
let definition, navigation, modal, returnFails = false
const storage = {}
global.Page = value => { definition = value }
global.wx = {
  getStorageSync: key => storage[key] || '',
  setStorageSync: (key, value) => { storage[key] = Records.clone(value) },
  removeStorageSync: key => { delete storage[key] },
  navigateTo: options => { navigation = options },
  navigateBack: options => { returnFails ? options.fail() : options.success() },
  showModal: options => { modal = options },
  showToast() {}
}
function page(file) {
  const location = path.resolve(__dirname, '../..', file)
  delete require.cache[location]
  require(location)
  return { ...definition, data: Records.clone(definition.data), setData(value) { Object.assign(this.data, value) } }
}
const config = { gameType: 'hanchan', startPoints: 25000, returnPoints: 30000,
  uma: '10-20', players: ['东家', '张三', '西家', '北家'] }
const board = page('pages/game/board.js')
board.onLoad({ config: encodeURIComponent(JSON.stringify(config)) })
const before = Records.snapshot(board.data)
board.setData({ selectedWinner: 1, selectedLoser: 0, inputPoints: '3900' })
board.confirmRon()
const original = Records.clone(board.data.roundHistory)
assert.strictEqual(board.data.historyCards[0].roundTitle, '東1局')
assert.strictEqual(board.data.historyCards[0].honbaLabel, '0本场')
assert(board.data.historyCards[0].latest)

function open(index = board.data.roundHistory.length - 1) {
  board.openRoundDetail({ currentTarget: { dataset: { index } } })
  assert(board.data.roundDetailVisible)
  assert.strictEqual(navigation, undefined, 'details must not navigate')
  const detail = page('pages/game/round-detail.js')
  detail._embedded = true
  detail.setData({ record: board.data.roundDetailRecord })
  detail.triggerEvent = name => name === 'editRound' ? board.editDetailRound() : board.deleteDetailRound()
  return detail
}
let detail = open()
assert.deepStrictEqual(detail.data.record.changes.map(p => p.delta), [-3900, 3900, 0, 0])
assert(detail.data.record.canChange)
detail.editRecord()
assert(board.data.showRonModal)
assert(board.data.editingLastRound)
board.setData({ inputPoints: '8000' })
board.closeRon()
assert.deepStrictEqual(board.data.roundHistory, original)

detail = open()
detail.deleteRecord()
modal.success({ confirm: false })
assert.strictEqual(board.data.roundHistory.length, 1)
assert.strictEqual(detail.data.busy, false)
detail.deleteRecord()
modal.success({ confirm: true })
assert.strictEqual(board.data.roundHistory.length, 0)
assert.deepStrictEqual(Records.snapshot(board.data), before)
assert.deepStrictEqual(storage.currentGame.gameState.players, before.players)
assert.deepStrictEqual(board.data.historyCards, [])

// Old data can be read without inventing a baseline or enabling destructive controls.
board.setData({ roundHistory: [{ round: '東1局 0本场', type: 'tsumo', winner: '张三', points: 4000,
  yakuSummary: '门前清自摸和 一气通贯' }] })
board._refreshHistoryCards()
detail = open()
assert.deepStrictEqual(detail.data.record.tags, ['一气通贯', '门前清自摸和'])
assert.strictEqual(detail.data.record.canChange, false)
detail.editRecord()
detail.deleteRecord()
assert.strictEqual(board.data.roundHistory.length, 1)
assert.strictEqual(detail.data.busy, false)

// Earlier cards are read-only, and stale callbacks cannot change a newer result.
board.setData({ roundHistory: original })
board._autoSave()
open()
const stale = { editRound: () => board.editDetailRound(), deleteRound: () => board.deleteDetailRound() }
board.setData({ selectedWinner: 2, selectedLoser: 3, inputPoints: '5200' })
board.confirmRon()
const current = Records.clone(board.data.roundHistory)
stale.editRound()
stale.deleteRound()
assert.deepStrictEqual(board.data.roundHistory, current)
assert.strictEqual(board.data.editingLastRound, false)
detail = open(0)
assert.strictEqual(detail.data.record.canChange, false)
assert.strictEqual(detail.data.record.latest, false)
assert.deepStrictEqual(detail.data.record.changes.map(p => p.delta), [-3900, 3900, 0, 0])
detail.editRecord()
detail.deleteRecord()
// Even if a stale or forged UI event reaches the board, earlier rounds stay immutable.
board.editDetailRound()
board.deleteDetailRound()
assert.deepStrictEqual(board.data.roundHistory, current)
assert.strictEqual(board.data.editingLastRound, false)
navigation = undefined
board.openRoundDetail({ currentTarget: { dataset: { index: -1 } } })
assert.strictEqual(navigation, undefined)
assert.deepStrictEqual(board.data.historyCards.map(r => r.latest), [false, true])
assert.strictEqual(View.describe({ type: 'draw', tenpai: '全员不听' }).name, '流局')
console.log('Round detail passed: drawer, edit/cancel, delete/cancel, score restore, legacy and stale-record guards.')

// Stable descending order for legacy names and actual recorded open-hand/dora han.
assert.deepStrictEqual(View.describe({ yakuSummary: '平和 一杯口 一气通贯 清一色' }).tags,
  ['清一色', '一气通贯', '平和', '一杯口'])
const ranked = { yaku: [{ name: '三色同顺', han: 1 }, { name: '三暗刻', han: 2 },
  { name: '宝牌', han: 4 }, { name: '断幺九', han: 1 }] }
assert.deepStrictEqual(View.describe(ranked).tags, ['宝牌', '三暗刻', '三色同顺', '断幺九'])
assert.strictEqual(ranked.yaku[0].name, '三色同顺', 'display sorting must not mutate storage')
assert.deepStrictEqual(View.describe({ yaku: [{ name: '天和', han: -1, isYakuman: true, yakumanTimes: 1 },
  { name: '四暗刻单骑', han: -1, isYakuman: true, yakumanTimes: 2 }] }).tags, ['四暗刻单骑', '天和'])
assert.deepStrictEqual(View.describe({ yakuSummary: '三色同顺 三暗刻',
  input: { calculatorInput: { melds: [{ type: 'chi' }] } } }).tags, ['三暗刻', '三色同顺'])
console.log('All rounds are viewable; only latest is editable; yaku sort by actual han with legacy fallback.')

assert.deepStrictEqual(board.data.recordTimeline.map(r => r.recordIndex), [1, 0])
assert.strictEqual(board.data.recordTimeline[0].name, current[1].winner)
board.setData({ recordsExpanded: false })
board.toggleRecords()
assert.strictEqual(board.data.recordsScrollTarget, 'record-list-top')
board.toggleRecords()
assert.strictEqual(board.data.recordsScrollTarget, '')
board.toggleRecords()
assert.strictEqual(board.data.recordsScrollTarget, 'record-list-top')
board.openRoundDetail({ currentTarget: { dataset: { index: board.data.recordTimeline[0].recordIndex } } })
assert.strictEqual(board.data.roundDetailRecord.name, current[1].winner)
console.log('Timeline passed: newest-first display, original detail indices and reset-to-top on every opening.')
