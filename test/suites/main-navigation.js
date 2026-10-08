const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '../..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const clone = value => JSON.parse(JSON.stringify(value))
let definition, navigation, modal, current = null, settled = 0, route = 'pages/index/index'
global.Page = value => { definition = value }
global.Component = value => { definition = value }
global.getCurrentPages = () => [{ route }]
global.wx = {
  showShareMenu() {},
  navigateTo(options) { navigation = { type:'push', ...options } },
  switchTab(options) { navigation = { type:'tab', ...options } },
  showModal(options) { modal = options }
}
const storage = require('../../utils/game-storage')
storage.current = () => current
storage.finishSavedGame = saved => { assert.equal(saved, current); settled++; current = null }
function load(file, component = false) {
  const resolved = path.join(root, file)
  delete require.cache[require.resolve(resolved)]
  require(resolved)
  return { ...(component ? definition.methods : definition), data:clone(definition.data || {}),
    setData(value) { Object.assign(this.data, value) } }
}
const config = JSON.parse(read('app.json'))
assert.equal(config.tabBar.custom, true)
assert.deepEqual(config.tabBar.list.map(tab => tab.pagePath), [
  'pages/index/index', 'pages/game/history', 'pages/reference/reference', 'pages/profile/profile'
])
for (const tab of config.tabBar.list) assert(config.pages.includes(tab.pagePath))
const bar = load('custom-tab-bar/index.js', true)
const barDefinition = definition
const tap = index => bar.activate({ currentTarget:{ dataset:{ index } } })
barDefinition.lifetimes.attached.call(bar)
assert.equal(bar.data.selected, route)
tap(0); assert.equal(navigation, undefined)
tap(1); assert.equal(navigation.type, 'tab'); assert.equal(navigation.url, '/pages/game/history')
assert.equal(bar.data.selected, 'pages/index/index', 'failed/incomplete navigation must not change selection')
route = 'pages/game/history'; barDefinition.pageLifetimes.show.call(bar)
assert.equal(bar.data.selected, route)
tap(3); assert.equal(navigation.url, '/pages/reference/reference')
tap(4); assert.equal(navigation.url, '/pages/profile/profile')
bar.selectRoute('pages/game/setup'); assert.equal(bar.data.selected, route)
navigation = null
tap(2); assert.equal(navigation.type, 'push'); assert.equal(navigation.url, '/pages/game/setup')
const first = navigation; tap(2); assert.equal(navigation, first, 'double tap opens only once')
navigation.complete(); assert.equal(bar._opening, false)
current = { gameState:{ gameOver:false } }; navigation = null
tap(2); tap(2)
assert(modal); assert.equal(navigation, null)
modal.success({ cancel:true, confirm:false })
assert(current); assert.equal(settled, 0); assert.equal(bar._opening, false)
tap(2); modal.fail(); assert.equal(bar._opening, false)
tap(2); modal.success({ confirm:true })
assert.equal(settled, 1); assert.equal(navigation.url, '/pages/game/setup'); navigation.complete()
const home = load('pages/index/index.js')
home.route = 'pages/index/index'; home.getTabBar = () => bar
current = { gameState:{ gameOver:false, players:[] } }; home.onShow()
assert.equal(bar.data.selected, home.route); assert.equal(home.data.currentGame, current)
current = null; home.onShow(); assert.equal(home.data.currentGame, null)
current = { gameState:{ gameOver:true } }; home.onShow(); assert.equal(home.data.currentGame, null)
home.goHistory(); assert.equal(navigation.type, 'tab')
home.goReference(); assert.equal(navigation.type, 'tab')
home.resumeGame(); assert.equal(navigation.url, '/pages/game/board?resume=1')
assert.equal(navigation.type, 'push')
const history = load('pages/game/history.js')
history.resumeGame(); assert.equal(navigation.type, 'push', 'back returns to the history tab')
const board = load('pages/game/board.js'); board.goHistory()
assert.equal(navigation.type, 'tab'); assert.equal(navigation.url, '/pages/game/history')

