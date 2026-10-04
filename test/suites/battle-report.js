const assert = require('assert')
const Reports = require('../../utils/battle-report')
const Painter = require('../../utils/battle-report-canvas')
// Font-aware measurements verify shrink-before-wrap and the two-line limit.
const measureContext = { font: '', measureText(value) {
  const size = Number(this.font.match(/(\d+)px/)[1])
  return { width: Array.from(value).reduce((width, ch) => width + (/[^\x00-\xff]/.test(ch) ? size : size * .5), 0) }
} }
assert.deepStrictEqual(Painter.fitName(measureContext, '东家', 146), { size: 32, lines: ['东家'] })
const mediumName = Painter.fitName(measureContext, '测试 · 青岚', 146)
assert(mediumName.size < 32 && mediumName.size >= 20)
assert.strictEqual(mediumName.lines.length, 1)
const longName = Painter.fitName(measureContext, '一二三四五六七八九十天地玄黄宇宙洪荒', 146)
assert.strictEqual(longName.size, 20)
assert.deepStrictEqual(longName.lines, ['一二三四五六七', '八九十天地玄黄'])
for (const value of longName.lines) assert(measureContext.measureText(value).width <= 146)
const record = { id: 'only-this-game', date: '2026/10/2', abandoned: true,
  config: { gameType: 'hanchan', startPoints: 25000, returnPoints: 30000, uma: '10-20' },
  result: [
    { rank: 1, name: '十二个汉字昵称用于换行检查', points: 33000, uma: 20, finalPt: 23 },
    { rank: 2, name: '南家', points: 30200, uma: 10, finalPt: 10.2 },
    { rank: 3, name: '北家', points: 25000, uma: -10, finalPt: -15 },
    { rank: 4, name: '西家', points: 11800, uma: -20, finalPt: -38.2 } ],
  rounds: [ { type: 'ron', round: '東1局 0本场', loser: '西家', winners: [
    { name: '南家', payment: 12000, level: '跳满', yaku: [{ name: '清一色', han: 6 }] },
    { name: '東家', payment: 32000, level: '役满', yaku: [{ name: '大三元', han: -1 }] }] },
    { type: 'draw', round: '東2局', tenpai: '南家' } ] }
const original = JSON.stringify(record)
const report = Reports.build(record)
assert.deepStrictEqual(report.rounds.map(r => r.round), record.rounds.map(r => r.round))
assert.strictEqual(report.rows[1].seatTile, 28)
assert.strictEqual(report.rounds[0].winners[0].seatTile, 28)
assert.strictEqual(report.rounds[0].winners[0].pointsText, '12,000')
assert.deepStrictEqual(report.rounds[0].winners[1].tags, ['大三元'])
assert.strictEqual(report.rounds[0].winners[1].hanFuText, '役满')
assert.strictEqual(report.rounds[1].isDraw, true)
assert.strictEqual(report.rounds[1].drawDescription, '南家')
assert.strictEqual(report.status, '提前结束')
assert.strictEqual(report.rows[0].finalText, '+23.0') // use saved score; no oka inferred from mockup
assert.strictEqual(report.rows[3].finalText, '-38.2')
assert.strictEqual(report.highlights[0].level, '役满')
assert.strictEqual(report.highlights.length, 2)
const text = Reports.text(report)
assert(text.includes('本场大牌')); assert(!text.includes('四人一桌'))
assert(text.includes('南家 荣和 12000点；東家 荣和 32000点'))
assert.deepStrictEqual(report.rounds[0].yakuEntries, [
  { name: '南家', tags: ['清一色'] }, { name: '東家', tags: ['大三元'] }
])
assert.deepStrictEqual(report.rounds[1].yakuEntries, [])
assert(text.includes('南家 · 役种：清一色\n東家 · 役种：大三元'))
const yakuReport = Reports.build({ ...record, rounds: [
  { type: 'tsumo', winner: '東家', yaku: [{ name: '立直', han: 1 }, { name: '清一色', han: 6 }] },
  { type: 'ron', winner: '南家', yakuSummary: '立直 一发' },
  { type: 'ron', winner: '西家', han: 3, fu: 40, input: { source: 'hanfu' } },
  { type: 'tsumo', winner: '北家', input: { source: 'manual' } }
] })
assert.deepStrictEqual(yakuReport.rounds.map(r => r.yakuEntries), [
  [{ name: '', tags: ['清一色', '立直'] }], [{ name: '', tags: ['立直', '一发'] }],
  [{ name: '', tags: [] }], [{ name: '', tags: [] }]
])
assert.strictEqual(yakuReport.rounds[2].winners[0].hanFuText, '3番40符')
assert.strictEqual(yakuReport.rounds[3].winners[0].hanFuText, '')
assert.strictEqual(Reports.text(yakuReport).split('役种：未记录役种').length - 1, 2)
assert.strictEqual(JSON.stringify(record), original)
assert.strictEqual(Reports.build({ ...record, config: { ...record.config, gameType: 'tonpuu' }, rounds: [] }).title, '东风战报')
assert(Reports.text(Reports.build({ ...record, rounds: [] })).includes('暂无已记录'))
const painted = []
const ctx = new Proxy({ measureText: s => ({ width: Array.from(s).reduce((n, c) => n + (c.charCodeAt(0) > 255 ? 24 : 14), 0) }), createLinearGradient: () => ({ addColorStop() {} }), fillText: s => painted.push(String(s)) }, {
  get: (t, k) => k in t ? t[k] : () => {}, set: (t, k, v) => { t[k] = v; return true } })
