// Shared by normal completion and both early-completion entry points.
function settle(config, players) {
  const uma = config.uma.split('-').map(Number)
  const bonuses = [uma[1], uma[0], -uma[0], -uma[1]]
  return players.map((p, idx) => ({ ...p, idx }))
    .sort((a, b) => b.points - a.points || a.idx - b.idx)
    .map((p, rank) => {
      const rawPt = (p.points - config.returnPoints) / 1000
      return { rank: rank + 1, idx: p.idx, playerId: p.playerId || null,
        name: p.name, points: p.points, rawPt, uma: bonuses[rank], finalPt: rawPt + bonuses[rank] }
    })
}
module.exports = { settle }
