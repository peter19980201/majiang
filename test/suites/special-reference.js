const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { SPECIAL_SECTIONS } = require('../../utils/special-reference')
const T = require('../../utils/tiles')
const Round = require('../../utils/game-round')
const cards = SPECIAL_SECTIONS.flatMap(s => s.cards)
assert.deepStrictEqual(cards.map(c => c.id), ['dora','aka','ura','nuki','nagashi','exhaustive','abortive'])
assert.deepStrictEqual(SPECIAL_SECTIONS.map(s => s.title), ['宝牌说明', '流局处理'])
assert.deepStrictEqual(SPECIAL_SECTIONS[1].cards.map(c => c.id), ['nagashi','exhaustive','abortive'])
const get = id => cards.find(c => c.id === id)
for (const card of cards) {
  assert(card.rules.length && card.example && card.notes.length)
  for (const illustration of card.illustrations || []) assert(illustration.tiles.every(t => t.tid >= 0 && t.tid < 34))
}
// 人工固定示例与既有计分接口对照；预期不得从被测函数生成。
assert.strictEqual(T.doraFromIndicator(2), 3)
assert.strictEqual(T.countDora([3,3], [2]), 2)
assert.strictEqual(T.countDora([13], [12], [true]), 2)
assert.strictEqual(get('aka').illustrations[1].tiles[0].extra, 'red5')
assert.strictEqual(T.countDora([27,27], [30]), 2)
assert.strictEqual(T.doraFromIndicator(0, 3), 8)
assert.strictEqual(T.doraFromIndicator(8, 3), 0)
assert.strictEqual(T.countDora([30,30], [29], null, 3) + 2, 4)
assert.strictEqual(get('nagashi').river.length, 18)
assert(get('nagashi').river.every(t => T.isYaochu(t.tid) && !t.extra))
assert(get('nagashi').river.every(t => get('nagashi').river.filter(x => x.tid === t.tid).length <= 4))
assert(!JSON.stringify(get('nagashi')).includes('反例'))
assert.deepStrictEqual(Round.nagashiTransfers([true,false,false,false],0), [12000,-4000,-4000,-4000])
assert.deepStrictEqual(Round.nagashiTransfers([false,true,false,false],0), [-4000,8000,-2000,-2000])
assert.deepStrictEqual(Round.nagashiTransfers([true,false,false],0), [8000,-4000,-4000])
assert.deepStrictEqual(Round.nagashiTransfers([false,true,false],0), [-4000,6000,-2000])
assert.deepStrictEqual(Round.drawTransfers([true,true,false,false]), [1500,1500,-1500,-1500])
assert.deepStrictEqual(Round.drawTransfers([true,false,false]), [2000,-1000,-1000])
assert.deepStrictEqual(Round.drawTransfers([true,true,false]), [1000,1000,-2000])
assert.deepStrictEqual(Round.drawTransfers([true,false,false,false],true), [0,0,0,0])
assert(get('nagashi').notes.some(s => s.includes('不计本场支付') && s.includes('本场数加1')))
assert(get('abortive').notes.some(s => s.includes('庄家连庄')))
assert.deepStrictEqual(get('abortive').rows.map(r => r.label), ['九种九牌','四风连打','四家立直','四杠散了','三家和'])
assert(get('abortive').rules.some(s => s.includes('三麻只提供九种九牌、四杠散了')))
// 固定13番实例实际可以和牌，四项役种及宝牌恰好构成所述合计。
const { calculate } = require('../../utils/calculator')
const kazoe = calculate({hand:T.parseTiles('11223345667m55m'), agariTile:7, melds:[], context:{agariType:'ron',bakaze:27,jikaze:28,riichi:true,dora:[8,8]}})
assert.strictEqual(kazoe.han,13)
assert.strictEqual(kazoe.level,'累计役满')
assert.strictEqual(kazoe.payment.total,32000)
assert.deepStrictEqual(Object.fromEntries(kazoe.yaku.map(y=>[y.name,y.han])), {'立直':1,'平和':1,'一杯口':1,'清一色':6,'宝牌':4})
// 各档固定支付预期：四麻闲/庄荣和、闲家/庄家自摸支付及三麻总额。
const { calculateScore, calculatePayment } = require('../../utils/score')
assert.strictEqual(get('kazoe'), undefined, '档位说明仅保留在点数速查')
const limits = [
  ['满贯',5,2000,8000,12000,2000,4000,8000,12000,6000,8000],
  ['跳满',6,3000,12000,18000,3000,6000,12000,18000,9000,12000],
  ['倍满',8,4000,16000,24000,4000,8000,16000,24000,12000,16000],
  ['三倍满',11,6000,24000,36000,6000,12000,24000,36000,18000,24000],
  ['累计役满',13,8000,32000,48000,8000,16000,32000,48000,24000,32000],
  ['役满',-1,8000,32000,48000,8000,16000,32000,48000,24000,32000],
  ['多倍役满',-2,16000,64000,96000,16000,32000,64000,96000,48000,64000]
]
limits.forEach(([name,han,base,ronKo,ronOya,ko,oya,total4Ko,total4Oya,total3Ko,total3Oya],i) => {
  assert.strictEqual(calculateScore(30,han,han < 0 ? [{isYakuman:true,yakumanTimes:-han}] : []).basePoints,base)
  for(const players of [3,4]) {
    assert.strictEqual(calculatePayment(base,false,false,0,players).total,ronKo)
    assert.strictEqual(calculatePayment(base,true,false,0,players).total,ronOya)
    assert.strictEqual(calculatePayment(base,false,true,0,players).total,players===3?total3Ko:total4Ko)
    assert.strictEqual(calculatePayment(base,true,true,0,players).total,players===3?total3Oya:total4Oya)
  }
})
for(const [han,fu,base] of [[3,60,1920],[3,70,2000],[4,25,1600],[4,30,2000],[4,40,2000],[7,30,3000],[10,30,4000],[12,30,6000],[26,30,8000]]) assert.strictEqual(calculateScore(fu,han,[]).basePoints,base)
assert.strictEqual(calculateScore(0,-1,[{isYakuman:true,yakumanTimes:2},{isYakuman:true,yakumanTimes:1}]).basePoints,24000)
let definition
global.Page = value => {definition=value}
global.wx = {showShareMenu(){},setStorageSync(){throw new Error('规则页不能写存档')}}
require('../../pages/reference/reference')
const page = {...definition,data:JSON.parse(JSON.stringify(definition.data)),setData(v){Object.assign(this.data,v)}}
page.onLoad()
const tab = value => page.selectRulesTab({currentTarget:{dataset:{tab:value}}})
const expand = id => page.onSpecialTap({currentTarget:{dataset:{id}}})
page.onKeywordInput({detail:{value:'平和'}})
page.onExpandTap({currentTarget:{dataset:{idx:0}}})
tab('special');assert.strictEqual(page.data.rulesTab,'special')
for (const card of cards) {
  expand(card.id); assert.strictEqual(page.data.expandedSpecial,card.id)
  assert.strictEqual(page.data.visitedSpecial[card.id],true)
  expand(card.id); assert.strictEqual(page.data.expandedSpecial,'')
}
expand('nagashi');expand('unknown');assert.strictEqual(page.data.expandedSpecial,'nagashi')
tab('points');tab('special');assert.strictEqual(page.data.expandedSpecial,'nagashi')
tab('invalid');assert.strictEqual(page.data.rulesTab,'special')
tab('yaku');assert.strictEqual(page.data.keyword,'平和');assert.strictEqual(page.data.filteredYaku.length,1);assert.strictEqual(page.data.expandedIndex,0)
const read = f => fs.readFileSync(path.resolve(__dirname,'../..',f),'utf8')
const wxml = read('pages/reference/reference.wxml')
for (const binding of ['data-tab="special"', "rulesTab !== 'special'", 'card.river', 'card.illustrations', 'tileData.extra', 'card.rules', 'card.notes', 'card.rows', 'card.example', 'onSpecialTap']) assert(wxml.includes(binding),binding)
assert(wxml.includes("rulesTab === 'points' ? 100 : 200"))
assert(!wxml.includes('limit-guide'))
assert(read('components/points-table/table.wxml').includes('{{item.level}}'), '保留点数速查档位展示')
assert(wxml.includes("<view class=\"detail-section\" wx:if=\"{{card.id !== 'abortive'}}\"><text class=\"detail-label\">{{section.title"), '途中流局不展示底部处理方式区块')
assert(read('pages/reference/reference.wxss').includes('width:calc((100% - 8rpx) / 3)'))
assert(read('pages/reference/reference.wxss').includes('grid-template-columns:repeat(6, 64rpx)'))
console.log('宝牌及流局：7卡片、三栏状态、有效累计役满实例、舍牌河、三四麻流局支付及页面绑定通过。')