Painter.draw(ctx, report)
for (const row of report.rows) { assert(painted.includes(row.pointsText)); assert(painted.includes(row.finalText)) }
assert(painted.includes('32,000 点')); assert(painted.includes('荣和')); assert(painted.includes('大三元')); assert(painted.includes('東1局 · 0本场'));
assert(painted.includes('本场大牌')); assert(!painted.some(t => t.includes('四人一桌')))
// Page reads the selected stored record; failed generation/save retain the record.
let definition, exportOptions, saveOptions, modal, settings = 0
const canvas = { getContext: () => ctx, createImage: () => { const img = {}; Object.defineProperty(img, 'src', { set() { img.onerror() } }); return img } }
global.Page = d => { definition = d }
const storage = { gameHistory: [record] }
global.wx = {
  getStorageSync: key => storage[key] || '', setStorageSync: (key, value) => { storage[key] = value }, showShareMenu() {},
  createSelectorQuery() { return { in() { return this }, select() { return this }, fields() { return this }, exec(cb) { cb([{ node: canvas }]) } } },
  canvasToTempFilePath: options => { exportOptions = options; options.success({ tempFilePath: '/tmp/report.png' }) },
  saveImageToPhotosAlbum: options => { saveOptions = options }, showModal: options => { modal = options },
  showToast() {}, navigateTo() {}, openSetting: () => settings++
}
require('../../pages/battle-report/battle-report')
const page = { ...definition, data: { ...definition.data }, setData(patch) { Object.assign(this.data, patch) } }
page.onLoad({ id: record.id }); page.onReady()
assert.strictEqual(exportOptions.canvas, canvas)
assert.strictEqual(page.data.imagePath, '/tmp/report.png')
page.save(); assert.strictEqual(saveOptions.filePath, page.data.imagePath)
saveOptions.fail({ errMsg: 'auth deny' }); saveOptions.complete()
assert.strictEqual(page.data.saving, false); assert.strictEqual(page.data.imagePath, '/tmp/report.png')
modal.success({ confirm: false }); assert.strictEqual(settings, 0)
page.onLoad({ id: 'missing' }); page.generate(); assert(page.data.error)
// Reopening a completed settlement must use its saved final scores, without saving again.
require('../../pages/game/board')
const board = { ...definition, data: { ...definition.data, gameId: record.id, gameDate: record.date,
  config: record.config, finalResult: record.result, roundHistory: record.rounds, endedEarly: true },
  setData(patch) { Object.assign(this.data, patch) } }
let opened = []
wx.navigateTo = options => opened.push(options.url)
board.doSettlement()
assert.strictEqual(opened.length, 1)
assert(opened[0].startsWith('/pages/settlement/settlement?id='))
board.onShow(); assert.strictEqual(opened.length, 1)
// The full-page settlement reads saved data without needing to reopen/correct a game.
require('../../pages/settlement/settlement')
const settlement = { ...definition, data: { ...definition.data }, setData(patch) { Object.assign(this.data, patch) } }
settlement.onLoad({ id: record.id }); settlement.onShow()
assert.strictEqual(settlement.data.report.rows[0].finalText, '+23.0')
assert.strictEqual(settlement.data.report.date, '2026.10.02')
assert.strictEqual(settlement.data.report.status, '提前结束')
let copied
wx.setClipboardData = options => { copied = options.data }
settlement.copy()
assert(copied.includes('得点 +23.0'))
settlement.preview(); assert(opened[1].includes('/pages/battle-report/battle-report?id='))
console.log('Battle report passed: saved scores, multi-ron highlights, text/canvas agreement, long names, missing records, image export and denied permissions.')
