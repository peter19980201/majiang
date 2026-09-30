// Display data only; snapshots remain the source of truth for score corrections.
function describe(record) {
  const parts = String(record.round || '').trim().split(/\s+/)
  const tags = (record.yakuSummary || '').trim().split(/\s+/).filter(Boolean)
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
    typeLabel: { ron: '荣和', tsumo: '自摸', draw: '流局' }[record.type] || '记录',
    name: record.type === 'draw' ? '流局' : record.winner,
    tags,
    changes,
    canChange: Boolean(record.before && record.input)
  }
}
module.exports = { describe }
