// Exercise the actual detail-page WXML conditions with saved record data.
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const { describe } = require('../../utils/round-view')
const template = fs.readFileSync(path.join(__dirname, '../../pages/game/round-detail.wxml'), 'utf8')
const meta = template.match(/<view class="result-meta" wx:if="{{(.*?)}}">([\s\S]*?)<\/view>/)
assert(meta, 'detail-page score metadata must be present')
function render(saved) {
  const record = describe(saved)
  const evaluate = expression => vm.runInNewContext(expression, { record })
  if (!evaluate(meta[1])) return ''
  return Array.from(meta[2].matchAll(/<text wx:if="{{(.*?)}}">(.*?)<\/text>/g))
    .filter(match => evaluate(match[1]))
    .map(match => match[2].replace(/{{(.*?)}}/g, (_, expression) => evaluate(expression)))
    .join(' ')
}
// Screenshot regression: an internal -1 han sentinel and unused fu must not leak.
for (const level of ['役满', '双倍役满', '三倍役满']) {
  assert.strictEqual(render({ level, han: -1, fu: 50, points: 64000 }), level)
}
assert.strictEqual(render({ han: 3, fu: 40 }), '3番 40符')
assert.strictEqual(render({ level: '满贯', han: 5, fu: 30 }), '满贯 5番 30符')
assert.strictEqual(render({ level: '累计役满', han: 13, fu: 30 }), '累计役满 13番 30符')
assert.strictEqual(render({ type: 'ron', points: 8000 }), '')
assert.strictEqual(render({ type: 'draw' }), '')
console.log('Yakuman display passed: 8 saved-record cases against the detail-page WXML.')
