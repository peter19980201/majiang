/**
 * 役种判定 (参考雀魂规则)
 *
 * 判定输入:
 *   decomp - 拆解结果 (包含 mentsu, jantai 等)
 *   allMentsu - 全部面子 (手牌拆解 + 副露)
 *   context - 和牌上下文
 *
 * context:
 *   isMenzen: boolean     门前清
 *   isTsumo: boolean      自摸
 *   agariTile: number     和了牌ID
 *   bakaze: number        场风 (27=東, 28=南)
 *   jikaze: number        自风 (27-30)
 *   isRiichi: boolean     立直
 *   isDoubleRiichi: boolean 双立直
 *   isIppatsu: boolean    一发
 *   isHaitei: boolean     海底/河底
 *   isRinshan: boolean    岭上开花
 *   isChankan: boolean    抢杠
 *   isTenhou: boolean     天和
 *   isChihou: boolean     地和
 */

const T = require('./tiles')

/**
 * 判定所有成立的役
 * @param {Object} decomp 拆解结果
 * @param {Array} melds 副露列表
 * @param {Object} ctx 上下文
 * @returns {Array} [{name, nameJa, han, isYakuman}]
 */
function judgeYaku(decomp, melds, ctx) {
  // 役满优先判定
  const yakumanList = judgeYakuman(decomp, melds, ctx)
  if (yakumanList.length > 0) {
    return yakumanList
  }

  // 普通役判定
  const yakuList = judgeNormalYaku(decomp, melds, ctx)
  return yakuList
}

// ============ 役满 ============

