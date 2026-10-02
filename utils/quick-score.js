const Score = require('./score')

const FU = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110]
const RULE_NOTE = '沿用当前雀魂参考规则：30符4番切上满贯，13番起累计役满。'

function validate(input) {
  const { kind, han, fu, yakumanTimes, agariType, honba, isOya } = input
  if (!['ron', 'tsumo'].includes(agariType) || typeof isOya !== 'boolean') return '请选择庄闲与和牌方式'
  if (!Number.isInteger(honba) || honba < 0 || honba > 99) return '本场数须为 0 至 99'
  if (kind === 'yakuman') {
    return Number.isInteger(yakumanTimes) && yakumanTimes >= 1 && yakumanTimes <= 6 ? '' : '请选择 1 至 6 倍役满'
  }
  if (kind !== 'hanfu' || !Number.isInteger(han) || han < 1 || han > 13) return '请选择 1 至 13 番（13 表示 13 番以上）'
  // At mangan and above fu is not used or recorded.
  if (han >= 5) return ''
  if (!FU.includes(fu)) return '请选择有效符数'
  if (fu === 20 && (agariType !== 'tsumo' || han < 2)) return '20符只适用于自摸，至少2番'
  if (fu === 25 && han < (agariType === 'tsumo' ? 3 : 2)) return '七对子25符：荣和至少2番，自摸至少3番'
  if (fu === 110 && agariType === 'tsumo' && han < 2) return '110符自摸至少2番'
  return ''
}

function calculate(input) {
  const error = validate(input)
  if (error) return { error }
  const isYakuman = input.kind === 'yakuman'
  const fu = isYakuman || input.han >= 5 ? 0 : input.fu
  const score = Score.calculateScore(fu, isYakuman ? 0 : input.han,
    isYakuman ? [{ isYakuman: true, yakumanTimes: input.yakumanTimes }] : [])
  return { ...score, yaku: [], source: 'hanfu',
    quickInput: { kind: input.kind, han: isYakuman ? 0 : input.han, fu,
      yakumanTimes: isYakuman ? input.yakumanTimes : 0 },
    payment: Score.calculatePayment(score.basePoints, input.isOya, input.agariType === 'tsumo', input.honba) }
}

function label(result) {
  return result.han < 0 ? result.level :
    `${result.han >= 13 ? '13番以上' : result.han + '番'}${result.fu ? ' ' + result.fu + '符' : ''}${result.level ? ' · ' + result.level : ''}`
}

function table(isOya, agariType) {
  return FU.map(fu => ({ fu, cells: [1, 2, 3, 4].map(han => {
    const result = calculate({ kind: 'hanfu', han, fu, isOya, agariType, honba: 0 })
    if (result.error) return { han, text: '—', note: result.error }
    const p = result.payment
    return { han, text: agariType === 'ron' ? String(p.total) :
      isOya ? `${p.koPayment}各` : `${p.koPayment}/${p.oyaPayment}`, note: label(result) }
  }) }))
}

module.exports = { FU, RULE_NOTE, validate, calculate, label, table }
