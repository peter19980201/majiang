/**
 * 点数计算与分账 (参考雀魂规则)
 *
 * 雀魂特殊规则:
 *   - 切上满贯: 30符4番 → 满贯
 *   - 双倍役满: 四暗刻单骑/国士十三面/纯正九莲/大四喜
 *   - 累计役满: 13番以上
 *   - 复合役满: 多个役满可叠加
 */

/**
 * 计算点数
 * @param {number} fu 符数
 * @param {number} han 番数
 * @param {Array} yakuList 役种列表
 * @returns {{ basePoints, level, totalPoints }}
 */
function calculateScore(fu, han, yakuList) {
  // 检查是否为役满
  const yakumanList = yakuList.filter(y => y.isYakuman)
  if (yakumanList.length > 0) {
    const totalYakumanTimes = yakumanList.reduce((sum, y) => sum + (y.yakumanTimes || 1), 0)
    const basePoints = 8000 * totalYakumanTimes
    return {
      basePoints,
      level: getYakumanLevelName(totalYakumanTimes),
      han: -1,
      fu: 0
    }
  }

  // 满贯以上 (5番+)
  if (han >= 5) {
    const basePoints = getManganBase(han)
    return {
      basePoints,
      level: getLevelName(han),
      han,
      fu
    }
  }

  // 切上满贯: 30符4番 → 满贯 (雀魂规则)
  if (han === 4 && fu === 30) {
    return {
      basePoints: 2000,
      level: '满贯',
      han,
      fu
    }
  }

  // 普通计算: 基本点 = 符 × 2^(番+2)
  let basePoints = fu * Math.pow(2, han + 2)

  // 基本点上限2000 (满贯界限)
  if (basePoints > 2000) {
    basePoints = 2000
    return {
      basePoints,
      level: '满贯',
      han,
      fu
    }
  }

  return {
    basePoints,
    level: '',
    han,
    fu
  }
}

/**
 * 计算分账 (各家支付额)
 * @param {number} basePoints 基本点
 * @param {boolean} isOya 和了者是否为庄家
 * @param {boolean} isTsumo 是否自摸
 * @param {number} honba 本场数
 * @returns {Object} 分账详情
 */
function calculatePayment(basePoints, isOya, isTsumo, honba) {
  const honbaBonus = honba * 300 // 荣和时放铳者额外支付
  const honbaBonusTsumo = honba * 100 // 自摸时每家额外支付

  if (isTsumo) {
    if (isOya) {
      // 庄家自摸: 其他三家各付 基本点×2 (向上取整到百)
      const each = roundUp100(basePoints * 2) + honbaBonusTsumo
      return {
        type: 'tsumo_oya',
        total: each * 3,
        koPayment: each,
        description: `子家各付 ${each}点`
      }
    } else {
      // 子家自摸: 其他子家各付 基本点×1, 庄家付 基本点×2
      const ko = roundUp100(basePoints) + honbaBonusTsumo
      const oya = roundUp100(basePoints * 2) + honbaBonusTsumo
      return {
        type: 'tsumo_ko',
        total: ko * 2 + oya,
        koPayment: ko,
        oyaPayment: oya,
        description: `亲家付 ${oya}点 / 子家各付 ${ko}点`
      }
    }
  } else {
    // 荣和: 放铳者支付全部
    if (isOya) {
      const total = roundUp100(basePoints * 6) + honbaBonus
      return {
        type: 'ron_oya',
        total,
        ronPayment: total,
        description: `放铳者付 ${total}点`
      }
    } else {
      const total = roundUp100(basePoints * 4) + honbaBonus
      return {
        type: 'ron_ko',
        total,
        ronPayment: total,
        description: `放铳者付 ${total}点`
      }
    }
  }
}

/** 向上取整到100 */
function roundUp100(n) {
  return Math.ceil(n / 100) * 100
}

/** 满贯以上的基本点 */
function getManganBase(han) {
  if (han >= 13) return 8000   // 累计役满
  if (han >= 11) return 6000   // 三倍满
  if (han >= 8) return 4000    // 倍满
  if (han >= 6) return 3000    // 跳满
  return 2000                  // 满贯 (5番)
}

/** 等级名称 */
function getLevelName(han) {
  if (han >= 13) return '累计役满'
  if (han >= 11) return '三倍满'
  if (han >= 8) return '倍满'
  if (han >= 6) return '跳满'
  if (han >= 5) return '满贯'
  return ''
}

/** 役满等级名称 */
function getYakumanLevelName(times) {
  switch (times) {
    case 1: return '役满'
    case 2: return '双倍役满'
    case 3: return '三倍役满'
    case 4: return '四倍役满'
    default: return `${times}倍役满`
  }
}

module.exports = {
  calculateScore,
  calculatePayment,
  roundUp100,
  getLevelName,
  getYakumanLevelName
}