function judgeYakuman(decomp, melds, ctx) {
  const list = []
  const allMentsu = getAllMentsu(decomp, melds)
  const allTiles = getAllTileIds(decomp, melds)

  // 天和
  if (ctx.isTenhou) {
    list.push({ name: '天和', nameJa: 'テンホウ', han: -1, isYakuman: true, yakumanTimes: 1 })
  }
  // 地和
  if (ctx.isChihou) {
    list.push({ name: '地和', nameJa: 'チーホウ', han: -1, isYakuman: true, yakumanTimes: 1 })
  }

  // 国士无双
  if (decomp.type === 'kokushi') {
    // 国士十三面 = 双倍役满 (和了牌是13种幺九之一且所有幺九都有的情况下听13面)
    const yaochu = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]
    if (ctx.agariTile === decomp.pair) {
      // 单骑等某一种 → 普通国士
      list.push({ name: '国士无双', nameJa: 'コクシムソウ', han: -1, isYakuman: true, yakumanTimes: 1 })
    } else {
      // 十三面听 → 双倍役满
      list.push({ name: '国士无双十三面', nameJa: 'コクシムソウジュウサンメン', han: -1, isYakuman: true, yakumanTimes: 2 })
    }
    return list
  }

  if (decomp.type === 'chitoitsu') {
    // 七对子不可能是役满(除了字一色七对等，但需要检查)
    if (allTiles.every(T.isJihai)) {
      list.push({ name: '字一色', nameJa: 'ツーイーソー', han: -1, isYakuman: true, yakumanTimes: 1 })
    }
    return list
  }

  // 以下仅 regular 拆解

  // 四暗刻
  if (decomp.type === 'regular') {
    const anko = allMentsu.filter(m => (m.type === 'koutsu' && !m.open) || (m.type === 'kantsu' && !m.open))
    // 注意: 荣和时，和了牌构成的刻子算明刻
    const ankoCount = countAnko(decomp, melds, ctx)
    if (ankoCount === 4) {
      // 四暗刻单骑 = 双倍役满
      if (ctx.agariTile === decomp.jantai) {
        list.push({ name: '四暗刻单骑', nameJa: 'スーアンコタンキ', han: -1, isYakuman: true, yakumanTimes: 2 })
      } else {
        list.push({ name: '四暗刻', nameJa: 'スーアンコ', han: -1, isYakuman: true, yakumanTimes: 1 })
      }
    }
  }

  // 大三元
  {
    const sangenKoutsu = T.SANGENPAI.filter(id =>
      allMentsu.some(m => (m.type === 'koutsu' || m.type === 'kantsu') && m.tile === id)
    )
    if (sangenKoutsu.length === 3) {
      list.push({ name: '大三元', nameJa: 'ダイサンゲン', han: -1, isYakuman: true, yakumanTimes: 1 })
    }
  }

  // 字一色
  if (allTiles.every(T.isJihai)) {
    list.push({ name: '字一色', nameJa: 'ツーイーソー', han: -1, isYakuman: true, yakumanTimes: 1 })
  }

  // 绿一色
  if (allTiles.every(T.isGreen)) {
    list.push({ name: '绿一色', nameJa: 'リューイーソー', han: -1, isYakuman: true, yakumanTimes: 1 })
  }

  // 清老头: 全部数牌幺九 (1和9)
  if (allTiles.every(id => T.isNumeral(id) && T.isYaochu(id))) {
    list.push({ name: '清老头', nameJa: 'チンロウトウ', han: -1, isYakuman: true, yakumanTimes: 1 })
  }

  // 小四喜 / 大四喜
  {
    const kazeKoutsu = T.KAZEHAI.filter(id =>
      allMentsu.some(m => (m.type === 'koutsu' || m.type === 'kantsu') && m.tile === id)
    )
    const kazeJantai = decomp.jantai !== undefined && T.isKazehai(decomp.jantai)
    if (kazeKoutsu.length === 4) {
      // 大四喜 = 双倍役满
      list.push({ name: '大四喜', nameJa: 'ダイスーシー', han: -1, isYakuman: true, yakumanTimes: 2 })
    } else if (kazeKoutsu.length === 3 && kazeJantai) {
      list.push({ name: '小四喜', nameJa: 'ショウスーシー', han: -1, isYakuman: true, yakumanTimes: 1 })
    }
  }

  // 四杠子
  {
    const kantsuCount = allMentsu.filter(m => m.type === 'kantsu').length
    if (kantsuCount === 4) {
      list.push({ name: '四杠子', nameJa: 'スーカンツ', han: -1, isYakuman: true, yakumanTimes: 1 })
    }
  }

  // 九莲宝灯 (门前限定)
  if (ctx.isMenzen && decomp.type === 'regular') {
    const chuuren = checkChuuren(allTiles, ctx.agariTile)
    if (chuuren === 2) {
      list.push({ name: '纯正九莲宝灯', nameJa: 'ジュンセイチューレンポウトウ', han: -1, isYakuman: true, yakumanTimes: 2 })
    } else if (chuuren === 1) {
      list.push({ name: '九莲宝灯', nameJa: 'チューレンポウトウ', han: -1, isYakuman: true, yakumanTimes: 1 })
    }
  }

  return list
}

/**
 * 九莲宝灯判定
 * @returns {number} 0=不是, 1=九莲宝灯, 2=纯正九莲宝灯
 */
function checkChuuren(allTiles, agariTile) {
  if (allTiles.length !== 14) return 0
  // 必须同一花色的数牌
  const suit = T.getSuit(allTiles[0])
  if (suit === T.SUIT_JIHAI) return 0
  if (!allTiles.every(t => T.getSuit(t) === suit)) return 0

  const counts = new Array(9).fill(0)
  for (const t of allTiles) {
    counts[t % 9]++
  }

  // 基本型: 1112345678999 + 任意一张同花色
  // 即 counts[0]>=3, counts[8]>=3, 其余>=1, 总共14张
  const base = [3, 1, 1, 1, 1, 1, 1, 1, 3] // 共13张
  for (let i = 0; i < 9; i++) {
    if (counts[i] < base[i]) return 0
  }

  // 纯正九莲: 和了牌去掉后正好是 1112345678999
  const agariNum = agariTile % 9
  const remaining = counts.slice()
  remaining[agariNum]--
  const isPure = remaining.every((c, i) => c === base[i])
  return isPure ? 2 : 1
}

// ============ 普通役 ============

