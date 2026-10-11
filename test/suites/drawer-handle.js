const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '../..')
const read = file => fs.readFileSync(path.join(root,file),'utf8')
let definition
 global.Component = value => { definition = value }
require('../../components/drawer-handle/index')
function handle(expanded = true) {
  return { ...definition.methods, data:{expanded}, events:[], triggerEvent(name) { this.events.push(name) } }
}
const touch = (x,y,id=1) => ({clientX:x,clientY:y,identifier:id})
function drag(h,x,y) {
  h.start({touches:[touch(100,100)]})
  h.move({touches:[touch(100+x,100+y)]})
  h.end({changedTouches:[touch(100+x,100+y)]})
  h.tap() // Synthetic click after a touch must not toggle a closed drawer back open.
}
let h = handle(); h.tap(); assert.deepEqual(h.events,['activate'])
h = handle(); drag(h,2,4); assert.deepEqual(h.events,['activate'])
for (const [x,y] of [[0,40],[10,80],[0,200],[0,39],[0,-80],[100,10],[60,60],[100,80]]) {
  h = handle(); drag(h,x,y); assert.deepEqual(h.events,[], `${x},${y} must not close`)
}
h = handle(false); drag(h,0,80); assert.deepEqual(h.events,[])
h.start({touches:[touch(0,0)]}); h.end({changedTouches:[touch(0,0)]}); h.tap(); assert.deepEqual(h.events,['activate'])
h = handle(); h.start({touches:[touch(0,0)]}); h.move({touches:[touch(0,90)]}); h.cancel(); h.end({changedTouches:[touch(0,90)]}); h.tap(); assert.deepEqual(h.events,[])
h = handle(); h.start({touches:[touch(0,0)]}); h.move({touches:[touch(0,90),touch(2,3,2)]}); h.end({changedTouches:[touch(0,90)]}); h.tap(); assert.deepEqual(h.events,[])
h = handle(); h.start({touches:[touch(0,0)]}); h.end({changedTouches:[touch(0,90,2)]}); h.tap(); assert.deepEqual(h.events,[])
h = handle(); h.start({touches:[touch(0,0)]}); definition.lifetimes.detached.call(h); h.end({changedTouches:[touch(0,90)]}); assert.deepEqual(h.events,[])
const bindings = {
 'pages/game/board.wxml':['closeRon','closeTsumo','closeDraw','closeInputOverlay','closeRoundDetail'],
 'pages/game/history.wxml':['closeSettlement'],
 'pages/calculator/calculator.wxml':['closeMeldPanel','cancelBoardResult'],
 'custom-tab-bar/index.wxml':['closeModePicker']
}
for (const [file,actions] of Object.entries(bindings)) {
  const markup = read(file)
  for (const action of actions) {
    assert(markup.includes(`bind:activate="${action}"`), file + ': preserve existing close handler ' + action)
    assert(markup.includes(`bindtap="${action}"`) || markup.includes(`catchtap="${action}"`), file + ': existing close path retained')
  }
  assert(!/<view[^>]*class="(?:win-grip|settlement-grip|modal-handle|mode-picker-grip)"/.test(markup), file + ': no inert handles')
  assert(!/<scroll-view[^>]*(?:catchtouchstart|catchtouchmove|catchtouchend)=/.test(markup), file + ': content scrolling must not be captured')
}
for (const file of ['pages/game/board.json','pages/game/history.json','pages/calculator/calculator.json','components/calculator-entry/index.json','custom-tab-bar/index.json']) {
 assert.equal(JSON.parse(read(file)).usingComponents['drawer-handle'],'/components/drawer-handle/index')
}
assert(read('components/calculator-entry/index.wxml').includes('calculator.wxml'), 'embedded calculator shares the tested handles')
assert(read('pages/game/board.wxml').includes('expanded="{{recordsExpanded}}" bind:activate="toggleRecords"'))
// A click toggles the existing record panel in either direction.
global.Page = value => { definition = value }
require('../../pages/game/board')
const board = {data:{recordsExpanded:false, freshRecordId:'test-round'}, setData(update) { Object.assign(this.data,update) }}
definition.toggleRecords.call(board); assert.equal(board.data.recordsExpanded,true)
definition.toggleRecords.call(board); assert.equal(board.data.recordsExpanded,false)
assert(!read('components/drawer-handle/index.wxml').includes('catchtouch'), 'handle must not block native scrolling')
assert(read('components/drawer-handle/index.wxml').includes('catchtap="tap"'))
for (const file of Object.keys(bindings)) assert(!read(file).includes('bind:collapse='), 'swipe-close binding removed')
assert(!read('components/drawer-handle/index.js').includes('setData('), 'gesture tracking does not send per-frame renders')
console.log('Drawer handles: click-only, drag rejection, cancellation, duplicate suppression, record toggle and all host bindings passed.')
