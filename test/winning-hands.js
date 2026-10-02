/** node test/winning-hands.js [--report] [H001]；零依赖，失败返回非零。 */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const cases = require('./winning-hands.cases')
const { calculate } = require('../utils/calculator')

// 刻意不调用引擎的牌码解析函数，防止解析错误在测试输入中被同步掩盖。
function parse(text = '') {
  const tokens = text.match(/[1-9]+[mps]|[東南西北白发中]/g) || []
  assert.equal(tokens.join(''), text, `非法牌记法: ${text}`)
  return tokens.flatMap(t => t.length === 1 ? [27 + '東南西北白发中'.indexOf(t)] :
    [...t.slice(0, -1)].map(n => 9 * 'mps'.indexOf(t.at(-1)) + Number(n) - 1))
}
function inputFor(c) {
  const hand = parse(c.tiles)
  const win = parse(c.win)
  assert.equal(win.length, 1)
  const at = hand.indexOf(win[0])
  assert(at >= 0, '完整牌型必须含和牌张')
  hand.splice(at, 1)
  const melds = c.melds.map(m => ({ type: m.type, tiles: parse(m.tiles) }))
  for (const m of melds) {
    const kan = ['ankan', 'minkan', 'kakan'].includes(m.type)
    assert.equal(m.tiles.length, kan ? 4 : 3)
    if (m.type === 'chi') {
      assert(m.tiles[0] < 27)
      assert.equal(Math.floor(m.tiles[0] / 9), Math.floor(m.tiles[2] / 9))
      assert.equal(m.tiles[1], m.tiles[0] + 1)
      assert.equal(m.tiles[2], m.tiles[0] + 2)
    } else assert(m.tiles.every(t => t === m.tiles[0]))
  }
  assert.equal(hand.length, 13 - 3 * melds.length, `${c.id} 手牌数量`)
  const context = { honba: 0, ...c.context,
    bakaze: parse(c.context.bakaze)[0], jikaze: parse(c.context.jikaze)[0],
    dora: parse(c.context.dora), uraDora: parse(c.context.uraDora),
    redDora: { m5: 0, p5: 0, s5: 0, ...c.context.redDora } }
  const tiles = [...hand, ...win, ...melds.flatMap(m => m.tiles)]
  const counts = Array(34).fill(0)
  // 指示牌也必须来自同一副实体牌。
  for (const t of [...tiles, ...context.dora, ...context.uraDora]) {
    assert(++counts[t] <= 4, `${c.id} 同一牌超过4张`)
  }
  const kanCount = melds.filter(m => m.tiles.length === 4).length
  assert(context.dora.length <= kanCount + 1, '指示牌数量超过本用例开杠数允许的上限')
  for (const [key, id] of [['m5', 4], ['p5', 13], ['s5', 22]]) {
    assert(context.redDora[key] >= 0 && context.redDora[key] <= 1)
    assert(context.redDora[key] <= tiles.filter(t => t === id).length)
  }
  if (context.riichi || context.doubleRiichi) assert(melds.every(m => m.type === 'ankan'), '立直必须门清')
  if (context.ippatsu) assert(context.riichi || context.doubleRiichi)
  if (context.rinshan) assert(kanCount > 0 && context.agariType === 'tsumo')
  return { hand, melds, agariTile: win[0], context }
}
function check(c) {
  const input = inputFor(c)
  const before = JSON.stringify(input)
  const actual = calculate(input)
  assert.equal(JSON.stringify(input), before, '计算不能修改输入')
  const expected = c.expected
  if (expected.error) {
    assert.equal(actual.error, expected.error, '无役不能和牌，即使有宝牌')
    return actual
  }
  assert.equal(actual.error, undefined, actual.error)
  if (expected.yakuman) {
    assert.equal(actual.han, -1, '引擎役满哨兵')
    assert(actual.yaku.every(y => y.isYakuman), '役满不能叠加普通役或宝牌')
    assert.deepEqual(Object.fromEntries(actual.yaku.map(y => [y.name, y.yakumanTimes])), expected.yakuman, '役满名称/倍数')
    assert.equal(actual.basePoints, 8000 * Object.values(expected.yakuman).reduce((a, b) => a + b, 0))
    // actual.fu 是历史实现的内部值，不是役满的合法计分符数，故不为它编造预期。
  } else {
    assert.deepEqual(Object.fromEntries(actual.yaku.map(y => [y.name, y.han])), expected.yaku, '完整役种及逐役番数')
    assert.equal(actual.yaku.length, Object.keys(expected.yaku).length, '不能重复计算同一役')
    assert.equal(actual.han, expected.han, '总番数')
    assert.equal(actual.fu, expected.fu, `符数：${expected.parts}`)
    if (expected.rawFu !== undefined) {
      assert.equal(actual.fuDetail.reduce((sum, d) => sum + d.fu, 0), expected.rawFu, '取整前符数')
    }
  }
  return actual
}
module.exports = { inputFor, check }
if (require.main === module) {
const selected = process.argv.find(s => /^H\d{3}$/.test(s))
const results = []
for (const c of cases.filter(c => !selected || c.id === selected)) {
  try { check(c); results.push({ c, ok: true }); console.log(`PASS ${c.id} ${c.name}`) }
  catch (e) { results.push({ c, ok: false, error: e.message }); console.error(`FAIL ${c.id} ${c.name}\n${e.message}`) }
}
assert(results.length, '未找到用例')
if (process.argv.includes('--report')) {
  assert(!selected, '--report 只能生成完整报告')
  const auditPath = path.join(__dirname, 'winning-hands-oracle-result.json')
  const audit = fs.existsSync(auditPath) ? JSON.parse(fs.readFileSync(auditPath, 'utf8')) : null
  const digest = createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'winning-hands.cases.js'))).digest('hex')
  const audited = audit && audit.casesSha256 === digest && audit.total === cases.length && audit.failed === 0
  const lines = [
    '# 胡牌牌型：番数与符数测试', '',
    '另有 [6000例扩展集与运行报告](winning-hands-expanded.md)，与本文件合计6100例。扩展集运行：`node test/winning-hands-expanded.js`。', '',
    '运行：`node test/winning-hands.js`。刷新报告：`node test/winning-hands.js --report`。单例：`node test/winning-hands.js H001`。失败会返回非零退出码。', '',
    '## 规则与核对方法', '',
    '这是四人日麻测试集，采用本项目约定：允许副露断幺，连风雀头4符，四暗刻单骑/国士十三面/纯正九莲/大四喜为双倍役满，役满可复合，13番起累计役满。它不是适用于所有日麻规则的通用答案表。', '',
    '普通役和符数核对参考 [WRC 2025 官方规则](https://www.worldriichi.org/wrc-rules) 第11.3、11.5节；双倍役满、连风雀头、赤宝牌等差异明确按项目约定覆盖，不套用WRC整套规则。项目自称参考雀魂，不等同于已验证所有当前雀魂房间设置。', '',
    '期望役种和符数由牌型独立推导并固定在 winning-hands.cases.js，未从被测引擎生成。测试逐一比较完整役种、每役番数、总番数及符数；役满比较名称和倍数。另验证牌数、每种实体牌不超过4张（含指示牌）、副露结构、红牌和场况基本一致性。', '',
    '本文件是牌型计分用例，不证明实际对局的振听、立直时机、一发未中断等过程合法；相应场况视为调用方已经确认。未穷举所有胡牌组合。', '',
    '## 读法', '',
    '`m/p/s` 分别为万/筒/索。表内“完整暗手”已包含和牌张，副露/杠另列；输入引擎前自动移除一张和牌张。暗杠放在杠列表但不破坏门清。默认东场、南家、荣和、无立直、无宝牌、0本场。每例均显示完整场况。', '',
    '字段：chi=吃、pon=碰、minkan=大明杠、kakan=加杠、ankan=暗杠；riichi=立直、doubleRiichi=双立直、ippatsu=一发、haitei=海底/河底、rinshan=岭上、chankan=抢杠、tenhou=天和、chihou=地和。dora/uraDora 填的是宝牌/里宝牌的指示牌；redDora 的 m5/p5/s5 是红五万/筒/索张数。true 表示成立；未列出的场况为否。', '',
    '番数为表中全部役种及宝牌之和。普通手底符20、门清荣和10、自摸2，刻杠/役牌雀头/坏形听牌额外加符，最后向上取整至10；平和自摸固定20、七对子固定25，副露荣和最低30。役满不计番符，程序内部的 -1 番和占位符数不作为规则答案。', '',
    '## 独立交叉核验', '',
    audited ? `独立 Python mahjong ${audit.libraryVersion} 核对：**${audit.total}/${audit.total} 通过**。核对时间：${audit.checkedAt}。用例文件 SHA-256 与保存的核验记录一致。` : '当前用例没有匹配的独立核验记录，请运行独立脚本后刷新本报告。', '',
    '复验脚本：`winning-hands-oracle.py`；记录：`winning-hands-oracle-result.json`。该脚本不导入项目引擎。它把副露、和牌张、宝牌和风位转换为独立库格式，比较完整役种、番数与符数或役满倍数；有效里宝牌在独立库中与普通宝牌合并后对比。', '',
    '复验步骤（需要 Python、Node 和首次安装时的网络）：', '',
    '```sh', 'python3 -m venv /tmp/majiang-oracle-venv',
    '/tmp/majiang-oracle-venv/bin/python -m pip install mahjong==1.4.0',
    '/tmp/majiang-oracle-venv/bin/python test/winning-hands-oracle.py --report',
    'node test/winning-hands.js --report', '```', '',
    '## 运行结果', '',
    `本次：${results.filter(r => r.ok).length}/${results.length} 通过。以下状态是生成报告时的快照。`, '',
    '失败编号：' + (results.filter(r => !r.ok).map(r => r.c.id).join('、') || '无') + '。', '',
    ...(results.some(r => !r.ok && ['H082', 'H083'].includes(r.c.id)) ? [
      '国士用例说明：去掉和牌张后，十三种幺九各一张才是十三面，成牌时和牌张成为对子；普通单面在和牌前已有对子、缺另一种幺九。目前 utils/yaku.js 的这两个分支判反，H082/H083保留正确预期用于暴露问题。本次只新增测试资料，未修改业务引擎。', ''
    ] : [])
  ]
  for (const { c, ok, error } of results) {
    const e = c.expected
    const ctx = c.context
    const flags = Object.entries(ctx).filter(([k]) => !['agariType', 'bakaze', 'jikaze'].includes(k))
      .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join('；')
    const yaku = Object.entries(e.yakuman || e.yaku).map(([k, v]) => `${k} ${v}${e.yakuman ? '倍役满' : '番'}`).join('；')
    lines.push(`### ${c.id} ${c.name}`, '',
      `- 完整暗手：\`${c.tiles}\`；和牌张：\`${c.win}\`。`,
      `- 副露/杠：${c.melds.map(m => `${m.type} ${m.tiles}`).join('；') || '无'}。`,
      `- 场况：${ctx.bakaze}场、${ctx.jikaze}家、${ctx.agariType === 'tsumo' ? '自摸' : '荣和'}${flags ? '；' + flags : ''}。`,
      `- 役种：${yaku}。`,
      `- 正确结果：**${e.yakuman ? `${Object.values(e.yakuman).reduce((a,b) => a+b,0)}倍役满（番数/符数不适用）` : `${e.han}番 ${e.fu}符`}**。`,
      `- 符数推导：${e.parts}。`,
      `- 当前引擎：${ok ? '通过' : '**失败**'}。`, '')
    if (error) lines.push('```text', error, '```', '')
  }
  fs.writeFileSync(path.join(__dirname, 'winning-hands.md'), lines.join('\n') + '\n')
}
const failed = results.filter(r => !r.ok).length
console.log(`\n胡牌番符测试：${results.length - failed}/${results.length} 通过，${failed} 失败。`)
if (failed) process.exitCode = 1
}
