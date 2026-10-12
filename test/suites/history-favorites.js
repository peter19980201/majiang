require('../harness/confirmation-mock')
// Synthetic records and fixed expectations; never accesses real WeChat storage.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const Storage = require('../../utils/game-storage')
const clone = value => JSON.parse(JSON.stringify(value))
let data = { gameHistory: [
  { id: 12, date:'2026-10-12', config:{}, result:[], rounds:[] },
  { id:'older', date:'2026-10-11', config:{}, result:[], rounds:[], favorite:true }
] }, failure = false, modal, toast, definition
let writes = 0
global.wx = {
  getStorageSync:key => data[key] === undefined ? '' : clone(data[key]),
  setStorageSync(key, value) { if (failure) throw Error('disk full'); data[key] = clone(value); writes++ },
  removeStorageSync(key) { delete data[key] },
  showToast(value) { toast = value }, showModal(value) { modal = value }, showShareMenu() {}
}
global.Page = value => { definition = value }
require('../../pages/game/history')
const page = () => ({ ...definition, data:clone(definition.data), setData(value) { Object.assign(this.data, value) } })
const event = (id, filter) => ({ currentTarget:{ dataset:{ id, filter } } })
const p = page(); p.onShow()
assert.equal(p.data.totalCount, 2)
assert.equal(p.data.favoriteCount, 1)
assert.equal(p.data.historyList[0].favorite, false, 'old records default to unstarred')
const before = clone(Storage.history()[0])
p.toggleFavorite(event(12))
assert.deepEqual(Storage.history()[0], { ...before, favorite:true }, 'only favorite metadata changes')
assert.deepEqual(p.data.historyList.map(r => r.id), ['12', 'older'], 'starring preserves list order')
assert.equal(p.data.favoriteCount, 2)
assert.equal(p.data.settlementVisible, false, 'starring does not open details')
const reopened = page(); reopened.onShow(); assert.equal(reopened.data.historyList[0].favorite, true)
p.changeFilter(event(null, 'favorites'))
p.toggleFavorite(event(12))
assert.deepEqual(p.data.historyList.map(r => r.id), ['older'])
assert.equal(p.data.totalCount, 2, 'unfavorite never deletes the record')
p.onShow(); assert.equal(p.data.historyFilter, 'favorites', 'returning keeps chosen filter')
p.changeFilter(event(null, 'bad')); assert.equal(p.data.historyFilter, 'favorites')
const stable = structuredClone(p.data)
failure = true; p.toggleFavorite(event('older')); failure = false
assert.deepEqual(p.data, stable, 'failed persistence leaves UI unchanged')
assert.equal(Storage.history()[1].favorite, true)
assert.match(toast.title, /失败/)
const priorWrites = writes
assert.equal(Storage.toggleFavorite('missing'), null)
assert.equal(writes, priorWrites, 'stale ID cannot create a record')
p.deleteRecord(event('older')); assert.match(modal.content, /已收藏/)
modal.success({ confirm:false }); assert.equal(Storage.history().length, 2)
p.deleteRecord(event('older')); modal.success({ confirm:true })
assert.equal(p.data.favoriteCount, 0); assert.deepEqual(p.data.historyList, [])
p.changeFilter(event(null, 'all')); assert.deepEqual(p.data.historyList.map(r => r.id), ['12'])
// Re-completing a corrected game retains its favorite and does not duplicate it.
const fixture = clone(require('../fixtures/pre-stage-one.json').manual)
fixture.gameState.gameId = '12'
fixture.gameState.finalResult = []
Storage.toggleFavorite(12)
Storage.saveCompleted(fixture.gameState)
assert.equal(Storage.history().length, 1)
assert.equal(Storage.history()[0].favorite, true)
// History never reads/displays or modifies the ongoing game, in either filter.
data.currentGame = fixture
Storage.toggleFavorite(12)
const readCurrent = Storage.current
Storage.current = () => { throw Error('history must not read ongoing game') }
p.onShow(); p.changeFilter(event(null, 'favorites'))
assert.equal(p.data.currentGame, undefined); assert.deepEqual(p.data.historyList, [])
const current = clone(data.currentGame)
p.changeFilter(event(null, 'all')); p.toggleFavorite(event(12))
assert.deepEqual(data.currentGame, current, 'favorites never touch ongoing game')

data.gameHistory = []
p.onShow()
assert.equal(p.data.totalCount, 0)
assert.deepEqual(p.data.historyList, [])
assert.deepEqual(data.currentGame, current, 'empty history preserves ongoing game')
Storage.current = readCurrent

const markup = fs.readFileSync(require.resolve('../../pages/game/history.wxml'),'utf8')
assert(markup.includes('catchtap="toggleFavorite"'), 'star tap must not bubble into card detail')
assert(markup.includes('catchtap="deleteRecord"'), 'delete tap must not bubble into card detail')
assert(markup.includes('还没有收藏的对局'))
assert(!/currentGame|resumeGame|abandonGame|current-game/.test(markup))
assert(markup.includes('wx:if="{{historyList.length === 0}}"'), 'empty state is independent of ongoing game')
const css = fs.readFileSync(require.resolve('../../pages/game/history.wxss'),'utf8')
assert.match(css, /\.history-row \.card \{ border:3rpx solid #9aaa98; \}/)
assert.match(css, /\.history-row \.card.is-favorite \{ border-color:#bd9650; \}/, 'favorite changes border color without changing dimensions')
for (const icon of ['outline','filled']) assert(fs.existsSync(require.resolve(`../../assets/icons/star-${icon}.svg`)))
console.log('History favorites: persistence, legacy defaults, filters/counts, deletion, failure, corrected game retention and action isolation passed.')
