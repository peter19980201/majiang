// 人工编排实例的固定目标预期；不用计分器生成 expected。
// 规则来源：项目采用的门前/副露番数、双倍役满规则；基本牌型按四面子一雀头、七对子、国士定义。
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { YAKU_DATA } = require('../../utils/yaku-data')
const { examples } = require('../../utils/yaku-examples')
const { prepareExample } = require('../../utils/yaku-example-view')
const { calculate } = require('../../utils/calculator')
const { decompose } = require('../../utils/decompose')
const T = require('../../utils/tiles')
const expected = {
  '立直': [1], '一发': [1], '门前清自摸和': [1], '平和': [1], '一杯口': [1], '断幺九': [1],
  '役牌:白': [1], '役牌:发': [1], '役牌:中': [1], '役牌:场风': [1], '役牌:自风': [1],
  '海底摸月': [1], '河底捞鱼': [1], '岭上开花': [1], '抢杠': [1], '双立直': [2],
  '七对子': [2], '三色同顺': [2], '一气通贯': [1], '混全带幺九': [2], '对对和': [2],
  '三暗刻': [2], '三色同刻': [2], '混老头': [2], '小三元': [2], '三杠子': [2],
  '二杯口': [3], '纯全带幺九': [3], '混一色': [3], '清一色': [6],
  '天和': [-1], '地和': [-1], '国士无双': [-1, -2], '四暗刻': [-1, -2],
  '大三元': [-1], '字一色': [-1], '绿一色': [-1], '清老头': [-1], '小四喜': [-1],
  '大四喜': [-2], '四杠子': [-1], '九莲宝灯': [-1, -2]
}
const variants = { '国士无双': '国士无双十三面', '四暗刻': '四暗刻单骑', '九莲宝灯': '纯正九莲宝灯' }
function parse(text) {
  // 严格独立解析，防止生产解析器静默吞掉重复m等非法字符。
  assert.strictEqual(typeof text, 'string')
  const tokens = text.match(/[1-9]+[mps]|[東南西北白发中]/g) || []
  assert.strictEqual(tokens.join(''), text, `非法牌串 ${text}`)
  const ids = tokens.flatMap(token => token.length === 1 ? [27 + '東南西北白发中'.indexOf(token)] :
    [...token.slice(0, -1)].map(n => Number(n) - 1 + 9 * 'mps'.indexOf(token.at(-1))))
  assert.deepStrictEqual(T.parseTiles(text), ids)
  return ids
}
const sorted = a => a.slice().sort((a,b) => a-b)
function input(e, context = {}) {
  return { hand: parse(e.hand), agariTile: parse(e.agari)[0], melds: e.melds.map(m => ({...m, tiles: parse(m.tiles)})), context: {...e.context, ...context} }
}
function has(e, target, context) { return (calculate(input(e, context)).yaku || []).some(y => y.name === target) }
const snapshot = JSON.stringify(YAKU_DATA)
assert.strictEqual(YAKU_DATA.length, 42)
assert.deepStrictEqual(sorted(YAKU_DATA.map(y => y.name)), sorted(Object.keys(expected)))
assert.deepStrictEqual(sorted(Object.keys(examples)), sorted(Object.keys(expected)))
let count = 0
for (const y of YAKU_DATA) {
  assert.strictEqual(y.examples.length, expected[y.name].length, y.name)
  assert.strictEqual(y.example, y.examples[0])
  for (const [index, e] of y.examples.entries()) {
    count++
    const tag = `${y.name}/${index}`
    assert(e.note && e.title && y.condition, tag)
    const groups = e.groups.map(parse), hand = parse(e.hand), win = parse(e.agari)
    assert.strictEqual(win.length, 1, tag)
    const meldTiles = e.melds.flatMap(m => parse(m.tiles))
    const all = groups.flat().concat(meldTiles)
    assert.deepStrictEqual(sorted(hand.concat(win)), sorted(groups.flat()), tag)
    assert.strictEqual(groups[e.winningGroup][e.winningIndex], win[0], tag)
    const kans = e.melds.filter(m => ['minkan', 'ankan', 'kakan'].includes(m.type)).length
    assert.strictEqual(all.length, 14 + kans, tag)
    assert(all.every(t => all.filter(x => x === t).length <= 4), tag)
    for (const m of e.melds) {
      const ts = parse(m.tiles)
      if (m.type === 'chi') { assert.strictEqual(ts.length, 3); assert.strictEqual(ts[2], ts[0] + 2); assert.strictEqual(ts[1], ts[0] + 1); assert.strictEqual(Math.floor(ts[0]/9), Math.floor(ts[2]/9)) }
      else { assert(['pon','minkan','ankan','kakan'].includes(m.type)); assert.strictEqual(ts.length, m.type === 'pon' ? 3 : 4); assert(ts.every(t => t === ts[0])) }
    }
    if (e.shape === 'regular') {
      assert.strictEqual(groups.length + e.melds.length, 5, tag)
      assert.strictEqual(groups.filter(g => g.length === 2).length, 1, tag)
      for (const g of groups) {
        if (g.length === 2) assert.strictEqual(g[0], g[1], tag)
        else { assert.strictEqual(g.length, 3, tag); assert(g.every(t => t === g[0]) || (g[0] < 27 && Math.floor(g[0]/9) === Math.floor(g[2]/9) && g[1] === g[0]+1 && g[2] === g[0]+2), tag) }
      }
    } else if (e.shape === 'pairs') {
      assert.strictEqual(groups.length, 7); assert.strictEqual(new Set(all).size, 7)
      assert(groups.every(g => g.length === 2 && g[0] === g[1]))
    } else {
      assert.strictEqual(e.shape, 'kokushi')
      assert.deepStrictEqual(sorted([...new Set(all)]), [0,8,9,17,18,26,27,28,29,30,31,32,33])
    }
    const result = calculate(input(e))
    assert(!result.error, `${tag}: ${result.error}`)
    const name = index ? variants[y.name] : y.name
    const actual = result.yaku.find(r => r.name === name)
    assert(actual, `${tag}: 必须成立 ${name}`)
    assert.strictEqual(actual.isYakuman ? -actual.yakumanTimes : actual.han, expected[y.name][index], tag)
    const view = prepareExample(e)
    assert.strictEqual(view.count, all.length, tag)
    assert.deepStrictEqual(view.groups.map(g => g.tiles.map(t => t.tid)), groups, tag)
    assert.deepStrictEqual(view.melds.flatMap(m => m.tiles), meldTiles, tag)
    const winners = view.groups.flatMap(g => g.tiles).filter(t => t.winning)
    assert.strictEqual(winners.length, 1, tag)
    assert.strictEqual(winners[0].tid, win[0], tag)
    assert(view.winLabel.includes(T.tileName(win[0])))
    assert.strictEqual(view.state[0], e.melds.some(m => m.type !== 'ankan') ? '副露' : '门前')
    assert(view.state[1].includes(T.tileName(e.context.bakaze)) && view.state[1].includes(T.tileName(e.context.jikaze)))
    if (y.menzenOnly) assert(e.melds.every(m => m.type === 'ankan'), tag)
  }
}
assert.strictEqual(count, 45)
const kanView = prepareExample(examples['三杠子'][0])
assert.deepStrictEqual(kanView.melds.map(m => m.label), ['明杠', '暗杠 · 不破门前', '加杠'])
const allConcealedKans = {...examples['三杠子'][0], melds:examples['三杠子'][0].melds.map(m => ({...m, type:'ankan'}))}
assert.strictEqual(prepareExample(allConcealedKans).state[0], '门前')
const ronTriplet = {...examples['四暗刻'][0], context:{...examples['四暗刻'][0].context, agariType:'ron'}}
assert.strictEqual(prepareExample(ronTriplet).groups[3].label, '荣和成刻 · 非暗刻')
assert.strictEqual(JSON.stringify(YAKU_DATA), snapshot, '展示准备不得修改示例')
// 固定听牌预期，防止“双面/单骑/十三面/九面”的文字与牌例再次错位。
function waits(e) {
  const i = input(e)
  return Array.from({length:34}, (_,t) => t).filter(t => {
    const all = i.hand.concat(t, ...i.melds.map(m => m.tiles))
    return all.filter(x => x === t).length <= 4 && decompose(i.hand.concat(t), i.melds).length
  })
}
assert.deepStrictEqual(waits(examples['立直'][0]), [18,21])
assert.deepStrictEqual(waits(examples['平和'][0]), [9,12])
assert.deepStrictEqual(waits(examples['七对子'][0]), [26])
assert.deepStrictEqual(waits(examples['四暗刻'][0]), [15,19])
assert.deepStrictEqual(waits(examples['四暗刻'][1]), [19])
assert.deepStrictEqual(waits(examples['国士无双'][0]), [33])
assert.deepStrictEqual(waits(examples['国士无双'][1]), [0,8,9,17,18,26,27,28,29,30,31,32,33])
assert.deepStrictEqual(waits(examples['九莲宝灯'][1]), [0,1,2,3,4,5,6,7,8])
assert(!has(examples['四暗刻'][0], '四暗刻', { agariType:'ron' }), '双碰荣和不能算四暗刻')
assert(has(examples['四暗刻'][1], '四暗刻单骑', { agariType:'tsumo' }))
assert(!has(examples['二杯口'][0], '七对子'))
assert(!has(examples['二杯口'][0], '一杯口'))
for (const [name, flag] of [['立直','riichi'], ['一发','ippatsu'], ['双立直','doubleRiichi'], ['海底摸月','haitei'], ['河底捞鱼','haitei'], ['岭上开花','rinshan'], ['抢杠','chankan'], ['天和','tenhou'], ['地和','chihou']]) {
  const e = examples[name][0]
  assert(e.situation, name)
  assert(!has(e, name, { [flag]:false }), `${name}: 移除情境后不得成立`)
}
assert(!has(examples['门前清自摸和'][0], '门前清自摸和', {agariType:'ron'}))
assert(!has(examples['役牌:场风'][0], '役牌:场风', {bakaze:29}))
assert(!has(examples['役牌:自风'][0], '役牌:自风', {jikaze:29}))
// 已发现的旧错误应继续被拒绝，不能靠展示或宽松解析掩盖。
assert.throws(() => parse('11123456789mm'))
for (const hand of ['234m567p11s2s', '123m456p789s23p1p', '111m333p555s77p7p', '112233m556677p7p']) assert.strictEqual(decompose(parse(hand), []).length, 0)
// 实际页面加载、展开、筛选后仍保留全部示例与副露。
let definition
global.Page = value => { definition = value }
global.wx = { showShareMenu() {} }
require('../../pages/reference/reference')
const page = {...definition, data:JSON.parse(JSON.stringify(definition.data)), setData(v){Object.assign(this.data,v)}}
page.onLoad()
for (let i = 0; i < page.data.filteredYaku.length; i++) {
  page.onExpandTap({currentTarget:{dataset:{idx:i}}})
  assert.strictEqual(page.data.expandedIndex, i)
  assert.deepStrictEqual(page.data.filteredYaku[i]._examples, YAKU_DATA[i].examples.map(prepareExample))
}
page.onKeywordInput({detail:{value:'四暗刻'}})
assert.strictEqual(page.data.filteredYaku.length, 1)
assert.strictEqual(page.data.filteredYaku[0]._examples.length, 2)
page.onClearKeyword()
assert.strictEqual(page.data.filteredYaku.length, 42)
const markup = fs.readFileSync(path.resolve(__dirname,'../../pages/reference/reference.wxml'),'utf8')
for (const binding of ['item._examples', 'example.groups', 'example.melds', 'meld.tiles', 'tileData.winning', 'example.situation', 'example.note', 'example.winLabel', 'example.state']) assert(markup.includes(binding), binding)
assert(markup.includes('手牌（含和了牌）') && markup.includes('本例为何成立'))
console.log('42役种 / 45实例：严格牌串、数量/四枚上限、分组、目标役与番数、听牌及情境反例、页面展示全部通过。')
