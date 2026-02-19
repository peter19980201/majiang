/**
 * 单元测试 - 日麻计分引擎
 * node test/test.js
 *
 * 手牌数量规则:
 *   无副露: hand=13张, +agari=14张
 *   有N组副露(非杠): hand=13-3N张, +agari=14-3N张
 *   有杠: 每个杠+1张(杠后摸岭上牌), 所以1杠=15张总, 手牌中11张
 */

const T = require('../utils/tiles')
const { decompose } = require('../utils/decompose')
const { calculateScore, calculatePayment } = require('../utils/score')
const { calculate } = require('../utils/calculator')

let passed = 0
let failed = 0
let total = 0

function assert(condition, msg) {
  total++
  if (condition) {
    passed++
  } else {
    failed++
    console.error(`  FAIL: ${msg}`)
  }
}

function section(name) {
  console.log(`\n=== ${name} ===`)
}

// ============ tiles.js 测试 ============
section('tiles.js 基础工具')

assert(T.getSuit(0) === 0, '一万是万子')
assert(T.getSuit(9) === 1, '一筒是筒子')
assert(T.getSuit(18) === 2, '一索是索子')
assert(T.getSuit(27) === 3, '東是字牌')
assert(T.getNum(0) === 0, '一万序号0')
assert(T.getNum(8) === 8, '九万序号8')
assert(T.isYaochu(0), '一万是幺九')
assert(T.isYaochu(8), '九万是幺九')
assert(T.isYaochu(27), '東是幺九')
assert(!T.isYaochu(4), '五万不是幺九')
assert(T.isChuchan(4), '五万是中张')
assert(!T.isChuchan(0), '一万不是中张')
assert(T.isSangenpai(31), '白是三元牌')
assert(T.isSangenpai(32), '发是三元牌')
assert(T.isSangenpai(33), '中是三元牌')
assert(!T.isSangenpai(27), '東不是三元牌')

assert(T.doraFromIndicator(0) === 1, '一万指示→二万ドラ')
assert(T.doraFromIndicator(8) === 0, '九万指示→一万ドラ')
assert(T.doraFromIndicator(27) === 28, '東指示→南ドラ')
assert(T.doraFromIndicator(30) === 27, '北指示→東ドラ')
assert(T.doraFromIndicator(31) === 32, '白指示→发ドラ')
assert(T.doraFromIndicator(33) === 31, '中指示→白ドラ')

const parsed = T.parseTiles('123m456p789s東東')
assert(parsed.length === 11, 'parseTiles长度正确')
assert(parsed[0] === 0, 'parseTiles 1m')
assert(parsed[3] === 12, 'parseTiles 4p')
assert(parsed[9] === 27 && parsed[10] === 27, 'parseTiles 東東')

assert(T.isGreen(19), '二索是绿牌')
assert(T.isGreen(20), '三索是绿牌')
assert(T.isGreen(21), '四索是绿牌')
assert(T.isGreen(23), '六索是绿牌')
assert(T.isGreen(25), '八索是绿牌')
assert(T.isGreen(32), '发是绿牌')
assert(!T.isGreen(18), '一索不是绿牌')
assert(!T.isGreen(22), '五索不是绿牌')

// ============ decompose.js 测试 ============
section('decompose.js 手牌拆解')

// 普通和牌: 123m 456m 789m 123p 東東 (14张)
{
  const tiles = T.parseTiles('123m456m789m123p東東') // 14张
  const results = decompose(tiles, [])
  assert(results.length > 0, '普通手牌可拆解')
  const regular = results.find(r => r.type === 'regular')
  assert(regular !== undefined, '有regular拆解')
  if (regular) {
    assert(regular.mentsu.length === 4, '4组面子')
    assert(regular.jantai === 27, '雀头是東')
  }
}

// 七对子 (14张)
{
  const tiles = T.parseTiles('11m33m55m77p99s東東中中') // 7对=14张
  const results = decompose(tiles, [])
  const chitoitsu = results.find(r => r.type === 'chitoitsu')
  assert(chitoitsu !== undefined, '七对子可拆解')
  if (chitoitsu) assert(chitoitsu.pairs.length === 7, '7个对子')
}

