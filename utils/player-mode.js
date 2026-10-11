// Missing mode means legacy four-player scoring. Never infer it from saved scores.
function count(config) { return config && Number(config.playerCount) === 3 ? 3 : 4 }
function honba(config) { return (count(config) - 1) * 100 }
function zeros(config) { return Array(count(config)).fill(false) }
module.exports = { count, honba, zeros }
