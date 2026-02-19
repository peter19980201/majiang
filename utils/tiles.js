/**
 * 牌的编码与工具函数
 *
 * 牌种编码 (0-33):
 *   万子: 0-8   (一万~九万)
 *   筒子: 9-17  (一筒~九筒)
 *   索子: 18-26 (一索~九索)
 *   字牌: 27-33 (東南西北白发中)
 */

// 花色常量
const SUIT_MAN = 0   // 万子
const SUIT_PIN = 1   // 筒子
const SUIT_SOU = 2   // 索子
const SUIT_JIHAI = 3 // 字牌

// 字牌常量
const TON = 27    // 東
const NAN = 28    // 南
const SHA = 29    // 西
const PEI = 30    // 北
const HAKU = 31   // 白
const HATSU = 32  // 发
const CHUN = 33   // 中

// 三元牌
const SANGENPAI = [HAKU, HATSU, CHUN]
// 风牌
const KAZEHAI = [TON, NAN, SHA, PEI]

/**
 * 获取牌的花色
 * @param {number} id 牌种ID (0-33)
 * @returns {number} 花色 (0=万,1=筒,2=索,3=字)
 */
function getSuit(id) {
  if (id >= 27) return SUIT_JIHAI
  return Math.floor(id / 9)
}

/**
 * 获取牌在花色中的序号 (0-8对应1-9)
 * @param {number} id 牌种ID
 * @returns {number} 序号 (0-8)，字牌返回 0-6
 */
function getNum(id) {
  if (id >= 27) return id - 27
  return id % 9
}

/**
 * 根据花色和序号构造牌种ID
 * @param {number} suit 花色 (0-3)
 * @param {number} num 序号 (0-8)
 * @returns {number} 牌种ID
 */
function tileId(suit, num) {
  if (suit === SUIT_JIHAI) return 27 + num
  return suit * 9 + num
}

/**
 * 是否为幺九牌 (1,9及字牌)
 */
function isYaochu(id) {
  if (id >= 27) return true
  const n = id % 9
  return n === 0 || n === 8
}

/**
 * 是否为中张牌 (2-8的数牌)
 */
function isChuchan(id) {
  return id < 27 && !isYaochu(id)
}

/**
 * 是否为字牌
 */
function isJihai(id) {
  return id >= 27
}

/**
 * 是否为数牌
 */
function isNumeral(id) {
  return id < 27
}

/**
 * 是否为三元牌
 */
function isSangenpai(id) {
  return id === HAKU || id === HATSU || id === CHUN
}

/**
 * 是否为风牌
 */
function isKazehai(id) {
  return id >= 27 && id <= 30
}

/**
 * 是否为绿一色的牌 (23468索 + 发)
 */
function isGreen(id) {
  if (id === HATSU) return true
  if (getSuit(id) !== SUIT_SOU) return false
  const n = getNum(id)
  return n === 1 || n === 2 || n === 3 || n === 5 || n === 7  // 2,3,4,6,8索 (0-indexed: 1,2,3,5,7)
}

/**
 * ドラ指示牌 → ドラ牌
 * 指示牌的下一张为ドラ
 */
function doraFromIndicator(id) {
  if (id >= 27) {
    // 字牌循环: 東→南→西→北→東, 白→发→中→白
    if (id <= 30) {
      return 27 + ((id - 27 + 1) % 4)
    } else {
      return 31 + ((id - 31 + 1) % 3)
    }
  }
  // 数牌: 9→1 循环
  const suit = getSuit(id)
  const num = getNum(id)
  return tileId(suit, (num + 1) % 9)
}

/**
 * 计算手牌中ドラ的数量
 * @param {number[]} allTiles 所有牌的ID列表(含手牌+副露+和了牌)
 * @param {number[]} indicators ドラ指示牌列表
 * @param {boolean[]} redFlags 每张牌是否为赤牌的标记
 * @returns {number} ドラ总数
 */
function countDora(allTiles, indicators, redFlags) {
  let count = 0
  const doraIds = indicators.map(doraFromIndicator)
  for (let i = 0; i < allTiles.length; i++) {
    for (const d of doraIds) {
      if (allTiles[i] === d) count++
    }
    if (redFlags && redFlags[i]) count++
  }
  return count
}

/**
 * 牌的显示名称
 */
const TILE_NAMES = [
  '一万','二万','三万','四万','五万','六万','七万','八万','九万',
  '一筒','二筒','三筒','四筒','五筒','六筒','七筒','八筒','九筒',
  '一索','二索','三索','四索','五索','六索','七索','八索','九索',
  '東','南','西','北','白','发','中'
]

/**
 * 牌的简称 (用于紧凑显示)
 */
const TILE_SHORT = [
  '1m','2m','3m','4m','5m','6m','7m','8m','9m',
  '1p','2p','3p','4p','5p','6p','7p','8p','9p',
  '1s','2s','3s','4s','5s','6s','7s','8s','9s',
  '東','南','西','北','白','发','中'
]

function tileName(id) {
  return TILE_NAMES[id] || '?'
}

function tileShort(id) {
  return TILE_SHORT[id] || '?'
}

/**
 * 解析简写字符串为牌ID数组
 * 例: "123m456p789s東東" → [0,1,2,12,13,14,24,25,26,27,27]
 */
function parseTiles(str) {
  const result = []
  let buffer = []
  for (let i = 0; i < str.length; i++) {
    const ch = str[i]
    if (ch === 'm' || ch === 'p' || ch === 's') {
      const suitBase = ch === 'm' ? 0 : ch === 'p' ? 9 : 18
      for (const n of buffer) {
        result.push(suitBase + (parseInt(n) - 1))
      }
      buffer = []
    } else if (ch >= '0' && ch <= '9') {
      buffer.push(ch)
    } else {
      // 字牌
      const jiMap = { '東': 27, '南': 28, '西': 29, '北': 30, '白': 31, '发': 32, '中': 33 }
      if (jiMap[ch] !== undefined) {
        result.push(jiMap[ch])
      }
    }
  }
  return result
}

/**
 * 将牌ID数组转为34长度的计数数组
 */
function tilesToCounts(tiles) {
  const counts = new Array(34).fill(0)
  for (const t of tiles) {
    counts[t]++
  }
  return counts
}

/**
 * 将计数数组转回牌ID数组
 */
function countsToTiles(counts) {
  const tiles = []
  for (let i = 0; i < 34; i++) {
    for (let j = 0; j < counts[i]; j++) {
      tiles.push(i)
    }
  }
  return tiles
}

module.exports = {
  SUIT_MAN, SUIT_PIN, SUIT_SOU, SUIT_JIHAI,
  TON, NAN, SHA, PEI, HAKU, HATSU, CHUN,
  SANGENPAI, KAZEHAI,
  getSuit, getNum, tileId,
  isYaochu, isChuchan, isJihai, isNumeral,
  isSangenpai, isKazehai, isGreen,
  doraFromIndicator, countDora,
  tileName, tileShort, parseTiles,
  tilesToCounts, countsToTiles,
  TILE_NAMES, TILE_SHORT
}