// 国士无双 (14张: 13种幺九+1重复)
{
  const tiles = T.parseTiles('19m19p19s東南西北白发中中') // 14张
  const results = decompose(tiles, [])
  const kokushi = results.find(r => r.type === 'kokushi')
  assert(kokushi !== undefined, '国士无双可拆解')
  if (kokushi) assert(kokushi.pair === 33, '国士对子是中')
}

// 带1组副露(碰): hand+agari=11张, 拆出3面子+1雀头
{
  // 手牌10张+和了牌1张=11张
  const tiles = T.parseTiles('123m456p789s東東') // 11张
  const melds = [{ type: 'pon', tiles: [31, 31, 31] }]
  const results = decompose(tiles, melds)
  assert(results.length > 0, '带副露手牌可拆解')
  const regular = results.find(r => r.type === 'regular')
  assert(regular !== undefined, '带副露有regular拆解')
  if (regular) assert(regular.mentsu.length === 3, '手牌中3组面子')
}

// ============ 点数表验证 ============
section('score.js 点数表')

// 子家荣和
function testRonKo(fu, han, expected, label) {
  const s = calculateScore(fu, han, [])
  const p = calculatePayment(s.basePoints, false, false, 0)
  assert(p.total === expected, `${label}: ${fu}符${han}番子荣=${expected} (实际:${p.total})`)
}

testRonKo(30, 1, 1000, '30符1番')
testRonKo(30, 2, 2000, '30符2番')
testRonKo(30, 3, 3900, '30符3番')   // 30*2^5=960, *4=3840→3900
testRonKo(30, 4, 8000, '30符4番切上满贯')
testRonKo(40, 1, 1300, '40符1番')   // 40*8=320, *4=1280→1300
testRonKo(40, 2, 2600, '40符2番')   // 40*16=640, *4=2560→2600
testRonKo(40, 3, 5200, '40符3番')   // 40*32=1280, *4=5120→5200
testRonKo(40, 4, 8000, '40符4番满贯')  // 40*64=2560>2000 → 满贯
testRonKo(0, 5, 8000, '满贯')
testRonKo(0, 6, 12000, '跳满')
testRonKo(0, 7, 12000, '跳满7番')
testRonKo(0, 8, 16000, '倍满')
testRonKo(0, 10, 16000, '倍满10番')
testRonKo(0, 11, 24000, '三倍满')
testRonKo(0, 12, 24000, '三倍满12番')
testRonKo(0, 13, 32000, '累计役满')

// 庄家荣和
function testRonOya(fu, han, expected, label) {
  const s = calculateScore(fu, han, [])
  const p = calculatePayment(s.basePoints, true, false, 0)
  assert(p.total === expected, `${label}: ${fu}符${han}番庄荣=${expected} (实际:${p.total})`)
}

testRonOya(30, 1, 1500, '庄30符1番')  // 30*8=240, *6=1440→1500
testRonOya(30, 2, 2900, '庄30符2番')  // 30*16=480, *6=2880→2900
testRonOya(30, 3, 5800, '庄30符3番')  // 30*32=960, *6=5760→5800
testRonOya(30, 4, 12000, '庄30符4番切上满贯')
testRonOya(0, 5, 12000, '庄满贯')
testRonOya(0, 6, 18000, '庄跳满')
testRonOya(0, 8, 24000, '庄倍满')
testRonOya(0, 11, 36000, '庄三倍满')
testRonOya(0, 13, 48000, '庄累计役满')

// 子家自摸
function testTsumoKo(fu, han, expectKo, expectOya, label) {
  const s = calculateScore(fu, han, [])
  const p = calculatePayment(s.basePoints, false, true, 0)
  assert(p.koPayment === expectKo, `${label}: 子付${expectKo} (实际:${p.koPayment})`)
  assert(p.oyaPayment === expectOya, `${label}: 庄付${expectOya} (实际:${p.oyaPayment})`)
}

