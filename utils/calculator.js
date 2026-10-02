/**
 * 主计算器 - 编排所有模块
 * 输入手牌信息 → 输出完整计算结果
 */

const { countDora } = require('./tiles')
const { decompose } = require('./decompose')
const { judgeYaku, getAllMentsu } = require('./yaku')
const { calculateFu } = require('./fu')
const WinningTile = require('./winning-tile')
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

  const dora = calculateDora(input, melds, ctx)

  // 对每种拆解和和了牌归属计算，选择得点最高的
  let bestResult = null

  for (const dec of decompositions) {
    for (const winningTile of WinningTile.placements(dec, agariTile)) {
      const result = calculateForDecomposition({ ...dec, winningTile }, melds, ctx, input, dora)
      if (result && isBetterResult(result, bestResult)) {
        bestResult = result
      }
    }
  }

  if (!bestResult) {
    return { error: '无成立役种' }
  }

  return bestResult
}

// Keep payment as the primary criterion. At a score cap several legal
// interpretations can pay the same: prefer more han, then more fu instead of
// depending on decomposition traversal order. Actual yakuman outranks counted
// yakuman at equal payment (yakuman uses han = -1 in the public result).
function isBetterResult(candidate, current) {
  if (!current) return true
  if (candidate.payment.total !== current.payment.total) {
    return candidate.payment.total > current.payment.total
  }
  const candidateHan = candidate.han === -1 ? Infinity : candidate.han
  const currentHan = current.han === -1 ? Infinity : current.han
  if (candidateHan !== currentHan) return candidateHan > currentHan
  return candidate.fu > current.fu
}

// Dora does not depend on decomposition or winning-tile placement.
function calculateDora(input, melds, ctx) {
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

  return { doraCount, uraDoraCount, redDoraCount }
}

function calculateForDecomposition(decomp, melds, ctx, input, dora) {
  const allMentsu = getAllMentsu(decomp, melds)
  const yakuList = judgeYaku(decomp, melds, ctx)
  // Dora alone cannot supply a yaku.
  if (yakuList.length === 0) return null
  const isYakuman = yakuList.some(y => y.isYakuman)
  const { doraCount, uraDoraCount, redDoraCount } = dora

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

  const winning = WinningTile.selected(decomp, ctx.agariTile)
  return allMentsu.map((m, index) => winning && winning.type === 'shanpon' &&
    index === winning.mentsuIndex ? { ...m, open: true } : m)
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
