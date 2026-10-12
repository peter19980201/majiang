require('../harness/confirmation-mock')
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
const pendingDelete = modal
detail.deleteRecord()
assert.strictEqual(modal, pendingDelete, 'repeated taps must not queue another native confirmation')
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

// A failed native modal can be retried; an old confirmation cannot delete a new detail.
detail = open()
detail.deleteRecord()
modal.complete()
const failedModal = modal
detail.deleteRecord()
assert.notStrictEqual(modal, failedModal)
const confirmedOldModal = modal
detail.setData({ record: { ...detail.data.record, round: '另一局' } })
confirmedOldModal.success({ confirm: true })
assert.strictEqual(detail.data.busy, false)
assert.deepStrictEqual(board.data.roundHistory, current)

// Page decorations must never enter the isolated drawer's normal flow, even
// on its first render before attached runs. Standalone details retain them.
const fs = require('fs')
let componentDefinition
global.Component = value => { componentDefinition = value }
require('../../components/round-detail/index')
assert.strictEqual(componentDefinition.data.embedded, true)
const standalone = page('pages/game/round-detail.js')
assert.strictEqual(standalone.data.embedded, false)
const detailMarkup = fs.readFileSync(path.resolve(__dirname, '../../pages/game/round-detail.wxml'), 'utf8')
for (const className of ['page-landscape', 'page-motto-art']) {
  const imageTag = detailMarkup.match(new RegExp('<image[^>]*class="' + className + '"[^>]*>'))
  assert(imageTag, className + ' remains available to standalone pages')
  assert(imageTag[0].includes('wx:if="{{!embedded}}"'), className + ' must not occupy drawer space')
}
assert(detailMarkup.includes('class="detail-page" wx:if="{{record}}"'), 'detail content remains available in both hosts')
// Embedded details keep the same artwork in a host-owned, non-scrolling layer.
const boardMarkup = fs.readFileSync(path.resolve(__dirname, '../../pages/game/board.wxml'), 'utf8')
const boardStyles = fs.readFileSync(path.resolve(__dirname, '../../pages/game/board.wxss'), 'utf8')
const sheetStart = boardMarkup.indexOf('class="win-sheet detail-sheet"')
const scrollStart = boardMarkup.indexOf('<scroll-view', sheetStart)
const drawerBackdrop = boardMarkup.slice(sheetStart, scrollStart)
for (const [name, asset, mode] of [
  ['detail-landscape', 'profile-landscape.jpg', 'aspectFill'],
  ['detail-motto-art', 'profile-motto.png', 'aspectFit']
]) {
  assert(drawerBackdrop.includes(`class="${name}" src="/assets/home/${asset}" mode="${mode}"`), 'drawer must display ' + asset + ' outside its scrolling content')
  const rules = boardStyles.match(new RegExp('\\.' + name + ' \\{([^}]+)\\}'))[1]
  assert(rules.includes('position:absolute'))
  assert(rules.includes('pointer-events:none'))
  assert(rules.includes('z-index:0'))
}
assert(boardStyles.includes('.detail-motto-art { position:absolute; top:112rpx;'), 'calligraphy clears the header close button')
assert(boardStyles.includes('.detail-overlay .detail-sheet { position:relative;'), 'artwork is anchored to drawer bounds')
assert(boardStyles.includes('.detail-sheet .win-grip,.detail-sheet .win-heading,.detail-sheet .win-scroll { position:relative; z-index:1; }'), 'content and controls stay above artwork')
console.log('Detail backdrop: page and drawer retain artwork; drawer images stay outside scrolling flow and below controls.')
