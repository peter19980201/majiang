const Migrations = require('./game-migrations')

function sortedYaku(record) {
  const yaku = Migrations.yaku(record)
  const weight = item => item.isYakuman || item.han < 0 ? 100 + (item.yakumanTimes || 1) : (Number(item.han) || 0)
  return yaku.map((item, index) => ({ item, index }))
    .sort((a, b) => weight(b.item) - weight(a.item) || a.index - b.index)
    .map(entry => entry.item)
}

module.exports = { sortedYaku }
