const assert = require('node:assert/strict')
const fs = require('node:fs')
const clone = value => JSON.parse(JSON.stringify(value))
let definition, modal, calls = 0, toast, failWrite = false
const data = { currentGame:clone(require('../fixtures/pre-stage-one.json').unfinished) }
global.Page = value => { definition = value }
global.wx = {
  showShareMenu() {},
  getStorageSync: key => data[key] ? clone(data[key]) : '',
  setStorageSync(key, value) { if (failWrite) throw new Error('disk full'); data[key] = clone(value) },
  removeStorageSync(key) { delete data[key] },
  showModal(value) { modal = value; calls++ },
  showToast(value) { toast = value.title }
}
require('../../pages/index/index')
const home = { ...definition, data:clone(definition.data), setData(value) { Object.assign(this.data, value) } }
home.onShow()
const before = clone(data)
home.endGame(); home.endGame()
assert.equal(calls, 1, 'double tap opens only one confirmation')
assert.equal(modal.title, '提前结束对局')
assert.equal(modal.confirmText, '确认结束')
assert.deepEqual(data, before, 'opening confirmation must not end the game')
modal.success({ confirm:false }); modal.complete()
assert.deepEqual(data, before, 'cancel preserves current game and history')
assert(home.data.currentGame)
home.endGame(); modal.complete() // platform failure/cancel must release the lock
assert.equal(home._ending, false)
home.endGame()
data.currentGame.gameState.gameId = 'another-game'
const replacement = clone(data.currentGame)
modal.success({ confirm:true }); modal.complete()
assert.deepEqual(data.currentGame, replacement, 'late confirmation must never end a replacement game')
assert.equal(toast, '对局已变化，请重新确认')
data.currentGame = clone(before.currentGame)
home.onShow(); home.endGame(); failWrite = true
modal.success({ confirm:true }); modal.complete(); failWrite = false
assert.deepEqual(data.currentGame, before.currentGame, 'failed history save preserves resumable game')
assert.equal(toast, '结束失败，请重试')
home.endGame(); modal.success({ confirm:true }); modal.complete()
assert.equal(data.currentGame, undefined)
assert.equal(home.data.currentGame, null)
assert.equal(data.gameHistory.length, 1)
assert.equal(data.gameHistory[0].gameState.gameOver, true)
assert.equal(data.gameHistory[0].gameState.endReason, '手动结束')
assert.deepEqual(data.gameHistory[0].result.map(row => row.points), [25000,25000,25000,25000])
assert.equal(toast, '已结算并保存到战绩')
home.endGame()
assert.equal(data.gameHistory.length, 1, 'empty-state repeat must not create duplicate history')
const markup = fs.readFileSync(require('node:path').resolve(__dirname, '../../pages/index/index.wxml'), 'utf8')
assert(markup.includes('bindtap="resumeGame">继续对局</button>'))
assert(markup.includes('bindtap="endGame">提前结束</button>'))
console.log('Home end-game: confirmation, cancel, duplicate taps, stale game, storage failure and saved settlement passed.')
