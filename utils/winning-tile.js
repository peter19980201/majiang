// A decomposition can contain the winning tile in several groups. Score each
// placement separately so yaku, wait fu and concealed triplets use the same one.
function placements(decomp, agariTile) {
  if (decomp.type !== 'regular') return [{ type: decomp.type, mentsuIndex: -1 }]
  const result = []
  if (decomp.jantai === agariTile) result.push({ type: 'tanki', mentsuIndex: -1 })
  decomp.mentsu.forEach((m, mentsuIndex) => {
    if (m.type === 'koutsu' && m.tile === agariTile) {
      result.push({ type: 'shanpon', mentsuIndex })
    } else if (m.type === 'shuntsu' && agariTile >= m.tile && agariTile <= m.tile + 2) {
      const offset = agariTile - m.tile
      let type = 'ryanmen'
      if (offset === 1) type = 'kanchan'
      else if ((offset === 0 && m.tile % 9 === 6) || (offset === 2 && m.tile % 9 === 0)) type = 'penchan'
      result.push({ type, mentsuIndex })
    }
  })
  return result
}

function selected(decomp, agariTile) {
  return decomp.winningTile || placements(decomp, agariTile)[0]
}

module.exports = { placements, selected }
