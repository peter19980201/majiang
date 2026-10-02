// Run with node test/share.js.
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { withShare } = require('../utils/share')
const pages = require('../app.json').pages
let definition
let menus
global.Page = value => { definition = value }
global.wx = { showShareMenu(options) { menus = options.menus } }

for (const route of pages) {
  require(path.resolve(__dirname, '..', route + '.js'))
  const share = definition.onShareAppMessage.call({
    data: { gameId: 'private-game', players: [{ name: 'private-player' }] }
  })
  assert.strictEqual(share.path, '/pages/index/index', route + ': opens home without local game parameters')
  assert(!JSON.stringify(share).includes('private-'))
  assert(fs.existsSync(path.resolve(__dirname, '..', share.imageUrl.slice(1))))
  if (route === 'pages/index/index') {
    const timeline = definition.onShareTimeline()
    assert.strictEqual(timeline.query, '')
    assert(timeline.title)
  } else {
    assert.strictEqual(definition.onShareTimeline, undefined, route + ': no incomplete timeline landing page')
  }
}

for (const timeline of [false, true]) {
  const context = { count: 0 }
  const page = withShare({
    onShow(value) { this.count += value; return 'preserved' }
  }, { timeline })
  assert.strictEqual(page.onShow.call(context, 2), 'preserved')
  assert.strictEqual(context.count, 2)
  assert.deepStrictEqual(menus, timeline ? ['shareAppMessage', 'shareTimeline'] : ['shareAppMessage'])
}
console.log(`Share checks passed: all ${pages.length} pages, home timeline, local data isolation, lifecycle preservation.`)
