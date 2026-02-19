/**
 * 役种速查数据 (参考雀魂规则)
 * 每个役种包含: name, nameJa, han, hanOpen(副露时番数, null=门前限定),
 *   category, desc(简要说明), condition(成立条件), example(示例手牌)
 */

const YAKU_DATA = [
  // === 1番役 ===
  {
    name: '立直', nameJa: 'リーチ', han: 1, hanOpen: null,
    category: '1番', menzenOnly: true,
    desc: '门前听牌宣言',
    condition: '门前状态下听牌时宣言立直，支付1000点立直棒',
    example: { hand: '234m567p11s', melds: [], agari: '2s', note: '听1s-4s双面' }
  },
  {
    name: '一发', nameJa: 'イッパツ', han: 1, hanOpen: null,
    category: '1番', menzenOnly: true,
    desc: '立直后一巡内和了',
    condition: '立直宣言后到自己下一次摸牌之间和了（中间无人鸣牌）'
  },
  {
    name: '门前清自摸和', nameJa: 'メンゼンツモ', han: 1, hanOpen: null,
    category: '1番', menzenOnly: true,
    desc: '门前状态下自摸和了',
    condition: '没有吃碰明杠的情况下自摸和牌'
  },
  {
    name: '平和', nameJa: 'ピンフ', han: 1, hanOpen: null,
    category: '1番', menzenOnly: true,
    desc: '全顺子+非役牌雀头+双面听',
    condition: '4组顺子、雀头不是役牌（三元牌/场风/自风）、双面听和了',
    example: { hand: '123m456p789s23p', melds: [], agari: '1p', note: '1p-4p双面听' }
  },
  {
    name: '一杯口', nameJa: 'イーペーコー', han: 1, hanOpen: null,
    category: '1番', menzenOnly: true,
    desc: '两组相同的顺子',
    condition: '门前状态下有两组完全相同的顺子（同花色同数字）',
    example: { hand: '112233m456p77s', melds: [], agari: '7s', note: '11-22-33万为两组123万' }
  },
  {
    name: '断幺九', nameJa: 'タンヤオ', han: 1, hanOpen: 1,
    category: '1番', menzenOnly: false,
    desc: '手牌全部为中张牌(2-8)',
    condition: '手牌（含副露）中不包含任何幺九牌（1、9、字牌）',
    example: { hand: '234m567p22s', melds: [{ type: 'pon', tiles: '888s' }], agari: '2s' }
  },
  {
    name: '役牌:白', nameJa: 'ヤクハイ:ハク', han: 1, hanOpen: 1,
    category: '1番', menzenOnly: false,
    desc: '白的刻子/杠子',
    condition: '拥有白的刻子或杠子'
  },
  {
    name: '役牌:发', nameJa: 'ヤクハイ:ハツ', han: 1, hanOpen: 1,
    category: '1番', menzenOnly: false,
    desc: '发的刻子/杠子',
    condition: '拥有发的刻子或杠子'
  },
  {
    name: '役牌:中', nameJa: 'ヤクハイ:チュン', han: 1, hanOpen: 1,
    category: '1番', menzenOnly: false,
    desc: '中的刻子/杠子',
    condition: '拥有中的刻子或杠子'
  },
  {
    name: '役牌:场风', nameJa: 'ヤクハイ:バカゼ', han: 1, hanOpen: 1,
    category: '1番', menzenOnly: false,
    desc: '场风牌的刻子/杠子',
    condition: '拥有当前场风（東场的東、南场的南）的刻子或杠子'
  },
  {
    name: '役牌:自风', nameJa: 'ヤクハイ:ジカゼ', han: 1, hanOpen: 1,
    category: '1番', menzenOnly: false,
    desc: '自风牌的刻子/杠子',
    condition: '拥有自己座位风（東/南/西/北）的刻子或杠子'
  },
  {
    name: '海底摸月', nameJa: 'ハイテイ', han: 1, hanOpen: 1,
    category: '1番', menzenOnly: false,
    desc: '摸牌山最后一张牌自摸和了',
    condition: '摸到牌山最后一张牌时自摸和了'
  },
  {
    name: '河底捞鱼', nameJa: 'ホウテイ', han: 1, hanOpen: 1,
    category: '1番', menzenOnly: false,
    desc: '最后一张打出的牌荣和',
    condition: '牌山摸完后最后一张打出的牌荣和'
  },
  {
    name: '岭上开花', nameJa: 'リンシャンカイホウ', han: 1, hanOpen: 1,
    category: '1番', menzenOnly: false,
    desc: '杠后从岭上牌自摸和了',
    condition: '开杠后摸到的岭上牌为和了牌'
  },
  {
    name: '抢杠', nameJa: 'チャンカン', han: 1, hanOpen: 1,
    category: '1番', menzenOnly: false,
    desc: '他家加杠时荣和',
    condition: '他家将碰的牌加杠时，该牌恰好是自己的和了牌'
  },

  // === 2番役 ===
  {
    name: '双立直', nameJa: 'ダブルリーチ', han: 2, hanOpen: null,
    category: '2番', menzenOnly: true,
    desc: '第一巡宣言立直',
    condition: '自己第一次摸牌时（且之前无人鸣牌）宣言立直'
  },
  {
    name: '七对子', nameJa: 'チートイツ', han: 2, hanOpen: null,
    category: '2番', menzenOnly: true,
    desc: '7组对子（固定25符）',
    condition: '手牌由7组不同的对子组成',
    example: { hand: '1133m2277p4499s', melds: [], agari: '9s', note: '7组对子' }
  },
  {
    name: '三色同顺', nameJa: 'サンショクドウジュン', han: 2, hanOpen: 1,
    category: '2番', menzenOnly: false,
    desc: '三种花色的同数顺子',
    condition: '万/筒/索三种花色各有一组相同数字的顺子',
    example: { hand: '123m123p123s55m', melds: [], agari: '5m', note: '三花色各有123' }
  },
  {
    name: '一气通贯', nameJa: 'イッツー', han: 2, hanOpen: 1,
    category: '2番', menzenOnly: false,
    desc: '同花色 123+456+789',
    condition: '同一花色中有123、456、789三组顺子',
    example: { hand: '123456789m11p', melds: [], agari: '1p', note: '万子一气通贯' }
  },
  {
    name: '混全带幺九', nameJa: 'チャンタ', han: 2, hanOpen: 1,
    category: '2番', menzenOnly: false,
    desc: '每组面子和雀头都含幺九或字牌',
    condition: '所有面子和雀头都包含幺九牌或字牌，且至少有字牌和顺子',
    example: { hand: '123m789p999s東東', melds: [], agari: '東', note: '每组都有幺九/字牌' }
  },
  {
    name: '对对和', nameJa: 'トイトイ', han: 2, hanOpen: 2,
    category: '2番', menzenOnly: false,
    desc: '4组刻子+雀头',
    condition: '手牌由4组刻子（或杠子）和1组雀头组成',
    example: { hand: '111m99p', melds: [{ type: 'pon', tiles: '333s' }, { type: 'pon', tiles: '777p' }], agari: '9p' }
  },
  {
    name: '三暗刻', nameJa: 'サンアンコ', han: 2, hanOpen: 2,
    category: '2番', menzenOnly: false,
    desc: '3组暗刻',
    condition: '手牌中有3组暗刻（不含副露碰出的明刻）'
  },
  {
    name: '三色同刻', nameJa: 'サンショクドウコク', han: 2, hanOpen: 2,
    category: '2番', menzenOnly: false,
    desc: '三种花色的同数刻子',
    condition: '万/筒/索三种花色各有一组相同数字的刻子'
  },
  {
    name: '混老头', nameJa: 'ホンロウトウ', han: 2, hanOpen: 2,
    category: '2番', menzenOnly: false,
    desc: '全幺九牌+字牌',
    condition: '手牌全部由幺九牌（1、9）和字牌组成'
  },
  {
    name: '小三元', nameJa: 'ショウサンゲン', han: 2, hanOpen: 2,
    category: '2番', menzenOnly: false,
    desc: '2组三元牌刻子+1组三元牌雀头',
    condition: '三元牌（白发中）中有2组刻子和1组雀头'
  },
  {
    name: '三杠子', nameJa: 'サンカンツ', han: 2, hanOpen: 2,
    category: '2番', menzenOnly: false,
    desc: '3组杠子',
    condition: '手牌中有3组杠子（明杠/暗杠均可）'
  },

  // === 3番役 ===
  {
    name: '二杯口', nameJa: 'リャンペーコー', han: 3, hanOpen: null,
    category: '3番', menzenOnly: true,
    desc: '两组一杯口',
    condition: '门前状态下有两组不同的一杯口（即4组顺子两两相同）',
    example: { hand: '112233m556677p', melds: [], agari: '7p', note: '两组一杯口' }
  },
  {
    name: '纯全带幺九', nameJa: 'ジュンチャン', han: 3, hanOpen: 2,
    category: '3番', menzenOnly: false,
    desc: '每组都含数牌幺九（无字牌）',
    condition: '所有面子和雀头都包含数牌的1或9，不能有字牌'
  },
  {
    name: '混一色', nameJa: 'ホンイーソー', han: 3, hanOpen: 2,
    category: '3番', menzenOnly: false,
    desc: '一种花色的数牌+字牌',
    condition: '手牌仅由一种花色的数牌和字牌组成',
    example: { hand: '123456m東東南南南', melds: [], agari: '東', note: '万子+字牌' }
  },

  // === 6番役 ===
  {
    name: '清一色', nameJa: 'チンイーソー', han: 6, hanOpen: 5,
    category: '6番', menzenOnly: false,
    desc: '同一花色的数牌',
    condition: '手牌全部由同一花色的数牌组成，不含字牌',
    example: { hand: '11123456789mm', melds: [], agari: '9m', note: '全部万子' }
  },

  // === 役满 ===
  {
    name: '天和', nameJa: 'テンホウ', han: -1, hanOpen: null,
    category: '役满', menzenOnly: true, isYakuman: true, yakumanTimes: 1,
    desc: '庄家配牌即和',
    condition: '庄家在第一次摸牌时（配牌14张）直接和了'
  },
  {
    name: '地和', nameJa: 'チーホウ', han: -1, hanOpen: null,
    category: '役满', menzenOnly: true, isYakuman: true, yakumanTimes: 1,
    desc: '子家第一巡自摸和',
    condition: '子家在自己第一次摸牌时和了（之前无人鸣牌）'
  },
  {
    name: '国士无双', nameJa: 'コクシムソウ', han: -1, hanOpen: null,
    category: '役满', menzenOnly: true, isYakuman: true, yakumanTimes: 1,
    desc: '13种幺九牌各一+任一重复',
    condition: '手牌包含全部13种幺九牌（1m9m1p9p1s9s東南西北白发中），其中一种为对子',
    example: { hand: '19m19p19s東南西北白发中', melds: [], agari: '中', note: '13面听=双倍役满' }
  },
  {
    name: '四暗刻', nameJa: 'スーアンコ', han: -1, hanOpen: null,
    category: '役满', menzenOnly: true, isYakuman: true, yakumanTimes: 1,
    desc: '4组暗刻',
    condition: '门前状态下有4组暗刻（自摸）。单骑听牌=双倍役满',
    example: { hand: '111m333p555s77p', melds: [], agari: '7p', note: '单骑=双倍役满' }
  },
  {
    name: '大三元', nameJa: 'ダイサンゲン', han: -1, hanOpen: -1,
    category: '役满', menzenOnly: false, isYakuman: true, yakumanTimes: 1,
    desc: '3组三元牌刻子',
    condition: '拥有白、发、中三组刻子或杠子'
  },
  {
    name: '字一色', nameJa: 'ツーイーソー', han: -1, hanOpen: -1,
    category: '役满', menzenOnly: false, isYakuman: true, yakumanTimes: 1,
    desc: '全字牌',
    condition: '手牌全部由字牌（風牌+三元牌）组成'
  },
  {
    name: '绿一色', nameJa: 'リューイーソー', han: -1, hanOpen: -1,
    category: '役满', menzenOnly: false, isYakuman: true, yakumanTimes: 1,
    desc: '全绿色牌（23468索+发）',
    condition: '手牌全部由绿色的牌组成：2索、3索、4索、6索、8索和发'
  },
  {
    name: '清老头', nameJa: 'チンロウトウ', han: -1, hanOpen: -1,
    category: '役满', menzenOnly: false, isYakuman: true, yakumanTimes: 1,
    desc: '全数牌幺九（无字牌）',
    condition: '手牌全部由数牌的1和9组成（不含字牌）'
  },
  {
    name: '小四喜', nameJa: 'ショウスーシー', han: -1, hanOpen: -1,
    category: '役满', menzenOnly: false, isYakuman: true, yakumanTimes: 1,
    desc: '3组风牌刻子+1组风牌雀头',
    condition: '4种风牌中有3种为刻子、1种为雀头'
  },
  {
    name: '大四喜', nameJa: 'ダイスーシー', han: -1, hanOpen: -1,
    category: '役满', menzenOnly: false, isYakuman: true, yakumanTimes: 2,
    desc: '4组风牌刻子（双倍役满）',
    condition: '東南西北四种风牌全部为刻子或杠子'
  },
  {
    name: '四杠子', nameJa: 'スーカンツ', han: -1, hanOpen: -1,
    category: '役满', menzenOnly: false, isYakuman: true, yakumanTimes: 1,
    desc: '4组杠子',
    condition: '手牌中有4组杠子（明杠/暗杠均可）'
  },
  {
    name: '九莲宝灯', nameJa: 'チューレンポウトウ', han: -1, hanOpen: null,
    category: '役满', menzenOnly: true, isYakuman: true, yakumanTimes: 1,
    desc: '1112345678999+同花色任一张',
    condition: '门前同一花色手牌为1112345678999的基本型加上同花色任意一张。纯正（去掉和了牌刚好为基本型）=双倍役满',
    example: { hand: '1112345678999m', melds: [], agari: '5m', note: '纯正=双倍役满' }
  }
]

const CATEGORIES = ['1番', '2番', '3番', '6番', '役满']

module.exports = { YAKU_DATA, CATEGORIES }
