const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '../..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const material = read('styles/felt.wxss')
const image = /data:image\/jpeg;base64,([A-Za-z0-9+/=]+)/.exec(material)
assert(image, 'WXSS cloth must load locally without a network request')
assert.deepEqual(Buffer.from(image[1], 'base64'), fs.readFileSync(path.join(root, 'assets/art/table-texture.jpg')))
for (const file of ['styles/theme.wxss', 'styles/score-table.wxss',
  'pages/quick-score/quick-score.wxss', 'pages/reference/reference.wxss',
  'pages/calculator/calculator.wxss', 'pages/game/board.wxss', 'pages/settlement/settlement.wxss']) {
  assert(read(file).trim().endsWith("@import '/styles/felt.wxss';"), `${file}: local background overrides must not remove cloth`)
}
for (const selector of ['.seg.active', '.btn-primary', '.payment-card', '.win-choice.selected']) {
  assert(material.includes(selector), `${selector}: shared material`)
}
assert(/\.confirm-button\.confirm-disabled[^{}]+\{\s*background-image:none;/.test(material), 'disabled controls must lose the active cloth')
assert(!/(?:^|[;{])\s*(?:position|z-index|pointer-events)\s*:/m.test(material), 'material must not add click-blocking layers')
console.log('Felt surfaces: original table asset, local loading, page/component imports and disabled-state reset passed.')
