/**
 * 符数计算 (参考雀魂规则)
 *
 * 雀魂特殊规则:
 *   - 连风牌雀头 = 4符
 *   - 平和自摸 = 固定20符
 *   - 七对子 = 固定25符
 *   - 副露平和型荣和 = 强制30符
 */

const T = require('./tiles')

/**
 * 计算符数
 * @param {Object} decomp 拆解结果
 * @param {Array} allMentsu 全部面子列表 (含open标记)
 * @param {Object} ctx 上下文
 * @param {boolean} hasPinfu 是否有平和役
 * @returns {{ fu: number, detail: Array }}
 */
function calculateFu(decomp, allMentsu, ctx, hasPinfu) {
  const detail = []

  // 七对子: 固定25符
  if (decomp.type === 'chitoitsu') {
    return { fu: 25, detail: [{ name: '七对子', fu: 25 }] }
  }

  // 国士无双: 无符概念(走役满通道)，但为计算方便给30符
  if (decomp.type === 'kokushi') {
    return { fu: 30, detail: [{ name: '国士无双', fu: 30 }] }
  }

  // 平和自摸: 固定20符
  if (hasPinfu && ctx.isTsumo) {
    return { fu: 20, detail: [{ name: '平和自摸', fu: 20 }] }
  }

  // === 普通计算 ===
  let total = 20
  detail.push({ name: '底符', fu: 20 })

  // 和牌方式
  if (ctx.isMenzen && !ctx.isTsumo) {
    // 门前清荣和
    total += 10
    detail.push({ name: '门前清荣和', fu: 10 })
  } else if (ctx.isTsumo) {
    // 自摸 (非平和时)
    total += 2
    detail.push({ name: '自摸', fu: 2 })
  }
  // 副露荣和: +0

  // 面子符
  for (const m of allMentsu) {
    let fu = 0
    let name = ''
    if (m.type === 'shuntsu') {
      continue // 顺子 0符
    } else if (m.type === 'koutsu') {
      const isYaochu = T.isYaochu(m.tile)
      if (m.open) {
        fu = isYaochu ? 4 : 2
        name = `明刻(${T.tileName(m.tile)})`
      } else {
        fu = isYaochu ? 8 : 4
        name = `暗刻(${T.tileName(m.tile)})`
      }
    } else if (m.type === 'kantsu') {
      const isYaochu = T.isYaochu(m.tile)
      if (m.open) {
        fu = isYaochu ? 16 : 8
        name = `明杠(${T.tileName(m.tile)})`
      } else {
        fu = isYaochu ? 32 : 16
        name = `暗杠(${T.tileName(m.tile)})`
      }
    }
    if (fu > 0) {
      total += fu
      detail.push({ name, fu })
    }
  }

  // 雀头符
  if (decomp.jantai !== undefined) {
    let jantaiFu = 0
    const j = decomp.jantai

    // 连风牌 (雀魂: 4符)
    if (j === ctx.bakaze && j === ctx.jikaze) {
      jantaiFu = 4
    } else if (j === ctx.bakaze) {
      jantaiFu = 2
    } else if (j === ctx.jikaze) {
      jantaiFu = 2
    } else if (T.isSangenpai(j)) {
      jantaiFu = 2
    }

    if (jantaiFu > 0) {
      total += jantaiFu
      detail.push({ name: `雀头(${T.tileName(j)})`, fu: jantaiFu })
    }
  }

  // 听牌方式符
  const machiFu = getMachiFu(decomp, ctx.agariTile)
  if (machiFu.fu > 0) {
    total += machiFu.fu
    detail.push({ name: machiFu.name, fu: machiFu.fu })
  }

  // 副露平和型荣和: 强制30符
  if (!ctx.isMenzen && !ctx.isTsumo && total < 30) {
    total = 30
    detail.push({ name: '副露荣和最低30符', fu: 0 })
  }

  // 向上取整到10的倍数
  const rounded = Math.ceil(total / 10) * 10
  return { fu: rounded, detail }
}

/**
 * 判定听牌方式
 * @returns {{ fu: number, name: string }}
 */
function getMachiFu(decomp, agariTile) {
  if (decomp.type !== 'regular') return { fu: 0, name: '' }

  // 单骑: 和了牌是雀头
  if (agariTile === decomp.jantai) {
    // 需要确认不是双碰等其他情况
    // 如果和了牌既能做雀头又能做面子，这个拆解中它做了雀头 → 单骑
    return { fu: 2, name: '单骑' }
  }

  // 检查和了牌在哪个顺子中
  for (const m of decomp.mentsu) {
    if (m.type === 'shuntsu') {
      const t0 = m.tile
      const t1 = m.tile + 1
      const t2 = m.tile + 2

      if (agariTile === t1) {
        // 嵌张 (中间那张)
        return { fu: 2, name: '嵌张' }
      }
      if (agariTile === t0 && (t0 % 9) === 6) {
        // 边张: 789 等 7 → 边张
        return { fu: 2, name: '边张' }
      }
      if (agariTile === t2 && (t2 % 9) === 2) {
        // 边张: 123 等 3 → 边张
        return { fu: 2, name: '边张' }
      }
    }
  }

  // 双面 或 双碰: 0符
  return { fu: 0, name: '' }
}

module.exports = {
  calculateFu,
  getMachiFu
}
