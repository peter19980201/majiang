const RoundView = require('./round-view')
const Rules = require('./game-rules')
const signed = value => { const n = Number(value); return Number.isFinite(n) ? `${n >= 0 ? '+' : ''}${n.toFixed(1)}` : '—' }
const points = value => Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-US') : '—'
function build(record) {
  const cards = new Map((record.rounds || []).map(round => [round, RoundView.card(round)]))
  const config = record.config || {}
  const players = record.gameState && record.gameState.players || []
  const seatTile = (name, idx, seats = players) => {
    const player = Number.isInteger(idx) && seats[idx] || seats.find(p => p.name === name)
    const wind = player && player.seatWind !== undefined ? player.seatWind :
      Number.isInteger(idx) ? idx : ['東家', '南家', '西家', '北家'].indexOf(String(name).replace('东', '東'))
    return wind >= 0 && wind < 4 ? 27 + wind : null
  }
  const rows = (record.result || []).map(p => ({ ...p, seatTile: seatTile(p.name, p.idx), pointsText: points(p.points), finalText: signed(p.finalPt), umaText: signed(p.uma).replace(/\.0$/, '') }))
  const bigHands = []
  for (const round of record.rounds || []) {
    const winners = round.winners || (round.type === 'ron' || round.type === 'tsumo' ? [{ ...round, name: round.winner }] : [])
    for (const winner of winners) {
      if (!winner.level || !/满贯|跳满|倍满|三倍满|役满/.test(winner.level)) continue
      const level = winner.level
      const weight = /役满/.test(level) ? 5 : /三倍满/.test(level) ? 4 : /倍满/.test(level) ? 3 : /跳满/.test(level) ? 2 : 1
      bigHands.push({
        seatTile: seatTile(winner.name, winner.idx, round.before && round.before.players || players),
        typeLabel: round.type === 'tsumo' ? '自摸' : '荣和',
        pointsText: points(round.winners ? winner.payment : cards.get(round).points || 0),
        loser: round.loser || '', honbaLabel: cards.get(round).honbaLabel,
        name: winner.name, round: round.round || '', shortRound: cards.get(round).roundTitle, level, weight,
        tags: RoundView.sortedYaku(winner).map(y => y.name).join(' · ') || '未记录役种' })
    }
  }
  bigHands.sort((a, b) => b.weight - a.weight)
  const dateParts = String(record.date || '').match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  const date = dateParts ? `${dateParts[1]}.${dateParts[2].padStart(2, '0')}.${dateParts[3].padStart(2, '0')}` : String(record.date || '')
  const type = config.gameType === 'free' ? '自由记分' : config.gameType === 'tonpuu' ? '东风战' : '半庄战'
  const early = Boolean(record.abandoned || record.gameState && record.gameState.endedEarly)
  return { id: record.id, type, title: config.gameType === 'free' ? '对局战报' : config.gameType === 'tonpuu' ? '东风战报' : '半庄战报',
    date, status: early && config.gameType !== 'free' ? '提前结束' : '已结束',
    rows, rules: `${points(config.startPoints)} 起点 · ${points(config.returnPoints)} 返点`,
    uma: `顺位马 ${rows.map(p => p.umaText).join(' / ')}`, ruleSummary: Rules.summary(config),
    highlights: bigHands.slice(0, 3), rounds: (record.rounds || []).map(r => ({
      round: r.round || '',
      roundTitle: cards.get(r).roundTitle,
      honbaLabel: cards.get(r).honbaLabel,
      isDraw: r.type === 'draw',
      typeLabel: cards.get(r).typeLabel,
      drawDescription: r.nagashi ? r.desc : r.abortive ? r.reason || r.desc || '' : r.tenpai || '',
      loser: r.loser || '',
      winners: r.type === 'draw' ? [] : (r.winners || [{ ...r, name: r.winner }]).map(w => ({
        name: w.name || '', seatTile: seatTile(w.name, w.idx, r.before && r.before.players || players),
        pointsText: points(r.winners ? w.payment : cards.get(r).points || 0),
        hanFuText: /役满/.test(w.level || '') ? w.level :
          [Number(w.han) > 0 ? `${w.han}番` : '', Number(w.fu) > 0 ? `${w.fu}符` : ''].filter(Boolean).join(''),
        tags: RoundView.sortedYaku(w).map(y => y.name)
      })),
      yakuEntries: r.type === 'ron' || r.type === 'tsumo'
        ? (r.winners || [r]).map(w => ({
          name: r.winners ? w.name : '',
          tags: RoundView.sortedYaku(w).map(y => y.name)
        })) : [],
      description: r.winners ? r.winners.map(w => `${w.name} 荣和 ${w.payment}点`).join('；') :
        r.type === 'draw' ? (r.nagashi ? r.desc : r.abortive ? `途中流局 · ${r.reason || r.desc || ''}` : `流局 · ${r.tenpai || ''}`) :
        `${r.winner || ''} ${r.type === 'tsumo' ? '自摸' : '荣和'} ${cards.get(r).points || 0}点${r.loser ? ` · 放铳 ${r.loser}` : ''}` })) }
}
function text(report) {
  return [ `${report.title} · ${report.status}`, report.date, '',
    ...report.rows.map(p => `${p.rank}位 ${p.name}｜${p.pointsText}点｜得点 ${p.finalText}`), '',
    report.rules, report.uma, report.ruleSummary, '', '本场大牌',
    ...(report.highlights.length ? report.highlights.map(h => `${h.name} · ${h.round} · ${h.level}\n${h.tags}`) : ['暂无已记录的满贯及以上和牌']),
    '', '逐局记录', ...report.rounds.map(r => [ `${r.round}｜${r.description}`,
      ...(r.yakuEntries || []).map(entry => `${entry.name ? entry.name + ' · ' : ''}役种：${entry.tags.join(' · ') || '未记录役种'}`)
    ].join('\n')), '', '日麻计分助手' ].join('\n')
}
module.exports = { build, text }
