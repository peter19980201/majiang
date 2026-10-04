/** 固定6000例，直接Node运行，无Python依赖。可加 --report 或 G00001。 */
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const { check } = require('./winning-hands')
const { calculate } = require('../../utils/calculator')
const { inputFor } = require('./winning-hands')
const fixture = path.join(__dirname, '../fixtures/winning-hands.generated.jsonl')
const blob = fs.readFileSync(fixture)
const manifest = require('../fixtures/winning-hands.generated.manifest.json')
assert.equal(createHash('sha256').update(blob).digest('hex'), manifest.sha256, '样本数据哈希不匹配')
const cases = blob.toString().trim().split('\n').map(JSON.parse)
assert.equal(cases.length, manifest.total)
assert.equal(new Set(cases.map(c => c.id)).size, cases.length)
const selected = process.argv.find(a => /^G\d{5}$/.test(a))
const chosen = cases.filter(c => !selected || c.id === selected)
assert(chosen.length, '用例编号不存在')
const failures = []
// 独立计算预期的基本点，只用于归类分歧，不作为放宽番符断言的条件。
function expectedBase(e) {
  if (e.yakuman) return Object.values(e.yakuman).reduce((a, b) => a + b, 0) * 8000
  if (e.error) return null
  if (e.han >= 13) return 8000
  if (e.han >= 11) return 6000
  if (e.han >= 8) return 4000
  if (e.han >= 6) return 3000
  if (e.han >= 5 || e.han === 4 && e.fu === 30) return 2000
  return Math.min(2000, e.fu * 2 ** (e.han + 2))
}
const coverage = { category: {}, outcomes: {}, fu: {}, han: {}, yaku: {}, meld: {}, winds: {}, winType: {} }
function count(group, key) { coverage[group][key] = (coverage[group][key] || 0) + 1 }
for (const c of chosen) {
  const e = c.expected
  count('category', c.category)
  count('outcomes', e.error ? 'no-yaku' : e.yakuman ? 'yakuman' : 'normal')
  count('winds', `${c.context.bakaze}场${c.context.jikaze}家`)
  count('winType', c.context.agariType)
  if (!e.error && !e.yakuman) { count('fu', e.fu); count('han', e.han) }
  for (const name of Object.keys(e.yakuman || e.yaku || {})) count('yaku', name)
  for (const m of c.melds) count('meld', m.type)
  try { check(c) } catch (error) {
    let actual
    try { actual = calculate(inputFor(c)) } catch (err) { actual = { error: err.message } }
    const referenceBase = expectedBase(c.expected)
    const classification = referenceBase !== null && referenceBase === actual.basePoints ? 'equal-points-different-han-fu-or-yaku' : 'other-mismatch'
    failures.push({ id: c.id, category: c.category, classification, referenceBase, input: c, actual, message: error.message })
    if (failures.length <= 12) console.error(`FAIL ${c.id}: ${error.message}`)
  }
}
const uniqueShapes = new Set(chosen.map(c => JSON.stringify([c.tiles, c.melds.map(m => `${m.type}:${m.tiles}`).sort()]))).size
const samePoints = failures.filter(f => f.classification === 'equal-points-different-han-fu-or-yaku').length
const stats = { total: chosen.length, passed: chosen.length - failures.length, failed: failures.length,
  samePointsDifferences: samePoints, uniqueShapes, coverage }
console.log(JSON.stringify(stats, null, 2))
if (process.argv.includes('--report')) {
  assert(!selected, '完整报告不能指定单例')
  fs.writeFileSync(path.join(__dirname, '../winning-hands-expanded-result.json'), JSON.stringify({ ...stats, fixtureSha256: manifest.sha256, failures }, null, 2) + '\n')
  const lines = ['# 扩展胡牌测试集', '',
    '保留原100个人工推导用例，新增6000个独立计分库生成答案的用例，总计6100例。新增样本使用固定随机种子20261002并按完整输入去重。', '',
    '**答案来源不同：** 原100例是人工推导后交叉核对；新增6000例的答案由 Python mahjong 1.4.0 计算并固化，没有读取本项目引擎结果。独立库生成答案不等于这些答案又经过了第二套独立验证，也不构成官方认证。', '',
    '来源：[mahjong 1.4.0](https://pypi.org/project/mahjong/1.4.0/)、[开源项目](https://github.com/MahjongRepository/mahjong)。独立库的结果以匹配本项目的开断幺、双倍役满等配置为依据；本扩展集比较番符、完整役种和役满倍数，不比较切上满贯等点数规则差异。', '',
    '## 运行', '', '```sh', 'node test/winning-hands.js', 'node test/winning-hands-expanded.js',
    'node test/winning-hands-expanded.js G00001',
    'node test/winning-hands-expanded.js --report', '```', '',
    '日常回归只需Node。重新生成需要安装 mahjong==1.4.0 的Python环境：', '',
    '```sh', '/tmp/majiang-oracle-venv/bin/python test/generate-winning-hands.py', '```', '',
    '## 文件', '',
    '- fixtures/winning-hands.generated.jsonl：每行一例，完整牌型、和牌张、副露、场况、预期役种/番符及独立库符明细。',
    '- fixtures/winning-hands.generated.manifest.json：种子、来源、数量及SHA-256。',
    '- winning-hands-expanded-result.json：当前引擎统计，失败用例包含完整输入、期望和实际输出。', '',
    '所有输入检查张数、实体牌数量（含指示牌）和副露结构。相应立直/海底等对局过程条件视为已满足，不涵盖完整牌谱过程校验。无役样本有完整和牌结构，但不能宣告合法和牌，用于防止宝牌充当役。', '',
    '## 比较约定', '',
    '逐例严格比较独立库所选拆法的役种、番数和符数。mahjong 1.4.0 在多种拆法中按番数、符数排序；项目引擎先按支付点数取最优，等点时优先番数较高、再优先符数较高的合法拆法；实际役满在等点时优先于累计役满。满贯及以上也不再依赖拆解遍历顺序选取结果。若仍出现等点但番符不同的差异，会单独标记，不放宽断言。', '',
    '## 当前结果', '', `扩展集：**${stats.passed}/${stats.total}通过，${stats.failed}失败**。失败不会被跳过或改成程序现有答案，进程以非零状态退出。`, '',
    `其中 **${samePoints}例为基本点相同但番符/役种不同**；其余${failures.length - samePoints}例需检查其他原因。不同暗手/副露牌型（不计风位、和牌张、宝牌等场况）：${uniqueShapes}种。`, '',
    `失败编号：${failures.map(f => f.id).join('、') || '无'}。`, '']
  for (const [group, data] of Object.entries(coverage)) {
    lines.push(`## ${group}`, '', '| 项目 | 数量 |', '| --- | ---: |')
    for (const [key, value] of Object.entries(data)) lines.push(`| ${key} | ${value} |`)
    lines.push('')
  }
  fs.writeFileSync(path.join(__dirname, '../winning-hands-expanded.md'), lines.join('\n').trimEnd() + '\n')
}
if (failures.length) process.exitCode = 1
