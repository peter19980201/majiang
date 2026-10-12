const T = require('./tiles')
const meldLabels = { chi: '吃 · 明顺', pon: '碰 · 明刻', minkan: '明杠', kakan: '加杠', ankan: '暗杠 · 不破门前' }

function prepareExample(example) {
  const { context, winningGroup, winningIndex } = example
  const isTsumo = context.agariType === 'tsumo'
  const groups = example.groups.map((text, groupIndex) => {
    const tiles = T.parseTiles(text)
    let label = tiles.length === 2 ? '雀头' : tiles[0] === tiles[1] ? '暗刻' : '顺子'
    if (example.shape === 'pairs') label = '对子'
    else if (example.shape === 'kokushi') label = '幺九牌'
    else if (label === '暗刻' && groupIndex === winningGroup && !isTsumo) label = '荣和成刻 · 非暗刻'
    return {
      label,
      tiles: tiles.map((tid, index) => ({ tid, winning: groupIndex === winningGroup && index === winningIndex }))
    }
  })
  const melds = example.melds.map(m => ({ label: meldLabels[m.type], tiles: T.parseTiles(m.tiles) }))
  const isOpen = example.melds.some(m => m.type !== 'ankan')
  const state = [isOpen ? '副露' : '门前', `${T.tileName(context.bakaze)}场 · ${T.tileName(context.jikaze)}家`]
  if (context.doubleRiichi) state.push('双立直')
  else if (context.riichi) state.push('已立直')
  const winLabel = `${context.tenhou ? '配牌和了张' : isTsumo ? '自摸' : '荣和'} · ${T.tileName(T.parseTiles(example.agari)[0])}`
  return {
    title: example.title, groups, melds, state, winLabel,
    count: groups.reduce((n, g) => n + g.tiles.length, 0) + melds.reduce((n, m) => n + m.tiles.length, 0),
    situation: example.situation, note: example.note
  }
}
module.exports = { prepareExample }
