const DEFAULT_RULES = {
  multipleRon: true, bankruptcy: false,
  extension: false, dealerFinish: false
}
const ABORT_REASONS = ['九种九牌', '四风连打', '四家立直', '四杠散了', '三家和']
function rules(config) { return { ...DEFAULT_RULES, ...(config.rules || {}), multipleRon: true } }
function summary(config) {
  const enabled = rules(config)
  const labels = { bankruptcy: '飞人终局', extension: '延长战', dealerFinish: '庄家首位止' }
  const special = Object.keys(labels).filter(key => enabled[key]).map(key => labels[key])
  return special.length ? special.join(' · ') : '基础规则'
}

// Called after all payments (including riichi) have been applied.
function nextRound(state, dealerContinues, isDraw, abortive = false) {
  const rule = rules(state.config)
  const normalEnd = state.config.gameType === 'tonpuu' ? 1 : 2
  const target = state.config.returnPoints
  const leader = state.players.map((p, idx) => ({ ...p, idx }))
    .sort((a, b) => b.points - a.points || a.idx - b.idx)[0]
  const ended = reason => ({ gameOver: true, endReason: reason })
  if (rule.bankruptcy && state.players.some(p => p.points < 0)) return ended('飞人终局')
  if (!abortive) {
    if (state.roundWind >= normalEnd && rule.extension && leader.points >= target) return ended('延长战达标')
    if (rule.dealerFinish && state.roundNum === 4 && state.roundWind >= normalEnd - 1 &&
        dealerContinues && leader.idx === state.dealerIdx && leader.points >= target) return ended('庄家首位止')
  }
  if (dealerContinues) return { honba: isDraw ? state.honba : state.honba + 1 }
  const next = { dealerIdx: (state.dealerIdx + 1) % 4, roundNum: state.roundNum + 1,
    roundWind: state.roundWind, honba: isDraw ? state.honba : 0 }
  if (next.roundNum > 4) { next.roundNum = 1; next.roundWind++ }
  next.roundWindName = ['東', '南', '西', '北'][next.roundWind] || '終'
  if (next.roundWind >= normalEnd) {
    const canExtend = rule.extension && next.roundWind < normalEnd + 1 && leader.points < target
    if (!canExtend) return { ...next, ...ended(next.roundWind > normalEnd ? '延长场结束' : '规定场结束') }
  }
  return next
}
module.exports = { DEFAULT_RULES, ABORT_REASONS, rules, nextRound, summary }