function judgeNormalYaku(decomp, melds, ctx) {
  const list = []
  const allMentsu = getAllMentsu(decomp, melds)
  const allTiles = getAllTileIds(decomp, melds)
  const isMenzen = ctx.isMenzen

  // === 1番役 ===

  // 立直
  if (ctx.isRiichi && !ctx.isDoubleRiichi) {
    list.push({ name: '立直', nameJa: 'リーチ', han: 1 })
  }

  // 双立直
  if (ctx.isDoubleRiichi) {
    list.push({ name: '双立直', nameJa: 'ダブルリーチ', han: 2 })
  }

  // 一发
  if (ctx.isIppatsu) {
    list.push({ name: '一发', nameJa: 'イッパツ', han: 1 })
  }

  // 门前清自摸和
  if (isMenzen && ctx.isTsumo) {
    list.push({ name: '门前清自摸和', nameJa: 'メンゼンツモ', han: 1 })
  }

  // 海底摸月 / 河底捞鱼
  if (ctx.isHaitei) {
    if (ctx.isTsumo) {
      list.push({ name: '海底摸月', nameJa: 'ハイテイ', han: 1 })
    } else {
      list.push({ name: '河底捞鱼', nameJa: 'ホウテイ', han: 1 })
    }
  }

  // 岭上开花
  if (ctx.isRinshan) {
    list.push({ name: '岭上开花', nameJa: 'リンシャンカイホウ', han: 1 })
  }

  // 抢杠
  if (ctx.isChankan) {
    list.push({ name: '抢杠', nameJa: 'チャンカン', han: 1 })
  }

  // 以下需要基于拆解结构判定
  if (decomp.type === 'chitoitsu') {
    // 七对子
    list.push({ name: '七对子', nameJa: 'チートイツ', han: 2 })

    // 七对子下的其他可能役: 断幺九, 混老头, 混一色, 清一色
    checkTanyao(allTiles, isMenzen, list)
    checkHonroutou(allTiles, allMentsu, decomp, list)
    checkHonitsu(allTiles, isMenzen, list)
    checkChinitsu(allTiles, isMenzen, list)

    return list
  }

  if (decomp.type === 'kokushi') {
    // 国士已在役满判定中处理，不应到达这里
    return list
  }

  // === regular 拆解 ===

  // 平和 (门前限定)
  if (isMenzen) {
    const isPinfu = checkPinfu(decomp, allMentsu, ctx)
    if (isPinfu) {
      list.push({ name: '平和', nameJa: 'ピンフ', han: 1 })
    }
  }

  // 断幺九
  checkTanyao(allTiles, isMenzen, list)

  // 役牌
  checkYakuhai(allMentsu, ctx, list)

  // 一杯口 / 二杯口 (门前限定)
  if (isMenzen) {
    checkIipeikou(decomp, list)
  }

  // === 2番役 ===

  // 三色同顺
  checkSanshoku(allMentsu, isMenzen, list)

  // 一气通贯
  checkIttsu(allMentsu, isMenzen, list)

  // 混全带幺九
  checkChanta(allMentsu, decomp, isMenzen, list)

  // 对对和
  checkToitoi(allMentsu, list)

  // 三暗刻
  {
    const ankoCount = countAnko(decomp, melds, ctx)
    if (ankoCount === 3) {
      list.push({ name: '三暗刻', nameJa: 'サンアンコ', han: 2 })
    }
  }

  // 三色同刻
  checkSanshokuDoukou(allMentsu, list)

  // 混老头
  checkHonroutou(allTiles, allMentsu, decomp, list)

  // 小三元
  checkShousangen(allMentsu, decomp, list)

  // 三杠子
  {
    const kantsuCount = allMentsu.filter(m => m.type === 'kantsu').length
    if (kantsuCount === 3) {
      list.push({ name: '三杠子', nameJa: 'サンカンツ', han: 2 })
    }
  }

  // === 3番役 ===

  // 纯全带幺九
  checkJunchan(allMentsu, decomp, isMenzen, list)

  // 混一色
  checkHonitsu(allTiles, isMenzen, list)

  // === 6番役 ===

  // 清一色
  checkChinitsu(allTiles, isMenzen, list)

  return list
}

