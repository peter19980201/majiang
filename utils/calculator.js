/**
 * 主计算器 - 编排所有模块
 * 输入手牌信息 → 输出完整计算结果
 */

const { tilesToCounts, countDora } = require('./tiles')
const { decompose, meldToMentsu } = require('./decompose')
const { judgeYaku, getAllMentsu, countAnko } = require('./yaku')
const { calculateFu } = require('./fu')
const { calculateScore, calculatePayment } = require('./score')

/**
 * 完整计算
 * @param {Object} input 输入数据
 * @param {number[]} input.hand 门前手牌 (不含副露,不含和了牌)
 * @param {Array} input.melds 副露 [{type, tiles}]
 * @param {number} input.agariTile 和了牌
 * @param {Object} input.context 上下文
 * @returns {Object} 计算结果 (最优拆解)
 */
function calculate(input) {
  const { hand, melds = [], agariTile, context } = input

  // 合并手牌 + 和了牌用于拆解
  const handWithAgari = hand.concat([agariTile])

  // 判断门前
  const isMenzen = melds.every(m => m.type === 'ankan' || !m.type || false)
    ? melds.every(m => m.type === 'ankan') && melds.length <= 4
    : false
  // 更准确的门前判定: 没有吃/碰/明杠/加杠
  const hasOpenMeld = melds.some(m =>
    m.type === 'chi' || m.type === 'pon' || m.type === 'minkan' || m.type === 'kakan'
  )
  const menzen = !hasOpenMeld

  const ctx = {
    isMenzen: menzen,
    isTsumo: context.agariType === 'tsumo',
    agariTile,
    bakaze: context.bakaze,
    jikaze: context.jikaze,
    isRiichi: context.riichi || false,
    isDoubleRiichi: context.doubleRiichi || false,
    isIppatsu: context.ippatsu || false,
    isHaitei: context.haitei || false,
    isRinshan: context.rinshan || false,
    isChankan: context.chankan || false,
    isTenhou: context.tenhou || false,
    isChihou: context.chihou || false
  }

  // 拆解手牌
  const decompositions = decompose(handWithAgari, melds)

  if (decompositions.length === 0) {
    return { error: '无法拆解为合法牌型' }
  }

  // 对每种拆解计算，选择得点最高的
  let bestResult = null
  let bestPoints = -1

  for (const dec of decompositions) {
    const result = calculateForDecomposition(dec, melds, ctx, input)
    if (result && result.payment.total > bestPoints) {
      bestPoints = result.payment.total
      bestResult = result
    }
  }

  if (!bestResult) {
    return { error: '无成立役种' }
  }

  return bestResult
}

/**
 * 对单个拆解计算
 */
function calculateForDecomposition(decomp, melds, ctx, input) {
  // 获取全部面子 (含副露)
  const allMentsu = getAllMentsu(decomp, melds)

  // 役种判定
  const yakuList = judgeYaku(decomp, melds, ctx)

  // 如果没有成立的役(不含ドラ)，暂时不算
  // 注: ドラ本身不是役，需要至少1个役才能和牌

  // 计算宝牌
  const allTileIds = getAllTilesFlat(input.hand, melds, input.agariTile)
  let doraCount = 0
  let uraDoraCount = 0
  let redDoraCount = 0

  if (input.context.dora && input.context.dora.length > 0) {
    doraCount = countDora(allTileIds, input.context.dora, null)
  }
  if (input.context.uraDora && input.context.uraDora.length > 0 &&
      (ctx.isRiichi || ctx.isDoubleRiichi)) {
    uraDoraCount = countDora(allTileIds, input.context.uraDora, null)
  }

  // 赤宝牌
  if (input.context.redDora) {
    const rd = input.context.redDora
    redDoraCount = (rd.m5 || 0) + (rd.p5 || 0) + (rd.s5 || 0)
  }

  const totalDoraCount = doraCount + uraDoraCount + redDoraCount

  // 没有役 → 不能和牌 (宝牌不算役)
  const isYakuman = yakuList.some(y => y.isYakuman)
  if (yakuList.length === 0 && totalDoraCount === 0) {
    return null
  }
  if (yakuList.length === 0) {
    // 只有宝牌没有役 → 无法和牌
    return null
  }

  // 分别添加宝牌、里宝牌、赤宝牌
  if (!isYakuman) {
    if (doraCount > 0) {
      yakuList.push({ name: '宝牌', nameJa: 'ドラ', han: doraCount })
    }
    if (uraDoraCount > 0) {
      yakuList.push({ name: '里宝牌', nameJa: '裏ドラ', han: uraDoraCount })
    }
    if (redDoraCount > 0) {
      yakuList.push({ name: '赤宝牌', nameJa: '赤ドラ', han: redDoraCount })
    }
  }

  // 计算符数
  const hasPinfu = yakuList.some(y => y.name === '平和')

  // 处理荣和时刻子的明暗判定
  const allMentsuWithRon = adjustMentsuForRon(allMentsu, decomp, ctx)

  const fuResult = calculateFu(decomp, allMentsuWithRon, ctx, hasPinfu)

  // 计算番数
  let totalHan = 0
  if (!isYakuman) {
    totalHan = yakuList.reduce((sum, y) => sum + y.han, 0)
  }

  // 计算点数
  const scoreResult = calculateScore(fuResult.fu, totalHan, yakuList)

  // 计算分账
  const isOya = ctx.jikaze === 27 // 東 = 庄家
  const honba = input.context.honba || 0
  const payment = calculatePayment(
    scoreResult.basePoints,
    isOya,
    ctx.isTsumo,
    honba
  )

  return {
    decomposition: decomp,
    yaku: yakuList,
    fu: fuResult.fu,
    fuDetail: fuResult.detail,
    han: isYakuman ? -1 : totalHan,
    level: scoreResult.level,
    basePoints: scoreResult.basePoints,
    isOya,
    payment
  }
}

/**
 * 荣和时，和了牌构成的刻子算明刻
 */
function adjustMentsuForRon(allMentsu, decomp, ctx) {
  if (ctx.isTsumo) return allMentsu
  if (decomp.type !== 'regular') return allMentsu

  const result = allMentsu.map(m => ({ ...m }))
  let adjusted = false

  for (const m of result) {
    if (!adjusted && m.type === 'koutsu' && !m.open && m.tile === ctx.agariTile) {
      m.open = true // 荣和的刻子算明刻
      adjusted = true
    }
  }

  return result
}

/**
 * 获取所有牌ID的扁平数组 (用于ドラ计数)
 */
function getAllTilesFlat(hand, melds, agariTile) {
  const tiles = [...hand, agariTile]
  for (const meld of melds) {
    for (const t of meld.tiles) {
      tiles.push(typeof t === 'object' ? t.id : t)
    }
  }
  return tiles
}

module.exports = {
  calculate
}
