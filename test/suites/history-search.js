const assert = require('node:assert/strict')
const fs = require('node:fs')
const Storage = require('../../utils/game-storage')
const fixtures = [
 {id:'both',result:[{name:'小林'},{name:'阿青'},{name:'东家'}],favorite:true},
 {id:'lin',result:[{name:'小林'},{name:'小夏'},{name:'北家'}]},
 {id:'qing',result:[{name:'阿青'},{name:'小夏'},{name:'北家'}],favorite:true},
 {id:'longer',result:[{name:'小林同学'},{name:'阿青'}]},
 {id:'legacy',gameState:{players:[{name:'老张'},{name:'老李'}]}},
 {id:'empty'}
]
let records = structuredClone(fixtures), reads = 0, definition
Storage.history = () => { reads++; return structuredClone(records) }
Storage.current = () => assert.fail('search must not read ongoing game')
Storage.toggleFavorite = id => { const r = records.find(r=>r.id===id); r.favorite=!r.favorite; return r.favorite }
global.wx = {showShareMenu(){}}
global.Page = value => {definition=value}
require('../../pages/game/history')
const p = {...definition,data:structuredClone(definition.data),setData(value){Object.assign(this.data,value)}}
const ids = () => p.data.historyList.map(r=>r.id)
const input = value => p.onSearchInput({detail:{value}})
const filter = value => p.changeFilter({currentTarget:{dataset:{filter:value}}})
p.onShow(); assert.deepEqual(ids(),['both','lin','qing','longer','legacy','empty'])
input('小林'); assert.deepEqual(ids(),['both','lin','longer']); assert.equal(p.data.totalCount,3); assert.equal(p.data.favoriteCount,1)
input('小林 阿青'); assert.deepEqual(ids(),['both','longer'],'all names must occur in the same game')
input('阿青 小林'); assert.deepEqual(ids(),['both','longer'],'input order is irrelevant')
input('  小林   阿青　\t'); assert.deepEqual(ids(),['both','longer'],'trim and repeated/fullwidth whitespace')
input('小林 小林'); assert.deepEqual(ids(),['both','lin','longer'],'duplicate tokens do not require duplicate participants')
input('小林 小夏 阿青'); assert.deepEqual(ids(),[],'names from separate games cannot combine')
assert.equal(p.data.hasSearch,true)
input('小'); assert.deepEqual(ids(),['both','lin','qing','longer'],'partial names match')
input('林 青'); assert.deepEqual(ids(),['both','longer'],'partial tokens must all match the same game')
input('林 北'); assert.deepEqual(ids(),['lin'],'do not combine participants across games')
input('.*'); assert.deepEqual(ids(),[],'tokens are literal substrings, not regular expressions')
input('老张 老李'); assert.deepEqual(ids(),['legacy'])
input('小林'); filter('favorites'); assert.deepEqual(ids(),['both'])
p.toggleFavorite({currentTarget:{dataset:{id:'both'}}}); assert.deepEqual(ids(),[])
assert.equal(p.data.searchQuery,'小林'); assert.equal(p.data.totalCount,3); assert.equal(p.data.favoriteCount,0)
filter('all'); assert.deepEqual(ids(),['both','lin','longer'])
p.onShow(); assert.deepEqual(ids(),['both','lin','longer'],'returning retains search')
input(''); assert.deepEqual(ids(),['both','lin','qing','longer','legacy','empty']); assert.equal(p.data.hasSearch,false)
input('　 \t '); assert.equal(ids().length,6); assert.equal(p.data.hasSearch,false)
const beforeReads = reads
input('阿青'); input('小林'); assert.equal(reads,beforeReads,'typing filters cached records without storage IO')
assert.deepEqual(records.map(r=>r.result),fixtures.map(r=>r.result),'search never changes names or results')
records=[];p.onShow();assert.deepEqual(ids(),[])
const markup=fs.readFileSync(require.resolve('../../pages/game/history.wxml'),'utf8')
assert.equal((markup.match(/<input\b/g)||[]).length,1)
assert.match(markup,/bindinput="onSearchInput"/)
assert.match(markup,/placeholder="输入名字，多个名字用空格分隔"/)
assert.match(markup,/placeholder-class="history-search-placeholder"/)
assert.match(markup,/没有符合条件的对局/)
console.log('History search: partial names, AND semantics, whitespace, duplicates, legacy, favorite intersection, empty state and no search writes passed.')
