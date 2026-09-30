// Run with node test/ui-state.js. No WeChat installation or dependencies required.
const assert = require('assert')
const path = require('path')
let definition
global.Page = value => { definition = value }
global.wx = {
  getStorageSync: () => '', setStorageSync() {}, removeStorageSync() {},
  navigateTo() {}, showModal() {}
}
function page(file) {
  const modulePath = path.resolve(__dirname, '..', file)
  delete require.cache[modulePath]
  require(modulePath)
  return { ...definition, data: JSON.parse(JSON.stringify(definition.data)),
    setData(data) { Object.assign(this.data, data) } }
}

// Every combination of hearing players and riichi must preview the exact commit.
for (let hearing = 0; hearing < 16; hearing++) {
  for (let riichi = 0; riichi < 16; riichi++) {
    const board = page('pages/game/board.js')
    board.data.config = { gameType:'hanchan', startPoints:25000, returnPoints:30000, uma:'10-20' }
    board.data.players = ['東家','南家','西家','北家'].map(name => ({name,points:25000}))
    board.data.drawTenpai = [0,1,2,3].map(i => Boolean(hearing & (1 << i)))
    board.data.roundRiichi = [0,1,2,3].map(i => Boolean(riichi & (1 << i)))
    const before = JSON.stringify(board.data.players)
    board.updateDrawPreview()
    assert.strictEqual(JSON.stringify(board.data.players), before, 'preview must not change scores')
    const deltas = board.data.drawPreview.map(row => row.delta)
    board.confirmDraw()
    assert.deepStrictEqual(board.data.players.map(p => p.points - 25000), deltas)
    assert.strictEqual(board.data.players.reduce((sum,p) => sum + p.points,0) + board.data.riichiSticks * 1000, 100000)
  }
}

// Result payment cards use the engine's exact distribution, including honba.
const { calculatePayment } = require('../utils/score')
for (const dealer of [true,false]) for (const tsumo of [true,false]) {
  const payment = calculatePayment(240,dealer,tsumo,2)
  const result = page('pages/result/result.js')
  result.onLoad({data:encodeURIComponent(JSON.stringify({payment}))})
  const amounts = result.data.paymentRows.map(row => Number(row.value.replace(/,/g,'')))
  assert.strictEqual(tsumo ? (dealer ? amounts[0]*3 : amounts[0]+amounts[1]*2) : amounts[0],payment.total)
}

// Tile visual selection updates even when its tile ID stays unchanged.
global.Component = value => { definition = value }
require('../components/tile/tile')
const tile = {data:{}, ...definition.methods, setData(data) {Object.assign(this.data,data)} }
for (let id=0; id<34; id++) {
  tile.updateDisplay(id,'')
  if (id>=9 && id<27) assert.strictEqual(tile.data.marks.length,id%9+1)
}
definition.observers['tid, extra'].call(tile,13,'red5 red5-on')
assert(tile.data.isRed)
assert(tile.data.marks.every(mark => mark.red))
definition.observers['tid, extra'].call(tile,13,'')
assert.strictEqual(tile.data.isRed,false)
assert.strictEqual(tile.data.marks.filter(mark => mark.red).length,1)

// Every normal tile has artwork; red fives switch without changing tile ID.
for (let id=0; id<34; id++) {
  tile.updateDisplay(id,'')
  assert(tile.data.bodySrc.endsWith('.png'))
  assert(require('fs').existsSync(path.resolve(__dirname,'..'+tile.data.bodySrc)))
}
for (const id of [4,13,22]) {
  tile.updateDisplay(id,'red5 red5-on')
  assert(tile.data.bodySrc.endsWith('-5-red.png'), 'red five must use its red artwork')
  assert(require('fs').existsSync(path.resolve(__dirname,'..'+tile.data.bodySrc)))
  tile.updateDisplay(id,'')
  assert(tile.data.bodySrc.endsWith('-5.png'))
}
tile.updateDisplay(1,'')
assert(tile.data.bodySrc.endsWith('man-2.png'))
tile.updateDisplay(27,'agari')
assert(tile.data.bodySrc.endsWith('honor-east.png'))
tile.updateDisplay(-1,'')
assert.strictEqual(tile.data.bodySrc,'')
assert.strictEqual(tile.data.isRed,false)

// Cancelling "new game" must preserve the existing game; resume reads storage.
const home = page('pages/index/index.js')
const saved = {gameState:{gameOver:false,players:[],config:{}}}
let prompted = false
wx.getStorageSync = () => saved
wx.showModal = options => { prompted = true; options.success({confirm:false,cancel:true}) }
home._settleAndSave = () => { throw new Error('cancel must not settle a game') }
home.onShow()
assert.strictEqual(home.data.currentGame,saved)
home.newGame()
assert(prompted)
assert.strictEqual(home.data.currentGame,saved)
console.log('UI state checks passed: 256 draw scenarios, payment cards, reactive tile faces, safe resume/new-game behavior.')

// The expanded seven-pairs illustration must actually contain seven pairs.
const tiles = require('../utils/tiles')
const sevenPairs = require('../utils/yaku-data').YAKU_DATA.find(y => y.name === '七对子').example
const example = tiles.parseTiles(sevenPairs.hand + sevenPairs.agari)
assert.strictEqual(example.length,14)
assert.strictEqual(tiles.tilesToCounts(example).filter(n => n === 2).length,7)
console.log('Seven-pairs illustration: 14 tiles, seven distinct pairs.')

// The rendered assets, not only component metadata, have the right mark counts.
const fs = require('fs')
for (const suit of ['pin','sou']) for (let rank=1;rank<=9;rank++) {
  const variants = rank===5 ? ['', '-red'] : ['']
  for (const variant of variants) {
    const svg = fs.readFileSync(path.resolve(__dirname,`../assets/tiles/${suit}-${rank}${variant}.svg`),'utf8')
    const marks = svg.match(suit==='pin' ? /data-pip=/g : /data-bamboo=/g) || []
    assert.strictEqual(marks.length,rank,`${suit} ${rank}${variant} face markings`)
  }
}
for (let id=0;id<34;id++) {
  tile.updateDisplay(id,'')
  if (id>=9 && id<27) assert(fs.existsSync(path.resolve(__dirname,'..'+tile.data.faceSrc)))
  else assert.strictEqual(tile.data.faceSrc,'')
}
tile.updateDisplay(13,'red5')
assert(tile.data.faceSrc.endsWith('pin-5-red.svg'))
tile.updateDisplay(27,'')
assert.strictEqual(tile.data.label,'東')
assert.strictEqual(tile.data.faceSrc,'')
const reference = page('pages/reference/reference.js')
reference.onLoad()
const pairs = reference.allYaku.find(y=>y.name==='七对子')._pairGroups
assert.strictEqual(pairs.length,7)
assert(pairs.every(pair=>pair.length===2 && pair[0]===pair[1]))
console.log('Rendered tile assets and seven-pairs grouping verified.')