const rules = load('pages/reference/reference.js'); rules.onLoad()
rules.onKeywordInput({ detail:{ value:'平和' } })
assert.equal(rules.data.filteredYaku.length, 1)
rules.onExpandTap({ currentTarget:{ dataset:{ idx:0 } } })
const rulesTab = tab => rules.selectRulesTab({ currentTarget:{ dataset:{ tab } } })
rulesTab('points'); assert.equal(rules.data.rulesTab, 'points')
rulesTab('invalid'); assert.equal(rules.data.rulesTab, 'points')
rulesTab('yaku'); assert.equal(rules.data.keyword, '平和'); assert.equal(rules.data.expandedIndex, 0)
const table = load('components/points-table/index.js', true)
definition.lifetimes.attached.call(table)
const cell = (fu, han) => table.data.rows.find(row => row.fu === fu).cells[han - 1].text
assert.equal(cell(40, 3), '5200')
table.selectTable({ currentTarget:{ dataset:{ key:'tableOya', value:'true' } } })
assert.equal(cell(40, 3), '7700')
table.selectTable({ currentTarget:{ dataset:{ key:'tableType', value:'tsumo' } } })
assert.equal(cell(40, 3), '2600各')
table.selectTable({ currentTarget:{ dataset:{ key:'tableOya', value:'false' } } })
assert.equal(cell(40, 3), '1300/2600')
rulesTab('points'); rulesTab('yaku'); rulesTab('points')
assert.equal(table.data.tableType, 'tsumo'); assert.equal(table.data.tableOya, false)

const homeMarkup = read('pages/index/index.wxml')
assert(!homeMarkup.includes('点数速查'))
assert(homeMarkup.includes('暂无进行中的对局'))
assert(homeMarkup.includes('class="home-calculators"'))
assert(homeMarkup.includes('url="/pages/calculator/calculator"'))
assert(homeMarkup.includes('url="/pages/quick-score/quick-score"'))
assert.equal((homeMarkup.match(/class="resume-card"/g) || []).length, 1, 'both states share a game slot')
assert(/\.resume-card\s*\{[^}]*height:380rpx/.test(read('pages/index/index.wxss')))
assert(read('pages/index/index.wxss').includes('grid-template-columns:repeat(2,minmax(0,1fr))'))
const rulesMarkup = read('pages/reference/reference.wxml')
assert(rulesMarkup.includes('hidden="{{rulesTab !== \'points\'}}"'))
assert(rulesMarkup.includes('hidden="{{rulesTab !== \'yaku\'}}"'))
assert(rulesMarkup.includes('<points-table'))
assert(read('pages/profile/profile.wxml').includes('open-type="feedback"'))
assert(read('pages/quick-score/quick-score.wxml').includes('components/points-table/table.wxml'))
assert(read('components/points-table/index.wxml').includes('table.wxml'))
assert(!read('pages/game/setup.wxml').includes('tab-bar'))
// Every tab has both local vector states; the central action has its own larger icon.
const tabMarkup = read('custom-tab-bar/index.wxml')
assert(tabMarkup.includes("selected === item.route ? '-active.svg' : '-idle.svg'"))
assert(tabMarkup.includes("'/assets/navigation/add.svg'"))
for (const icon of ['home', 'history', 'rules', 'profile']) {
  for (const [state, color] of [['idle', '#a8aca9'], ['active', '#205640']]) {
    const svg = read(`assets/navigation/${icon}-${state}.svg`)
    assert(svg.includes('viewBox="0 0 24 24"'))
    assert(svg.includes(color))
    assert(!/<(?:script|image)\b/.test(svg), 'icons must be self-contained vectors')
  }
}
assert(read('assets/navigation/add.svg').includes('viewBox="0 0 32 32"'))
assert(tabMarkup.includes('src="/assets/navigation/bar-rise.svg"'))
assert(tabMarkup.includes('class="tab-bar-rise"'))
assert(read('assets/navigation/bar-rise.svg').includes('viewBox="0 0 180 36"'))
const tabStyle = read('custom-tab-bar/index.wxss')
assert(/\.tab-bar-rise\s*\{[^}]*pointer-events:none/.test(tabStyle), 'decorative rise must not block navigation taps')
assert(/\.tab-item\s*\{[^}]*overflow:visible/.test(tabStyle), 'raised add icon must not be clipped')
console.log('Main navigation: four tabs, new-game cancellation/debounce, return routes, fixed home slot, retained rule filters and four table modes passed.')