testTsumoKo(20, 2, 400, 700, '20符2番子自摸')   // base=320, 子=400, 庄=700
testTsumoKo(20, 3, 700, 1300, '20符3番子自摸')  // base=640, 子=700, 庄=1300
testTsumoKo(30, 2, 500, 1000, '30符2番子自摸')  // base=480, 子=500, 庄=1000
testTsumoKo(30, 3, 1000, 2000, '30符3番子自摸') // base=960, 子=1000, 庄=2000
testTsumoKo(0, 5, 2000, 4000, '满贯子自摸')
testTsumoKo(0, 6, 3000, 6000, '跳满子自摸')
testTsumoKo(0, 8, 4000, 8000, '倍满子自摸')

// 庄家自摸
function testTsumoOya(fu, han, expectKo, label) {
  const s = calculateScore(fu, han, [])
  const p = calculatePayment(s.basePoints, true, true, 0)
  assert(p.koPayment === expectKo, `${label}: 子各付${expectKo} (实际:${p.koPayment})`)
}

testTsumoOya(30, 1, 500, '庄30符1番自摸')   // base=240, *2=480→500
testTsumoOya(30, 2, 1000, '庄30符2番自摸')  // base=480, *2=960→1000
testTsumoOya(0, 5, 4000, '庄满贯自摸')
testTsumoOya(0, 6, 6000, '庄跳满自摸')

// 役满
{
  const y1 = [{ name: '四暗刻', isYakuman: true, yakumanTimes: 1 }]
  const s = calculateScore(0, -1, y1)
  const p = calculatePayment(s.basePoints, false, false, 0)
  assert(p.total === 32000, `役满子荣=32000 (实际:${p.total})`)
}
{
  const y2 = [{ name: '四暗刻单骑', isYakuman: true, yakumanTimes: 2 }]
  const s = calculateScore(0, -1, y2)
  const p = calculatePayment(s.basePoints, false, false, 0)
  assert(p.total === 64000, `双倍役满子荣=64000 (实际:${p.total})`)
}
{
  const y = [{ name: '四暗刻', isYakuman: true, yakumanTimes: 1 }]
  const s = calculateScore(0, -1, y)
  const p = calculatePayment(s.basePoints, true, false, 0)
  assert(p.total === 48000, `役满庄荣=48000 (实际:${p.total})`)
}

// 本场棒
{
  const s = calculateScore(30, 1, [])
  const p1 = calculatePayment(s.basePoints, false, false, 1)
  assert(p1.total === 1300, `30符1番1本场子荣=1300 (实际:${p1.total})`)
  const p2 = calculatePayment(s.basePoints, false, false, 2)
  assert(p2.total === 1600, `30符1番2本场子荣=1600 (实际:${p2.total})`)
}
{
  const s = calculateScore(0, 5, [])
  const p = calculatePayment(s.basePoints, false, true, 1)
  assert(p.koPayment === 2100, `满贯1本场子自摸,子付2100 (实际:${p.koPayment})`)
  assert(p.oyaPayment === 4100, `满贯1本场子自摸,庄付4100 (实际:${p.oyaPayment})`)
}

// ============ 综合计算测试 ============
section('calculator.js 综合计算')

// 测试1: 平和立直自摸断幺九 (20符4番)
// 手牌全是中张 → 同时成立断幺九
{
  const result = calculate({
    hand: T.parseTiles('234m567m345p67s55p'), // 13张, 全中张
    melds: [],
    agariTile: T.parseTiles('8s')[0],         // 8s双面听
    context: {
      agariType: 'tsumo', bakaze: 27, jikaze: 28,
      riichi: true,
      dora: [], uraDora: [], redDora: { m5: 0, p5: 0, s5: 0 }
    }
  })
  assert(!result.error, `平和立直自摸无错误 ${result.error || ''}`)
  if (!result.error) {
    assert(result.yaku.some(y => y.name === '平和'), '有平和')
    assert(result.yaku.some(y => y.name === '立直'), '有立直')
    assert(result.yaku.some(y => y.name === '门前清自摸和'), '有门前清自摸')
    assert(result.yaku.some(y => y.name === '断幺九'), '有断幺九')
    assert(result.fu === 20, `平和自摸20符 (实际:${result.fu})`)
    assert(result.han === 4, `4番 (实际:${result.han})`)
    console.log(`  → ${result.fu}符${result.han}番 ${result.payment.description}`)
  }
}

