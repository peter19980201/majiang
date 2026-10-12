/** 手工编排的完整和牌示例。groups 含和了牌；hand 不含和了牌及副露。 */
const T = require('./tiles')

function example(groups, agari, winningGroup, note, options = {}) {
  const parsed = groups.map(T.parseTiles)
  const win = T.parseTiles(agari)[0]
  const handGroups = parsed.map(g => g.slice())
  const winningIndex = handGroups[winningGroup].lastIndexOf(win)
  if (winningIndex < 0) throw new Error('示例和了牌必须属于指定分组')
  handGroups[winningGroup].splice(winningIndex, 1)
  return {
    hand: handGroups.flat().map(T.tileShort).join(''),
    groups, agari, winningGroup, winningIndex, note,
    melds: options.melds || [],
    context: { agariType: 'ron', bakaze: 27, jikaze: 28, ...options.context },
    title: options.title || '成立示例',
    situation: options.situation || '',
    shape: options.shape || 'regular'
  }
}
const pon = tiles => ({ type: 'pon', tiles })
const kan = (tiles, type = 'minkan') => ({ type, tiles })
const simple = ['234m', '456m', '678p', '234s', '55p']
const examples = {
  '立直': [example(simple, '4s', 3, '门前手牌中的23索听1索、4索；本例荣和4索。', { context: { riichi: true }, situation: '已门前听牌，宣言立直并支付1000点；之后荣和4索。' })],
  '一发': [example(simple, '4s', 3, '立直后的一巡内和了，期间没有吃、碰或杠打断。', { context: { riichi: true, ippatsu: true }, situation: '宣言立直后，在下一次自己摸牌前荣和4索，期间无人鸣牌。' })],
  '门前清自摸和': [example(simple, '4s', 3, '没有吃、碰、明杠；由自己摸到4索和了。', { context: { agariType: 'tsumo' } })],
  '平和': [example(['123m', '456m', '789s', '123p', '55s'], '1p', 3, '四组顺子，5索为非役牌雀头；23筒听1筒、4筒，为两面听。')],
  '一杯口': [example(['123m', '123m', '456p', '789s', '77p'], '9s', 3, '门前的两组123万构成一杯口，7筒为雀头。')],
  '断幺九': [example(['234m', '567p', '234s', '66p'], '4s', 2, '包括碰出的888索在内，全部牌都是2至8的数牌。', { melds: [pon('888s')] })],
  '役牌:白': [example(['234m', '567p', '789s', '22p'], '9s', 2, '碰出的白白白是役牌刻子。', { melds: [pon('白白白')] })],
  '役牌:发': [example(['234m', '567p', '789s', '22p'], '9s', 2, '碰出的发发发是役牌刻子。', { melds: [pon('发发发')] })],
  '役牌:中': [example(['234m', '567p', '789s', '22p'], '9s', 2, '碰出的中中中是役牌刻子。', { melds: [pon('中中中')] })],
  '役牌:场风': [example(['234m', '567p', '789s', '22p'], '9s', 2, '东场的东刻子计场风役；本例自风南，不重复计自风。', { melds: [pon('東東東')] })],
  '役牌:自风': [example(['234m', '567p', '789s', '22p'], '9s', 2, '南家的南刻子计自风役；本例为东场，不重复计场风。', { melds: [pon('南南南')] })],
  '海底摸月': [example(simple, '4s', 3, '自摸的是活牌山最后一张牌，不是岭上牌。', { context: { agariType: 'tsumo', haitei: true }, situation: '摸到活牌山最后一张4索并自摸和了。' })],
  '河底捞鱼': [example(simple, '4s', 3, '荣和牌山摸完后的最后一张舍牌。', { context: { haitei: true }, situation: '他家摸完活牌山最后一张后打出4索，本家荣和。' })],
  '岭上开花': [example(['234m', '567p', '789s', '22p'], '9s', 2, '开杠补摸的岭上牌9索完成顺子。', { melds: [kan('白白白白')], context: { agariType: 'tsumo', rinshan: true }, situation: '本家将白开明杠后，从岭上补摸9索并和了。' })],
  '抢杠': [example(simple, '4s', 3, '他家将已碰的4索加杠，本家用这张4索荣和。', { context: { chankan: true }, situation: '抢的是他家的加杠牌，不是本家开杠后的补牌。' })],
  '双立直': [example(simple, '4s', 3, '自己的第一巡舍牌时宣言立直，此前没有吃、碰或杠。', { context: { doubleRiichi: true }, situation: '第一巡宣言立直并支付1000点，之后荣和4索。' })],
  '七对子': [example(['11m', '33m', '22p', '77p', '44s', '99s', '東東'], '9s', 5, '七组不同的对子；原来单张9索，荣和9索成对。固定25符。', { shape: 'pairs' })],
  '三色同顺': [example(['123m', '123p', '123s', '789s', '55m'], '9s', 3, '万、筒、索各一组123；另有789索和5万雀头。门前2番。')],
  '一气通贯': [example(['456p', '789p', '234s', '55s'], '4s', 2, '吃出的123筒与手中的456筒、789筒构成一气通贯。副露1番。', { melds: [{ type: 'chi', tiles: '123p' }] })],
  '混全带幺九': [example(['123m', '789p', '999s', '111p', '東東'], '3m', 0, '每组面子及雀头都有幺九或字牌，且同时有顺子和字牌。')],
  '对对和': [example(['111m', '999p', '22s'], '2s', 2, '两组手中刻子、两组碰出的刻子，加上2索雀头。', { melds: [pon('333s'), pon('777p')] })],
  '三暗刻': [example(['111m', '333p', '555s', '789m', '22p'], '9m', 3, '荣和9万完成顺子；111万、333筒、555索均为暗刻。荣和补成的刻子不能计暗刻。')],
  '三色同刻': [example(['222m', '222p', '789s', '55m'], '9s', 2, '222万、222筒与碰出的222索构成三色同刻。', { melds: [pon('222s')] })],
  '混老头': [example(['111m', '999p', '東東東', '南南'], '南', 3, '全是1、9或字牌；本例也成立对对和及役牌白，可另行叠加。', { melds: [pon('白白白')] })],
  '小三元': [example(['234m', '789s', '中中'], '9s', 1, '白、发各一组刻子，中作雀头；两组役牌各计1番，小三元另计2番。', { melds: [pon('白白白'), pon('发发发')] })],
  '三杠子': [example(['789s', '22p'], '9s', 0, '三组杠子均计入：一组明杠、一组暗杠、一组加杠。总实体牌数为17张。', { melds: [kan('1111m'), kan('3333p', 'ankan'), kan('白白白白', 'kakan')] })],
  '二杯口': [example(['123m', '123m', '567p', '567p', '99s'], '9s', 4, '123万两组、567筒两组，9索作雀头；按二杯口计，不再叠加一杯口或七对子。')],
  '纯全带幺九': [example(['123m', '789m', '123p', '789s', '11s'], '3p', 2, '四组顺子和雀头都含1或9，没有字牌。')],
  '混一色': [example(['123m', '456m', '789m', '東東東', '南南'], '9m', 2, '仅万子与字牌，南为雀头；本例门前3番。')],
  '清一色': [example(['123m', '345m', '567m', '789m', '22m'], '9m', 3, '全部是万子，四组顺子加2万雀头；本例门前6番。')],
  '天和': [example(simple, '4s', 3, '庄家配牌14张已经和了，未进行吃碰杠。金框仅标记配牌中的和了张。', { context: { agariType: 'tsumo', jikaze: 27, tenhou: true }, situation: '东家（庄家）配牌即和，无另一次摸牌过程。' })],
  '地和': [example(simple, '4s', 3, '子家第一次摸牌即自摸，此前无人吃、碰或杠。', { context: { agariType: 'tsumo', chihou: true }, situation: '南家第一次摸到4索即和，之前未发生鸣牌。' })],
  '国士无双': [example(['11m', '9m', '19p', '19s', '東南西北', '白发中'], '中', 5, '和牌前已有1万对子，缺中；荣和中补齐第13种幺九牌。', { shape: 'kokushi', title: '普通国士无双 · 役满' }), example(['19m', '19p', '19s', '東南西北', '白发中中'], '中', 4, '和牌前13种幺九牌各一张，任一种都可和；本例中成对。', { shape: 'kokushi', title: '国士无双十三面 · 双倍役满' })],
  '四暗刻': [example(['111m', '333p', '555s', '777p', '22s'], '7p', 3, '和牌前77筒、22索双碰；自摸7筒才使第四组刻子保持暗刻。', { context: { agariType: 'tsumo' }, title: '普通四暗刻 · 役满' }), example(['111m', '333p', '555s', '777p', '22s'], '2s', 4, '四组暗刻已齐，单张2索听雀头；荣和或自摸均成立四暗刻单骑。', { title: '四暗刻单骑 · 双倍役满' })],
  '大三元': [example(['234m', '55s'], '4m', 0, '白、发、中各一组刻子，另有234万及5索雀头。', { melds: [pon('白白白'), pon('发发发'), pon('中中中')] })],
  '字一色': [example(['東東東', '南南南', '西西西', '白白'], '白', 3, '所有牌都是字牌；本例含明刻，不成立四暗刻。', { melds: [pon('中中中')] })],
  '绿一色': [example(['234s', '234s', '666s', '发发'], '发', 3, '仅使用绿色牌23468索和发中的牌；本例不含其他牌种。', { melds: [pon('888s')] })],
  '清老头': [example(['111m', '999m', '111p', '99s'], '9s', 3, '四组刻子与雀头全为数牌1、9，没有字牌。', { melds: [pon('999p')] })],
  '小四喜': [example(['南南南', '西西西', '123m', '北北'], '3m', 2, '东、南、西为刻子，北为雀头；另有123万顺子。', { melds: [pon('東東東')] })],
  '大四喜': [example(['西西西', '北北北', '22m'], '2m', 2, '东南西北全部为刻子，2万为雀头；本项目按双倍役满。', { melds: [pon('東東東'), pon('南南南')] })],
  '四杠子': [example(['22s'], '2s', 0, '四组杠子加2索雀头，共18张实体牌；第四杠后仍由同一人继续和牌。', { melds: [kan('1111m'), kan('3333p', 'ankan'), kan('7777s'), kan('白白白白')] })],
  '九莲宝灯': [example(['111m', '234m', '678m', '999m', '55m'], '7m', 2, '和牌前缺7万、已有额外5万；和牌后符合九莲型，但不是九面听。', { title: '普通九莲宝灯 · 役满' }), example(['111m', '234m', '678m', '999m', '55m'], '5m', 4, '去掉金框5万后恰为1112345678999万，和牌前听同花色全部九种牌。', { title: '纯正九莲宝灯 · 双倍役满' })]
}

module.exports = { examples }
