const assert = require('node:assert/strict')
let definition, modal
let records = [{ id:'a' }, { id:'b' }]
global.Page = value => { definition = value }
global.wx = { showModal(value) { modal = value }, showShareMenu() {}, getStorageSync:key => key === 'gameHistory' ? records : '' }
require('../../pages/game/history')
const page = { ...definition, data:{ ...definition.data }, setData(value) { Object.assign(this.data,value) } }
const fs = require('node:fs'), vm = require('node:vm')
const sandbox = { module:{ exports:{} }, Math }
vm.runInNewContext(fs.readFileSync(require.resolve('../../utils/history-swipe.wxs'),'utf8'),sandbox)
const swipe = sandbox.module.exports
const frames = []
const node = () => { const state = {}; return { getState:() => state, setStyle(style) { this.style=style }, requestAnimationFrame(fn) { frames.push(fn) } } }
const a = node(), b = node(), owner = node()
let expanded = 0, bridgeCalls = 0
owner.callMethod = () => { expanded++; bridgeCalls++ }
let time = 0
const event = (id,x,y,instance=a) => ({ instance, currentTarget:{ dataset:{ id } }, touches:[{ clientX:x,clientY:y }], timeStamp:time += 16 })
const flush = () => { let count=0; while(frames.length && count++ < 500) frames.shift()(); assert(count < 500,'spring must settle') }
swipe.start(event('a',200,100),owner); swipe.move(event('a',130,102)); swipe.end(event('a')); flush()
assert.equal(a.getState().x,-72)
swipe.tap(event('a'),owner); assert.equal(expanded,0,'swipe must not open settlement')
swipe.start(event('b',200,100,b),owner); flush(); assert.equal(a.getState().x,0,'another row closes previous action')
swipe.move(event('b',190,180,b)); swipe.end(event('b',0,0,b)); flush(); assert.equal(b.getState().x,0,'vertical scrolling must not reveal delete')
swipe.start(event('b',200,100,b),owner); time+=200; swipe.move(event('b',180,101,b)); time+=200; swipe.end(event('b',0,0,b)); flush(); assert.equal(b.getState().x,0,'slow short swipe snaps shut')
swipe.start(event('b',200,100,b),owner); swipe.move(event('b',0,100,b)); swipe.end(event('b',0,0,b)); flush(); assert.equal(b.getState().x,-72,'drag is clamped')
swipe.start(event('b',100,100,b),owner); swipe.move(event('b',180,100,b)); swipe.cancel(event('b',0,0,b)); flush(); assert.equal(b.getState().x,-72,'interrupted gesture restores position')
swipe.start(event('b',100,100,b),owner); swipe.move(event('b',180,100,b)); swipe.end(event('b',0,0,b)); flush(); assert.equal(b.getState().x,0,'right swipe closes')
swipe.start(event('b',200,100,b),owner); swipe.move(event('b',185,100,b)); swipe.end(event('b',0,0,b)); flush(); assert.equal(b.getState().x,-72,'quick flick projects momentum')
swipe.start(event('b',100,100,b),owner); swipe.move(event('b',150,100,b)); swipe.end(event('b',0,0,b)); frames.shift()()
const liveX = b.getState().x
swipe.start(event('b',100,100,b),owner); assert.equal(b.getState().initial,liveX,'re-grab starts at presentation position'); swipe.move(event('b',90,100,b)); const draggedX=b.getState().x; flush(); assert.equal(b.getState().x,draggedX,'old spring cannot overwrite new gesture')
assert.equal(bridgeCalls,0,'all drag and spring frames stay off the logic bridge')
swipe.reset(1,0,owner); assert.equal(b.getState().x,0)
swipe.start(event('b',100,100,b),owner); swipe.end(event('b',100,100,b)); swipe.tap(event('b',100,100,b),owner); assert.equal(expanded,1,'normal tap opens settlement')
const storage = require('../../utils/game-storage')
let removed
storage.removeHistory = id => { removed=id }
page.onShow = () => {}
page.deleteRecord(event('b')); assert.equal(removed,undefined)
modal.success({confirm:false}); assert.equal(removed,undefined,'cancel keeps record')
page.deleteRecord(event('b')); modal.success({confirm:true}); assert.equal(removed,'b','confirmation removes only chosen record')
console.log('History swipe direction, threshold, cancellation, single-open row, tap protection and deletion confirmation passed.')