// ============ 各役种判定函数 ============

/** 平和判定 */
function checkPinfu(decomp, allMentsu, ctx) {
  // 条件: 门前, 4组顺子, 雀头非役牌, 双面听
  if (decomp.type !== 'regular') return false

  // 所有面子必须是顺子(手牌拆出的部分)
  for (const m of decomp.mentsu) {
    if (m.type !== 'shuntsu') return false
  }

  // 雀头不能是役牌
  const j = decomp.jantai
  if (T.isSangenpai(j)) return false
  if (j === ctx.bakaze) return false
  if (j === ctx.jikaze) return false

  // 必须是双面听: 和了牌在某个顺子的两端
  const agari = ctx.agariTile
  let isRyanmen = false
  for (const m of decomp.mentsu) {
    if (m.type === 'shuntsu') {
      const t0 = m.tile
      const t2 = m.tile + 2
      // 双面: 和了牌是顺子最小牌且不是789的7, 或最大牌且不是123的3
      if (agari === t0 && (t0 % 9) !== 6) {
        isRyanmen = true
        break
      }
      if (agari === t2 && (t2 % 9) !== 2) {
        isRyanmen = true
        break
      }
    }
  }

  return isRyanmen
}

/** 断幺九 (雀魂: 副露可) */
function checkTanyao(allTiles, isMenzen, list) {
  if (allTiles.every(T.isChuchan)) {
    list.push({ name: '断幺九', nameJa: 'タンヤオ', han: 1 })
  }
}

/** 役牌判定 */
function checkYakuhai(allMentsu, ctx, list) {
  for (const m of allMentsu) {
    if (m.type !== 'koutsu' && m.type !== 'kantsu') continue
    const id = m.tile
    // 三元牌
    if (id === T.HAKU) list.push({ name: '役牌:白', nameJa: 'ヤクハイ:ハク', han: 1 })
    if (id === T.HATSU) list.push({ name: '役牌:发', nameJa: 'ヤクハイ:ハツ', han: 1 })
    if (id === T.CHUN) list.push({ name: '役牌:中', nameJa: 'ヤクハイ:チュン', han: 1 })
    // 场风
    if (id === ctx.bakaze) list.push({ name: '役牌:场风', nameJa: 'ヤクハイ:バカゼ', han: 1 })
    // 自风
    if (id === ctx.jikaze) list.push({ name: '役牌:自风', nameJa: 'ヤクハイ:ジカゼ', han: 1 })
  }
}

/** 一杯口 / 二杯口 */
function checkIipeikou(decomp, list) {
  if (decomp.type !== 'regular') return
  const shuntsuList = decomp.mentsu.filter(m => m.type === 'shuntsu').map(m => m.tile)
  const counts = {}
  for (const t of shuntsuList) {
    counts[t] = (counts[t] || 0) + 1
  }
  const pairCount = Object.values(counts).filter(c => c >= 2).length
  if (pairCount >= 2) {
    list.push({ name: '二杯口', nameJa: 'リャンペーコー', han: 3 })
  } else if (pairCount === 1) {
    list.push({ name: '一杯口', nameJa: 'イーペーコー', han: 1 })
  }
}

/** 三色同顺 */
function checkSanshoku(allMentsu, isMenzen, list) {
  const shuntsu = allMentsu.filter(m => m.type === 'shuntsu')
  for (const s of shuntsu) {
    const num = s.tile % 9
    const suits = [T.SUIT_MAN, T.SUIT_PIN, T.SUIT_SOU]
    const allFound = suits.every(suit =>
      shuntsu.some(m => m.tile === suit * 9 + num)
    )
    if (allFound) {
      list.push({ name: '三色同顺', nameJa: 'サンショクドウジュン', han: isMenzen ? 2 : 1 })
      return
    }
  }
}

