const assert = require('assert')
const path = require('path')
const Records = require('../utils/game-records')
const View = require('../utils/round-view')
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
  const location = path.resolve(__dirname, '..', file)
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

function open() {
  board.openRoundDetail({ currentTarget: { dataset: { index: board.data.roundHistory.length - 1 } } })
  assert.strictEqual(navigation.url, '/pages/game/round-detail')
  const detail = page('pages/game/round-detail.js')
  let listener
  detail.getOpenerEventChannel = () => ({
    on: (name, callback) => { assert.strictEqual(name, 'roundDetail'); listener = callback },
    emit: name => navigation.events[name]()
  })
  detail.onLoad()
  navigation.success({ eventChannel: { emit: (name, record) => listener(record) } })
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
returnFails = true
detail.editRecord()
assert.strictEqual(detail.data.busy, false)
assert.strictEqual(board.data.editingLastRound, false)
returnFails = false
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
assert.deepStrictEqual(detail.data.record.tags, ['门前清自摸和', '一气通贯'])
assert.strictEqual(detail.data.record.canChange, false)
detail.editRecord()
detail.deleteRecord()
assert.strictEqual(board.data.roundHistory.length, 1)
assert.strictEqual(detail.data.busy, false)

// Earlier cards do not navigate, and stale detail callbacks cannot change a newer result.
board.setData({ roundHistory: original })
board._autoSave()
open()
const stale = navigation.events
board.setData({ selectedWinner: 2, selectedLoser: 3, inputPoints: '5200' })
board.confirmRon()
const current = Records.clone(board.data.roundHistory)
stale.editRound()
stale.deleteRound()
assert.deepStrictEqual(board.data.roundHistory, current)
assert.strictEqual(board.data.editingLastRound, false)
navigation = null
board.openRoundDetail({ currentTarget: { dataset: { index: 0 } } })
assert.strictEqual(navigation, null)
assert.deepStrictEqual(board.data.historyCards.map(r => r.latest), [false, true])
assert.strictEqual(View.describe({ type: 'draw', tenpai: '全员不听' }).name, '流局')
console.log('Round detail passed: navigation, edit/cancel, delete/cancel, failed return, score restore, legacy and stale-record guards.')
