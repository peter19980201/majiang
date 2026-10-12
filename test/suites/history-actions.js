require('../harness/confirmation-mock')
const assert = require('node:assert/strict')
const fs = require('node:fs')
let definition, modal, removed, opened
let modalCount = 0
const records = [{ id:'a', favorite:true }, { id:'b' }]
global.Page = value => { definition = value }
global.wx = { showModal(value) { modal = value; modalCount++ }, showShareMenu() {} }
require('../../pages/game/history')
const page = { ...definition, data:{ ...definition.data }, _records:records,
  setData(value) { Object.assign(this.data,value) }, onShow() {},
  viewSettlement(e) { opened = e.currentTarget.dataset.id }
}
const storage = require('../../utils/game-storage')
storage.removeHistory = id => { removed=id }
const event = id => ({ currentTarget:{dataset:{id}} })
const markup = fs.readFileSync(require.resolve('../../pages/game/history.wxml'),'utf8')
const favorite = markup.match(/<button class="card-action favorite-button[^>]+>/)[0]
const trash = markup.match(/<button class="card-action delete-button[^>]+>/)[0]
assert(markup.indexOf(favorite) < markup.indexOf(trash), 'trash follows star in right action group')
assert.match(markup, /<view class="card-actions">/)
assert.match(favorite, /catchtap="toggleFavorite"/)
assert.match(trash, /catchtap="deleteRecord"/)
assert.match(trash, /data-id="{{item.id}}"/)
assert.match(trash, /aria-label="删除/)
assert.match(markup, /bindtap="onExpandTap"/)
assert(!/swipe|bindtouchmove/.test(markup), 'retired swipe interaction must not move the card')
assert(fs.existsSync(require.resolve('../../assets/icons/trash.svg')))
const css = fs.readFileSync(require.resolve('../../pages/game/history.wxss'),'utf8')
assert.match(css, /\.card-actions \{ display:flex; flex:0 0 auto;/)
assert.match(css, /\.card-action \{[^}]*width:44px;[^}]*height:44px;/, 'separate large touch targets')
// Invoke the real handler bound by the trash button; only confirmation removes data.
const deleteHandler = /catchtap="([^"]+)"/.exec(trash)[1]
page[deleteHandler](event('b'))
assert.equal(modalCount,1); assert.equal(removed,undefined); assert.equal(opened,undefined)
assert.equal(modal.content,'删除后无法恢复')
modal.success({confirm:false}); assert.equal(removed,undefined,'cancel preserves record')
page[deleteHandler](event('a')); assert.match(modal.content,/已收藏/)
modal.success({confirm:true}); assert.equal(removed,'a','confirmation deletes selected favorite only')
assert.equal(opened,undefined,'delete never opens details')
page.onExpandTap(event('b')); assert.equal(opened,'b','card still opens selected detail')
console.log('History actions: right-aligned star/trash, independent tap bindings, confirmation/cancel and favorite deletion passed.')
