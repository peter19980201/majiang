const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Confirmation = require('../../utils/confirmation')
let componentDefinition
// Real component + real routing adapter; no presentation mock in this suite.
global.Component = value => { componentDefinition = value }
require('../../components/confirmation-dialog/index')
const dialog = () => ({ ...componentDefinition.methods, data:{...componentDefinition.data}, setData(value) { Object.assign(this.data,value) } })
const d = dialog(), results = []
const host = { selectComponent(id) { assert.equal(id,'#confirmation-dialog'); return d } }
Confirmation.show(host, {title:'确认删除',content:'已收藏',confirmText:'删除',cancelText:'保留',success:r=>results.push(r),complete:()=>results.push('complete')})
assert.equal(d.data.visible,true); assert.equal(d.data.title,'确认删除'); assert.equal(d.data.content,'已收藏')
assert.equal(d.data.confirmText,'删除'); assert.equal(d.data.cancelText,'保留')
let rejected = 0
Confirmation.show(host,{title:'second',success:()=>assert.fail('busy dialog cannot confirm'),complete:()=>rejected++})
assert.equal(rejected,1); assert.equal(d.data.title,'确认删除')
d.blockTouch(); assert.equal(results.length,0,'mask does not resolve a destructive choice')
d.cancel(); d.confirm()
assert.deepEqual(results,[{confirm:false,cancel:true},'complete'],'one resolution only')
assert.equal(d.data.visible,false)
Confirmation.show(host,{showCancel:false,success:r=>results.push(r)})
assert.equal(d.data.showCancel,false); assert.equal(d.data.confirmText,'确定')
d.confirm(); assert.deepEqual(results.at(-1),{confirm:true,cancel:false})
let fail=0, complete=0
for (const lifecycle of [componentDefinition.pageLifetimes.hide,componentDefinition.lifetimes.detached]) {
 Confirmation.show(host,{success:()=>assert.fail('lifecycle must not execute cancel/new-game branch'),fail:()=>fail++,complete:()=>complete++})
 lifecycle.call(d); d.confirm(); assert.equal(d.data.visible,false)
}
assert.equal(fail,2); assert.equal(complete,2)
Confirmation.show(host,{success:()=>{throw Error('storage failure')},complete:()=>complete++})
assert.throws(()=>d.confirm(),/storage failure/); assert.equal(complete,3); assert.equal(d.data.visible,false)
// Embedded details route to top-level page dialog, outside transformed drawer.
global.getCurrentPages = () => [host]
Confirmation.show({selectComponent:()=>null},{title:'嵌入详情删除'})
assert.equal(d.data.title,'嵌入详情删除'); d.cancel()
Confirmation.showCurrent({title:'新建确认'}); assert.equal(d.data.title,'新建确认'); d.cancel()
global.getCurrentPages = () => []
Confirmation.show(null,{success:()=>assert.fail('missing host must not run choice'),fail:()=>fail++,complete:()=>complete++})
assert.equal(fail,3); assert.equal(complete,4)
// Actual history page -> adapter -> component -> storage after confirmation.
let pageDefinition, removed
const Storage = require('../../utils/game-storage')
Storage.removeHistory = id => { removed=id }
global.Page = value => { pageDefinition=value }
global.wx = { showShareMenu() {} }
require('../../pages/game/history')
const page = {...pageDefinition, ...host, _records:[{id:'favorite',favorite:true}],onShow(){}}
page.deleteRecord({currentTarget:{dataset:{id:'favorite'}}})
assert.match(d.data.content,/已收藏/); assert.equal(removed,undefined)
d.cancel(); assert.equal(removed,undefined)
page.deleteRecord({currentTarget:{dataset:{id:'favorite'}}}); d.confirm(); assert.equal(removed,'favorite')
// Static host wiring and shared styling contract.
const read = file => fs.readFileSync(path.resolve(__dirname,'../..',file),'utf8')
for(const name of ['pages/index/index','pages/game/history','pages/game/board','pages/game/round-detail','pages/battle-report/battle-report']) {
 assert.equal(JSON.parse(read(name+'.json')).usingComponents['confirmation-dialog'],'/components/confirmation-dialog/index')
 assert.match(read(name+'.wxml'),/<confirmation-dialog[^>]*id="confirmation-dialog"/)
}
assert.match(read('pages/game/round-detail.wxml'),/confirmation-dialog wx:if="{{!embedded}}"/)
for (const file of ['custom-tab-bar/index.wxss','components/confirmation-dialog/index.wxss']) assert(read(file).includes("@import '/styles/confirmation.wxss';"))
assert.match(read('styles/confirmation.wxss'),/prefers-reduced-motion/)
assert.match(read('components/confirmation-dialog/index.wxml'),/wx:if="{{showCancel}}"/)
function scan(dir) {
 for(const item of fs.readdirSync(path.resolve(__dirname,'../..',dir),{withFileTypes:true})) {
  const file = dir+'/'+item.name
  if(item.isDirectory()) scan(file)
  else if(file.endsWith('.js')) assert(!/wx\.showModal\s*\(/.test(read(file)),`${file}: no native confirmation fallback`)
 }
}
for (const dir of ['pages','components','utils','custom-tab-bar']) scan(dir)
console.log('Confirmation dialog: actual component/adapter/history flow, cancel/confirm, lifecycle, duplicate protection, callbacks, shared styles and all native callsites migrated.')