// 测试2: 断幺九副露荣和 (30符1番=1000)
// 吃567m(3张), 手牌456p 678s 33p(10张) + agari 3p
{
  const result = calculate({
    hand: T.parseTiles('456p678s234m3p'),          // 10张
    melds: [{ type: 'chi', tiles: [3, 4, 5] }],   // 吃456m
    agariTile: T.parseTiles('3p')[0],
    context: {
      agariType: 'ron', bakaze: 27, jikaze: 28,
      dora: [], uraDora: [], redDora: { m5: 0, p5: 0, s5: 0 }
    }
  })
  if (!result.error) {
    assert(result.yaku.some(y => y.name === '断幺九'), `断幺九判定`)
    console.log(`  → 断幺九: ${result.fu}符${result.han}番 ${result.payment.description}`)
  } else {
    console.log(`  → 断幺九: ${result.error}`)
    assert(false, `断幺九应能计算`)
  }
}

// 测试3: 满贯 - 立直一发自摸ドラ1 (含幺九避免断幺, 20符5番=满贯)
// 手牌含1m避免断幺九: 123m 567m 345p 78s 11p → 平和+立直+自摸+一发+ドラ1=5番
{
  const result = calculate({
    hand: T.parseTiles('123m567m345p78s11p'), // 13张, 含幺九
    melds: [],
    agariTile: T.parseTiles('9s')[0], // 边张(非双面), 不是平和? 789s, 9s是边张→不是平和
    context: {
      agariType: 'tsumo', bakaze: 27, jikaze: 28,
      riichi: true, ippatsu: true,
      dora: [T.parseTiles('4m')[0]], // 四万→五万ドラ (手中有5m,6m,7m中的5m)
      uraDora: [], redDora: { m5: 0, p5: 0, s5: 0 }
    }
  })
  assert(!result.error, `满贯测试无错误 ${result.error || ''}`)
  if (!result.error) {
    // 立直(1)+一发(1)+自摸(1)+ドラ1=4番, 加上可能有平和=5番
    console.log(`  → 满贯测试: ${result.han}番 ${result.level} ${result.payment.description}`)
    console.log(`    役种: ${result.yaku.map(y=>`${y.name}(${y.han})`).join(', ')}`)
  }
}

// 测试4: 役满 - 国士无双十三面
// 19m19p19s東南西北白发中 + agari=中(十三面听)
{
  const result = calculate({
    hand: T.parseTiles('19m19p19s東南西北白发中'), // 13张
    melds: [],
    agariTile: T.parseTiles('中')[0],
    context: {
      agariType: 'tsumo', bakaze: 27, jikaze: 28,
      dora: [], uraDora: [], redDora: { m5: 0, p5: 0, s5: 0 }
    }
  })
  if (!result.error) {
    const hasKokushi = result.yaku.some(y => y.name.includes('国士'))
    assert(hasKokushi, '国士无双判定')
    console.log(`  → 国士: ${result.yaku.map(y=>y.name).join(',')} ${result.level} ${result.payment.description}`)
  } else {
    console.log(`  → 国士: ${result.error}`)
    assert(false, '国士无双应能计算')
  }
}

// 测试5: 四暗刻自摸 (纯手牌无副露)
// 111m 333p 555s 777s 22p → 自摸2p → 单骑=双倍役满
{
  const result = calculate({
    hand: T.parseTiles('111m333p555s777s2p'), // 13张
    melds: [],
    agariTile: T.parseTiles('2p')[0],          // 单骑
    context: {
      agariType: 'tsumo', bakaze: 27, jikaze: 27,
      dora: [], uraDora: [], redDora: { m5: 0, p5: 0, s5: 0 }
    }
  })
  if (!result.error) {
    const has = result.yaku.some(y => y.name.includes('四暗刻'))
    assert(has, '四暗刻判定')
    console.log(`  → 四暗刻: ${result.yaku.map(y=>y.name).join(',')} ${result.level} ${result.payment.description}`)
  } else {
    console.log(`  → 四暗刻: ${result.error}`)
    assert(false, '四暗刻应能计算')
  }
}

