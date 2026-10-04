const { sortedYaku } = require('./yaku-records')

const Migrations = require('./game-migrations')

// List cards contain only rendered fields, not correction snapshots or hands.
function card(record, latest = true) {
  record = Migrations.round(record)
  const label = String(record.round || '').trim()
  const cycle = label.match(/^(第\d+轮)\s*·\s*/)
  const parts = label.replace(/^第\d+轮\s*·\s*/, '').split(/\s+/)
  const tags = sortedYaku(record).map(yaku => yaku.name)
  return {
    type: record.type, round: record.round, winner: record.winner, loser: record.loser,
    points: record.points, tenpai: record.nagashi ? record.desc : record.tenpai, level: record.level,
    roundTitle: (cycle ? cycle[1] + ' · ' : '') + (parts[0] || '本局'),
    honbaLabel: parts.slice(1).join(' ') || '本场未记录',
    typeLabel: record.nagashi ? '流局满贯' : record.abortive ? '途中流局' : record.winners ? '多家荣和' : { ron: '荣和', tsumo: '自摸', draw: '流局' }[record.type] || '记录',
    name: record.type === 'draw' ? (record.nagashi ? '流局满贯' : record.abortive ? '途中流局' : '流局') : record.winner,
    tags, source: record.input && record.input.source,
    latest,
    canChange: latest && record.correctionAvailable
  }
}

// Detail data is built on demand; the board retains authoritative snapshots.
function describe(record, latest = true) {
  const changes = record.before && record.after ? record.before.players.map((player, index) => ({
    name: player.name, before: player.points, after: record.after.players[index].points,
    delta: record.after.players[index].points - player.points
  })) : []
  return { ...card(record, latest), changes, tenpai: record.tenpai, desc: record.desc, han: record.han, fu: record.fu,
    riichiCollected: record.riichiCollected,
    winners: record.winners && record.winners.map(winner => ({
      name: winner.name, idx: winner.idx, payment: winner.payment, source: winner.source,
      han: winner.han, fu: winner.fu, level: winner.level, yaku: sortedYaku(winner)
    })) }
}
module.exports = { describe, card, sortedYaku }