/** 一气通贯 */
function checkIttsu(allMentsu, isMenzen, list) {
  const shuntsu = allMentsu.filter(m => m.type === 'shuntsu')
  for (let suit = 0; suit < 3; suit++) {
    const base = suit * 9
    const has123 = shuntsu.some(m => m.tile === base)
    const has456 = shuntsu.some(m => m.tile === base + 3)
    const has789 = shuntsu.some(m => m.tile === base + 6)
    if (has123 && has456 && has789) {
      list.push({ name: '一气通贯', nameJa: 'イッツー', han: isMenzen ? 2 : 1 })
      return
    }
  }
}

/** 混全带幺九 (チャンタ) */
function checkChanta(allMentsu, decomp, isMenzen, list) {
  if (decomp.type !== 'regular') return
  // 每组面子和雀头都含幺九或字牌, 且至少有字牌和顺子
  let hasJihai = false
  let hasShuntsu = false
  const mentsuAll = allMentsu
  for (const m of mentsuAll) {
    if (!mentsuHasYaochu(m)) return
    if (m.type === 'shuntsu') hasShuntsu = true
    const tiles = mentsuTiles(m)
    if (tiles.some(T.isJihai)) hasJihai = true
  }
  // 雀头
  if (!T.isYaochu(decomp.jantai)) return
  if (T.isJihai(decomp.jantai)) hasJihai = true

  // 有字牌 → 混全带; 纯数牌幺九 → 纯全带 (在 junchan 中判)
  // 如果同时满足纯全带，不判混全带
  if (hasJihai && hasShuntsu) {
    list.push({ name: '混全带幺九', nameJa: 'チャンタ', han: isMenzen ? 2 : 1 })
  }
}

/** 纯全带幺九 (ジュンチャン) */
function checkJunchan(allMentsu, decomp, isMenzen, list) {
  if (decomp.type !== 'regular') return
  let hasShuntsu = false
  for (const m of allMentsu) {
    if (!mentsuHasYaochu(m)) return
    if (m.type === 'shuntsu') hasShuntsu = true
    // 不能有字牌
    const tiles = mentsuTiles(m)
    if (tiles.some(T.isJihai)) return
  }
  if (!T.isYaochu(decomp.jantai) || T.isJihai(decomp.jantai)) return
  if (hasShuntsu) {
    list.push({ name: '纯全带幺九', nameJa: 'ジュンチャン', han: isMenzen ? 3 : 2 })
  }
}

/** 对对和 */
function checkToitoi(allMentsu, list) {
  if (allMentsu.every(m => m.type === 'koutsu' || m.type === 'kantsu')) {
    list.push({ name: '对对和', nameJa: 'トイトイ', han: 2 })
  }
}

/** 三色同刻 */
function checkSanshokuDoukou(allMentsu, list) {
  const koutsu = allMentsu.filter(m => m.type === 'koutsu' || m.type === 'kantsu')
    .filter(m => T.isNumeral(m.tile))
  for (const k of koutsu) {
    const num = k.tile % 9
    const suits = [T.SUIT_MAN, T.SUIT_PIN, T.SUIT_SOU]
    const allFound = suits.every(suit =>
      koutsu.some(m => m.tile === suit * 9 + num)
    )
    if (allFound) {
      list.push({ name: '三色同刻', nameJa: 'サンショクドウコク', han: 2 })
      return
    }
  }
}

/** 混老头 */
function checkHonroutou(allTiles, allMentsu, decomp, list) {
  if (allTiles.every(T.isYaochu) && allTiles.some(T.isJihai) && allTiles.some(T.isNumeral)) {
    list.push({ name: '混老头', nameJa: 'ホンロウトウ', han: 2 })
  }
}

/** 小三元 */
function checkShousangen(allMentsu, decomp, list) {
  const sangenKoutsu = T.SANGENPAI.filter(id =>
    allMentsu.some(m => (m.type === 'koutsu' || m.type === 'kantsu') && m.tile === id)
  )
  const sangenJantai = decomp.jantai !== undefined && T.SANGENPAI.includes(decomp.jantai)
  if (sangenKoutsu.length === 2 && sangenJantai) {
    list.push({ name: '小三元', nameJa: 'ショウサンゲン', han: 2 })
  }
}

