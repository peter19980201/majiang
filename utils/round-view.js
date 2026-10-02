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

// v1/v2 manual ron stored base points separately. Never mutate old snapshots.
function points(record) {
  return record.type === 'ron' && !(record.version >= 3) && record.honbaBonus !== undefined ?
    record.points + record.honbaBonus : record.points
}

// List cards contain only rendered fields, not correction snapshots or hands.
function card(record, latest = true) {
  const parts = String(record.round || '').trim().split(/\s+/)
  const tags = sortedYaku(record).map(yaku => yaku.name)
  return {
    type: record.type, round: record.round, winner: record.winner, loser: record.loser,
    points: points(record), tenpai: record.tenpai, level: record.level,
    roundTitle: parts[0] || '本局',
    honbaLabel: parts.slice(1).join(' ') || '本场未记录',
    typeLabel: record.abortive ? '途中流局' : record.winners ? '多家荣和' : { ron: '荣和', tsumo: '自摸', draw: '流局' }[record.type] || '记录',
    name: record.type === 'draw' ? (record.abortive ? '途中流局' : '流局') : record.winner,
    tags, source: record.input && record.input.source,
    latest,
    canChange: latest && Boolean(record.before && record.input)
  }
}

// Detail data is built on demand; the board retains authoritative snapshots.
function describe(record, latest = true) {
  const changes = record.before && record.after ? record.before.players.map((player, index) => ({
    name: player.name, before: player.points, after: record.after.players[index].points,
    delta: record.after.players[index].points - player.points
  })) : []
  return { ...card(record, latest), changes, desc: record.desc, han: record.han, fu: record.fu,
    riichiCollected: record.riichiCollected,
    winners: record.winners && record.winners.map(winner => ({
      name: winner.name, idx: winner.idx, payment: winner.payment, source: winner.source,
      han: winner.han, fu: winner.fu, level: winner.level, yaku: sortedYaku(winner)
    })) }
}
module.exports = { describe, card, sortedYaku }
