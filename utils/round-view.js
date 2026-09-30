const { YAKU_DATA } = require('./yaku-data')
const YAKU_BY_NAME = {}
YAKU_DATA.forEach(yaku => { YAKU_BY_NAME[yaku.name] = yaku })
const DOUBLE_YAKUMAN = ['国士无双十三面', '四暗刻单骑', '大四喜', '纯正九莲宝灯']

// New records retain actual han (including open-hand reductions and dora counts).
// Older name-only records fall back to the reference table when available.
function sortedYaku(record) {
  const hasOpenMeld = Boolean(record.input && record.input.calculatorInput &&
    (record.input.calculatorInput.melds || []).some(meld => meld.type !== 'ankan'))
  const yaku = record.yaku && record.yaku.length ? record.yaku :
    (record.yakuSummary || '').trim().split(/\s+/).filter(Boolean).map(name => {
      const reference = YAKU_BY_NAME[name]
      return { name, han: reference ? (hasOpenMeld && reference.hanOpen !== null ? reference.hanOpen : reference.han) :
        (DOUBLE_YAKUMAN.includes(name) ? -1 : 0),
        yakumanTimes: DOUBLE_YAKUMAN.includes(name) ? 2 : 1 }
    })
  const weight = item => item.isYakuman || item.han < 0 ? 100 + (item.yakumanTimes || 1) : (Number(item.han) || 0)
  return yaku.map((item, index) => ({ item, index }))
    .sort((a, b) => weight(b.item) - weight(a.item) || a.index - b.index)
    .map(entry => entry.item)
}

// Display data only; snapshots remain the source of truth for score corrections.
function describe(record, latest = true) {
  const parts = String(record.round || '').trim().split(/\s+/)
  const tags = sortedYaku(record).map(yaku => yaku.name)
  const changes = record.before && record.after ? record.before.players.map((player, index) => ({
    name: player.name,
    before: player.points,
    after: record.after.players[index].points,
    delta: record.after.players[index].points - player.points
  })) : []
  return {
    ...record,
    roundTitle: parts[0] || '本局',
    honbaLabel: parts.slice(1).join(' ') || '本场未记录',
    typeLabel: record.abortive ? '途中流局' : record.winners ? '多家荣和' : { ron: '荣和', tsumo: '自摸', draw: '流局' }[record.type] || '记录',
    name: record.type === 'draw' ? (record.abortive ? '途中流局' : '流局') : record.winner,
    tags,
    changes,
    latest,
    canChange: latest && Boolean(record.before && record.input)
  }
}
module.exports = { describe, sortedYaku }
