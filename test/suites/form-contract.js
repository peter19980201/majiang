const assert = require('assert')
const clone = value => JSON.parse(JSON.stringify(value))
const embeddedEntry = require('../../utils/embedded-entry')
const Ron = require('../../utils/ron-entry')
const players = ['東','南','西','北'].map(name => ({ name }))
const legacy = { input: { selectedWinner: 1, inputPoints: '3900', source: 'calculator',
  calculatorInput: { hand: [1,2,3] } }, han: 3, fu: 30, yaku: [{ name: '立直', han: 1 }] }
const original = clone(legacy)
const entries = Ron.restore(legacy, players, 2)
assert.strictEqual(entries[0].calcResult.payment.total, 4500)
const view = Ron.view(entries, players, 0)
assert.strictEqual(view.selectedWinner, 1)
assert.strictEqual(view.inputPoints, '3900')
assert(view.ronReady)
assert.deepStrictEqual(legacy, original)
assert.strictEqual(Ron.view([], players, 0).selectedWinner, -1)
assert.strictEqual(Ron.view([...entries, { idx: 2, name: '西', points: '' }], players, 0).ronReady, false)

// Both hosts share initialization and restoration; only the page uses the event channel.
for (const kind of ['calculator', 'quick-score']) {
  const definition = require(`../../pages/${kind}/definition`)
  const options = { mode: 'board', agariType: 'ron', bakaze: 27, jikaze: 28, honba: 2, riichi: 1 }
  const input = kind === 'calculator' ? { hand: [4], handRed: [true], melds: [], agariTile: null } :
    { kind: 'hanfu', han: 4, fu: 30, yakumanTimes: 1 }
  let listener, returned = 0, events = []
  global.wx = { setNavigationBarTitle() {}, navigateBack() { returned++ } }
  const page = { ...definition, data: clone(definition.data),
    setData(patch) { Object.assign(this.data, patch) },
    getOpenerEventChannel() { return { on(name, fn) { listener = fn }, emit(name, result) { events.push({ name, result }) } } } }
  page.onLoad(options)
  listener(input)
  const componentDefinition = embeddedEntry(definition)
  const component = { ...componentDefinition.methods, data: clone(componentDefinition.data),
    properties: { config: { options, restore: input } },
    setData(patch) { Object.assign(this.data, patch) },
    getOpenerEventChannel() { throw new Error('Embedded forms must not use a channel') },
    triggerEvent(name, result) { events.push({ name, result }) } }
  global.wx = new Proxy({}, { get() { throw new Error('Embedded initialization must not navigate') } })
  componentDefinition.lifetimes.attached.call(component)
  assert.deepStrictEqual(component.data, page.data)
  component.submitResult({ payment: 123 })
  assert.strictEqual(events.at(-1).name, 'result')
  assert.strictEqual(returned, 0)
  component.dismissInput()
  assert.strictEqual(events.at(-1).name, 'dismiss')
  global.wx = { navigateBack() { returned++ } }
  page.submitResult({ payment: 123 })
  assert.strictEqual(events.at(-1).name, 'calcResult')
  assert.strictEqual(returned, 1)
}
console.log('Form contracts passed: legacy restoration, derived ron state and matching standalone/embedded form data with separate host actions.')