/** 混一色 */
function checkHonitsu(allTiles, isMenzen, list) {
  for (let suit = 0; suit < 3; suit++) {
    if (allTiles.every(t => T.getSuit(t) === suit || T.isJihai(t))) {
      if (allTiles.some(T.isJihai) && allTiles.some(t => T.getSuit(t) === suit)) {
        list.push({ name: '混一色', nameJa: 'ホンイーソー', han: isMenzen ? 3 : 2 })
        return
      }
    }
  }
}

/** 清一色 */
function checkChinitsu(allTiles, isMenzen, list) {
  for (let suit = 0; suit < 3; suit++) {
    if (allTiles.every(t => T.getSuit(t) === suit)) {
      list.push({ name: '清一色', nameJa: 'チンイーソー', han: isMenzen ? 6 : 5 })
      return
    }
  }
}

// ============ 工具函数 ============

/**
 * 合并拆解结果和副露为统一的 mentsu 列表
 */
function getAllMentsu(decomp, melds) {
  const { meldToMentsu } = require('./decompose')
  const result = []

  if (decomp.type === 'regular') {
    // 手牌中拆出的面子 (暗面子)
    for (const m of decomp.mentsu) {
      result.push({ ...m, open: false })
    }
  }

  // 副露
  if (melds) {
    for (const meld of melds) {
      const m = meldToMentsu(meld)
      if (m) result.push(m)
    }
  }

  return result
}

/**
 * 获取所有牌的ID列表
 */
function getAllTileIds(decomp, melds) {
  const tiles = []

  if (decomp.type === 'regular') {
    // 面子
    for (const m of decomp.mentsu) {
      if (m.type === 'shuntsu') {
        tiles.push(m.tile, m.tile + 1, m.tile + 2)
      } else if (m.type === 'koutsu') {
        tiles.push(m.tile, m.tile, m.tile)
      }
    }
    // 雀头
    tiles.push(decomp.jantai, decomp.jantai)
  } else if (decomp.type === 'chitoitsu') {
    for (const p of decomp.pairs) {
      tiles.push(p, p)
    }
  } else if (decomp.type === 'kokushi') {
    const yaochu = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]
    for (const id of yaochu) {
      tiles.push(id)
    }
    tiles.push(decomp.pair)
  }

  // 副露
  if (melds) {
    for (const meld of melds) {
      for (const t of meld.tiles) {
        tiles.push(typeof t === 'object' ? t.id : t)
      }
    }
  }

  return tiles
}

/**
 * 计算暗刻数量 (考虑荣和时和了牌构成的刻子算明刻)
 */
function countAnko(decomp, melds, ctx) {
  if (decomp.type !== 'regular') return 0
  let count = 0

  // 手牌中的暗刻
  for (const m of decomp.mentsu) {
    if (m.type === 'koutsu') {
      // 荣和时，如果和了牌是这组刻子的牌，算明刻
      if (!ctx.isTsumo && m.tile === ctx.agariTile) {
        // 这组刻子可能是因为荣和的牌凑成的，算明刻
        // 但如果有多组同牌刻子，只有一组算明刻(实际不可能有多组同牌刻子)
        continue
      }
      count++
    }
  }

  // 副露中的暗杠
  if (melds) {
    for (const meld of melds) {
      if (meld.type === 'ankan') count++
    }
  }

  return count
}

/** 面子是否含幺九牌 */
function mentsuHasYaochu(m) {
  const tiles = mentsuTiles(m)
  return tiles.some(T.isYaochu)
}

/** 获取面子的所有牌ID */
function mentsuTiles(m) {
  if (m.type === 'shuntsu') return [m.tile, m.tile + 1, m.tile + 2]
  if (m.type === 'koutsu') return [m.tile, m.tile, m.tile]
  if (m.type === 'kantsu') return [m.tile, m.tile, m.tile, m.tile]
  return []
}

module.exports = {
  judgeYaku,
  getAllMentsu,
  getAllTileIds,
  countAnko
}