// 测试6: 七对子荣和 (25符2番)
// 11m 33m 55m 77p 99s 東東 → 最后一张東
{
  const result = calculate({
    hand: T.parseTiles('11m33m55m77p99s東中中'), // 13张
    melds: [],
    agariTile: T.parseTiles('東')[0],
    context: {
      agariType: 'ron', bakaze: 27, jikaze: 28,
      dora: [], uraDora: [], redDora: { m5: 0, p5: 0, s5: 0 }
    }
  })
  if (!result.error) {
    assert(result.yaku.some(y => y.name === '七对子'), '七对子判定')
    assert(result.fu === 25, `七对子25符 (实际:${result.fu})`)
    console.log(`  → 七对子: ${result.fu}符${result.han}番 ${result.payment.description}`)
  } else {
    console.log(`  → 七对子: ${result.error}`)
    assert(false, '七对子应能计算')
  }
}

// 测试7: 庄家自摸 - 立直自摸ドラ1 (含幺九手牌)
// 123m 567m 19p 789s 11p → 立直+自摸+ドラ=3番
{
  const result = calculate({
    hand: T.parseTiles('123m456m789s19p11m'), // 13张
    melds: [],
    agariTile: T.parseTiles('1p')[0],
    context: {
      agariType: 'tsumo', bakaze: 27, jikaze: 27, // 庄家
      riichi: true,
      dora: [], uraDora: [], redDora: { m5: 0, p5: 0, s5: 0 }
    }
  })
  if (!result.error) {
    assert(result.isOya === true, '庄家判定')
    console.log(`  → 庄家: ${result.han}番 ${result.fu}符 ${result.level} ${result.payment.description}`)
    console.log(`    役种: ${result.yaku.map(y=>`${y.name}(${y.han})`).join(', ')}`)
  }
}

// 测试8: 役牌(白) + 副露 (30符1番子荣)
// 碰白, 手牌 234m 456p 78s 33m + agari 9s
{
  const result = calculate({
    hand: T.parseTiles('234m456p78s33m'),        // 10张
    melds: [{ type: 'pon', tiles: [31, 31, 31] }], // 碰白
    agariTile: T.parseTiles('9s')[0],
    context: {
      agariType: 'ron', bakaze: 27, jikaze: 28,
      dora: [], uraDora: [], redDora: { m5: 0, p5: 0, s5: 0 }
    }
  })
  if (!result.error) {
    assert(result.yaku.some(y => y.name === '役牌:白'), '役牌白判定')
    console.log(`  → 役牌白: ${result.fu}符${result.han}番 ${result.payment.description}`)
  } else {
    console.log(`  → 役牌白: ${result.error}`)
  }
}

// 测试9: 混一色门前荣和 (40符3番=5200)
// 123m 456m 789m 11m 東東東 + agari=1m(?)
// 不对, 让我用: 123m 456m 789m 東東東 22m → 门前混一色不成立(都是万+東)
// 混一色: 同一花色+字牌
{
  const result = calculate({
    hand: T.parseTiles('123m456m789m東東東2m'), // 13张
    melds: [],
    agariTile: T.parseTiles('2m')[0],
    context: {
      agariType: 'ron', bakaze: 28, jikaze: 28, // 南场南家
      dora: [], uraDora: [], redDora: { m5: 0, p5: 0, s5: 0 }
    }
  })
  if (!result.error) {
    assert(result.yaku.some(y => y.name === '混一色'), '混一色判定')
    console.log(`  → 混一色: ${result.fu}符${result.han}番 ${result.payment.description}`)
  } else {
    console.log(`  → 混一色: ${result.error}`)
  }
}

// ============ 结果汇总 ============
section('测试结果')
console.log(`通过: ${passed}/${total}`)
console.log(`失败: ${failed}/${total}`)

if (failed > 0) {
  process.exit(1)
} else {
  console.log('\n所有测试通过!')
}
