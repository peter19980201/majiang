/**
 * 手牌拆解算法
 * 将手牌拆解为所有合法的 面子+雀头 组合
 * 支持: 普通和牌(4面子+1雀头), 七对子, 国士无双
 */

const { isYaochu, getSuit, isJihai, tilesToCounts } = require('./tiles')

/**
 * 拆解结果结构:
 * {
 *   type: 'regular' | 'chitoitsu' | 'kokushi',
 *   mentsu: [{ type: 'shuntsu'|'koutsu', tiles: [id,id,id] }, ...],
 *   jantai: id,  // 雀头牌种ID
 *   // 对于七对子: pairs: [id, id, ...]  (7个牌种ID)
 *   // 对于国士: tiles: [0..12] 13种幺九牌, pair: 重复的那张
 * }
 */

/**
 * 主入口: 拆解手牌
 * @param {number[]} handTiles 门前手牌ID数组(不含副露，含和了牌)
 * @param {Array} melds 副露列表 [{type:'chi'|'pon'|'minkan'|'ankan'|'kakan', tiles:[...]}]
 * @returns {Array} 所有合法拆解
 */
function decompose(handTiles, melds) {
  const results = []
  const counts = tilesToCounts(handTiles)
  const meldCount = melds ? melds.length : 0
  const neededMentsu = 4 - meldCount // 手牌中需要拆出的面子数

  // 1. 普通和牌: neededMentsu 组面子 + 1 雀头
  decomposeRegular(counts, neededMentsu, [], null, results)

  // 2. 七对子 (仅在无副露时)
  if (meldCount === 0) {
    const chitoitsu = decomposeChitoitsu(counts)
    if (chitoitsu) results.push(chitoitsu)
  }

  // 3. 国士无双 (仅在无副露时)
  if (meldCount === 0) {
    const kokushi = decomposeKokushi(counts)
    if (kokushi) results.push(kokushi)
  }

  return results
}

/**
 * 递归拆解普通和牌
 */
function decomposeRegular(counts, remaining, mentsu, jantai, results) {
  // 如果已经找够面子，检查是否还有剩余牌
  if (remaining === 0 && jantai !== null) {
    // 检查是否所有牌都已拆完
    const total = counts.reduce((s, c) => s + c, 0)
    if (total === 0) {
      results.push({
        type: 'regular',
        mentsu: mentsu.slice(),
        jantai: jantai
      })
    }
    return
  }

  // 找第一张有牌的位置
  let first = -1
  for (let i = 0; i < 34; i++) {
    if (counts[i] > 0) {
      first = i
      break
    }
  }
  if (first === -1) return

  // 尝试取雀头 (如果还没取)
  if (jantai === null && counts[first] >= 2) {
    counts[first] -= 2
    decomposeRegular(counts, remaining, mentsu, first, results)
    counts[first] += 2
  }

  if (remaining <= 0) return

  // 尝试刻子
  if (counts[first] >= 3) {
    counts[first] -= 3
    mentsu.push({ type: 'koutsu', tile: first })
    decomposeRegular(counts, remaining - 1, mentsu, jantai, results)
    mentsu.pop()
    counts[first] += 3
  }

  // 尝试顺子 (仅数牌，且序号 <= 6，即最多7开头的顺子)
  if (!isJihai(first)) {
    const n = first % 9
    if (n <= 6) {
      const suit = getSuit(first)
      const t1 = first
      const t2 = first + 1
      const t3 = first + 2
      if (counts[t1] >= 1 && counts[t2] >= 1 && counts[t3] >= 1) {
        counts[t1]--
        counts[t2]--
        counts[t3]--
        mentsu.push({ type: 'shuntsu', tile: first }) // tile = 顺子起始牌
        decomposeRegular(counts, remaining - 1, mentsu, jantai, results)
        mentsu.pop()
        counts[t1]++
        counts[t2]++
        counts[t3]++
      }
    }
  }
}

/**
 * 七对子拆解
 */
function decomposeChitoitsu(counts) {
  const pairs = []
  for (let i = 0; i < 34; i++) {
    if (counts[i] === 2) {
      pairs.push(i)
    } else if (counts[i] !== 0) {
      return null
    }
  }
  if (pairs.length === 7) {
    return { type: 'chitoitsu', pairs: pairs }
  }
  return null
}

/**
 * 国士无双拆解
 * 13种幺九牌各一张 + 其中一种多一张
 */
function decomposeKokushi(counts) {
  // 13种幺九牌: 1m,9m,1p,9p,1s,9s,東南西北白发中
  const yaochu = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]
  let pair = -1
  let valid = true
  for (const id of yaochu) {
    if (counts[id] === 0) {
      valid = false
      break
    }
    if (counts[id] === 2) {
      if (pair !== -1) {
        valid = false
        break
      }
      pair = id
    } else if (counts[id] !== 1) {
      valid = false
      break
    }
  }
  // 确认没有其他牌
  if (valid && pair !== -1) {
    const total = counts.reduce((s, c) => s + c, 0)
    if (total === 14) {
      return { type: 'kokushi', pair: pair }
    }
  }
  return null
}

/**
 * 将副露转为 mentsu 格式 (用于统一处理)
 */
function meldToMentsu(meld) {
  switch (meld.type) {
    case 'chi':
      return { type: 'shuntsu', tile: Math.min(...meld.tiles), open: true }
    case 'pon':
      return { type: 'koutsu', tile: meld.tiles[0], open: true }
    case 'minkan':
    case 'kakan':
      return { type: 'kantsu', tile: meld.tiles[0], open: true }
    case 'ankan':
      return { type: 'kantsu', tile: meld.tiles[0], open: false }
    default:
      return null
  }
}

module.exports = {
  decompose,
  meldToMentsu
}
