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
for (const selector of ['.seg.active', '.btn-primary', '.payment-card', '.win-choice.selected', '.home .resume-card', '.home-calculators .menu-item']) {
  assert(material.includes(selector), `${selector}: shared material`)
}
assert(/\.confirm-button\.confirm-disabled[^{}]+\{\s*background-image:none;/.test(material), 'disabled controls must lose the active cloth')
assert(!/(?:^|[;{])\s*(?:position|z-index|pointer-events)\s*:/m.test(material), 'material must not add click-blocking layers')
console.log('Felt surfaces: original table asset, local loading, page/component imports and disabled-state reset passed.')

// The animated selection plate owns the texture; labels stay transparent.
const plateSelector = '.motion-segments > .motion-selection'
assert(material.slice(0, material.indexOf('{')).split(',').map(s => s.trim()).includes(plateSelector), 'sliding green selection plate must share the felt material')
const motion = read('styles/motion.wxss')
const plateRules = motion.match(/\.motion-segments > \.motion-selection\s*\{([^}]+)\}/)[1]
assert(!/(?:^|;)\s*background\s*:/.test(plateRules), 'later motion import must not reset the texture via background shorthand')
assert(!/background-image\s*:/.test(plateRules), 'motion must preserve shared texture')
assert(/background-color\s*:#1d5142/.test(plateRules))
// Resolve each isolated component's imports: page globals do not cross the boundary.
function importedStyles(file, stack = []) {
  assert(!stack.includes(file), 'cyclic style import: ' + file)
  return read(file).replace(/@import\s+['"]([^'"]+)['"];?/g, (_, target) => {
    const resolved = target.startsWith('/') ? target.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(file), target))
    return importedStyles(resolved, [...stack, file])
  })
}
for (const file of ['app.wxss', 'components/calculator-entry/index.wxss', 'components/quick-score-entry/index.wxss', 'components/points-table/index.wxss']) {
  const resolved = importedStyles(file)
  assert(resolved.includes(plateSelector + ','), file + ' imports textured plate selector')
  assert(resolved.includes('data:image/jpeg;base64,'), file + ' imports local cloth')
}
console.log('Animated green selection plates: felt material and isolated-host imports verified; motion cannot erase texture.')

const homeMarkup = read('pages/index/index.wxml')
assert(!/class="(?:card-art|calculator-art)"/.test(homeMarkup), 'old light artwork must not cover the home cloth')
assert(!read('pages/index/index.wxss').includes('.menu-item::after'), 'paper overlay must not cover the home cloth')
