const Migrations = require('./game-migrations')

function restore(record, players, honba) {
  return Migrations.ronEntries(record, players, honba)
}

// Flat fields remain derived mirrors for the existing persisted input schema.
function view(entries, players, loser) {
  const single = entries.length === 1 ? entries[0] : null
  const pending = entries.filter(entry => !Number(entry.points) || entry.editingPoints)
  return {
    multiRonMode: entries.length > 1, selectedWinner: single ? single.idx : -1,
    inputPoints: single ? single.points || '' : '',
    ronCompleted: entries.length - pending.length,
    ronReady: entries.length > 0 && !pending.length && loser >= 0,
    ronPendingHint: !entries.length ? '请选择和了者' : loser < 0 ? '请选择放铳者' :
      pending.length ? `还需录入 ${pending.map(entry => entry.name).join('、')}的和牌` : '已完成录入，可以确认荣和',
    ronChoices: players.map((p, idx) => ({ name: p.name, idx,
      active: entries.some(entry => entry.idx === idx), disabled: idx === loser }))
  }
}
module.exports = { restore, view }
