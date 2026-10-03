const assert = require('assert')
const clone = x => JSON.parse(JSON.stringify(x))
let definition
const current = require('./fixtures/pre-stage-one.json').unfinished
const pending = []
global.Page = value => { definition = value }
global.wx = {
  getStorageSync: key => key === 'currentGame' ? clone(current) : '',
  setStorageSync() {}, showShareMenu() {}, nextTick: fn => pending.push(fn), showToast() {},
  navigateTo() { throw new Error('embedded input must not navigate') },
  navigateBack() { throw new Error('embedded input must not pop the board') },
  setNavigationBarTitle() { throw new Error('embedded input must not replace board title') }
}
require('../pages/game/board')
const board = { ...definition, data:clone(definition.data), setData(v, done) { Object.assign(this.data,v); if(done) done() } }
board.onLoad({resume:'1'})
board.setData({selectedWinner:1,selectedLoser:0,showRonModal:true,ronEntries:[{idx:1,name:'南家',points:''}],roundRiichi:[false,true,false,false]})
const original = clone(board.data.players)
const create = kind => {
  const factory = require('../utils/embedded-entry')
  const def = factory(require(`../pages/${kind}/definition`))
  const component = { ...def.methods, properties:{config:board.data.inputOverlayConfig},data:clone(def.data),
    setData(v) { Object.assign(this.data,v) },
    triggerEvent(name,result) { if(name==='result') board.receiveInputOverlayResult({detail:result}); else board.closeInputOverlay() } }
  def.lifetimes.attached.call(component)
  return component
}
board.goToMultiQuick({currentTarget:{dataset:{idx:1}}})
pending.shift()()
assert(board.data.inputOverlayVisible && board.data.showRonModal)
const quick = create('quick-score')
assert(quick.data.boardMode)
assert.strictEqual(quick.data.rows.length,0)
quick.confirm()
assert(!board.data.inputOverlayVisible && board.data.showRonModal)
assert(board.data.ronReady)
assert.deepStrictEqual(board.data.players,original)
const points = board.data.ronEntries[0].points
board.goToMultiQuick({currentTarget:{dataset:{idx:1}}})
pending.shift()()
const restored = create('quick-score')
assert.strictEqual(restored.data.han,quick.data.han)
restored.goBack()
assert.strictEqual(board.data.ronEntries[0].points,points)
board.goToMultiCalc({currentTarget:{dataset:{idx:1}}})
pending.shift()()
const hand = create('calculator')
assert(hand.data.boardMode && hand.data.riichi)
hand.setData({hand:[0,1,2,3,4,5,10,11,12,19,20,22,22],agariTile:21})
hand.updateRemaining()
hand.doCalculate()
assert(hand.data.showBoardResult)
hand.confirmBoardResult()
assert(board.data.ronEntries[0].calculatorInput)
assert.deepStrictEqual(board.data.players,original)
board.goToMultiCalc({currentTarget:{dataset:{idx:1}}})
pending.shift()()
const restoredHand = create('calculator')
assert.deepStrictEqual(restoredHand.data.hand,hand.data.hand)
assert.strictEqual(restoredHand.data.handCount,13)
board.closeInputOverlay()
board.goToMultiQuick({currentTarget:{dataset:{idx:1}}})
board.closeInputOverlay()
pending.shift()()
assert(!board.data.inputOverlayVisible, 'closing before the opening frame must stay closed')
board.onUnload()
console.log('Embedded input passed: no navigation, cancel preservation, quick/hand confirmation, restored inputs and unchanged scores.')
