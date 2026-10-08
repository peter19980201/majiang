// Static typography contract; device layout and font rendering need manual QA.
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '../..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const clean = source => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@import\s+[^;]+;/g, '')
const scale = { caption:22, small:24, body:28, label:32, heading:36, title:40, display:48, score:64, hero:96 }
const tokens = read('styles/typography.wxss')
for (const [name, size] of Object.entries(scale)) {
  assert(tokens.includes(`--font-${name}:${size}rpx;`), `fixed design scale: ${name}`)
}
assert(read('app.wxss').includes("@import '/styles/typography.wxss';"))
function walk(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes:true }).flatMap(entry => {
    const file = `${dir}/${entry.name}`
    return entry.isDirectory() ? walk(file) : /\.(wxss|wxml)$/.test(file) ? [file] : []
  })
}
let declarations = 0
for (const file of ['app.wxss', ...walk('pages'), ...walk('components'), ...walk('custom-tab-bar'), ...walk('styles')]) {
  if (file === 'components/tile/tile.wxss') continue // Face lettering scales with tile geometry.
  const source = clean(read(file))
  for (const block of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const declaration of block[2].matchAll(/font-size\s*:\s*([^;\n}]+)/g)) {
      const value = declaration[1].trim()
      if (file === 'pages/game/board.wxss' && block[1].trim() === '.icon-keys') {
        assert.strictEqual(value, '17rpx') // Tiny keyboard drawing, not reading text.
        continue
      }
      if (file === 'pages/game/board.wxss' && block[1].trim() === '.round-summary .round-number') {
        assert.strictEqual(value, '1.2em') // Relative emphasis within the round graphic.
        continue
      }
      const match = /^var\(--font-([a-z]+), (\d+)rpx\)$/.exec(value)
      assert(match, `${file}: unregistered font size ${value}`)
      assert.strictEqual(Number(match[2]), scale[match[1]], `${file}: undefined token or divergent component fallback`)
      declarations++
    }
  }
  if (file.endsWith('.wxml')) assert(!/font-size\s*:/.test(source), `${file}: inline font bypasses scale`)
}
function sizeFor(file, selector) {
  const blocks = [...clean(read(file)).matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(block => block[1].trim() === selector && /font-size:/.test(block[2]))
  assert(blocks.length, `${file}: missing ${selector}`)
  return /font-size:([^;\n}]+)/.exec(blocks.at(-1)[2])[1].trim()
}
for (const [file, selector, expected] of [
  ['app.wxss', 'page', 'var(--font-body, 28rpx)'],
  ['styles/theme.wxss', '.section-title', 'var(--font-label, 32rpx)'],
  ['styles/theme.wxss', '.btn-primary,.btn-secondary,.modal-btn', 'var(--font-label, 32rpx)'],
  ['pages/index/index.wxss', '.home-title', 'var(--font-display, 48rpx)'],
  ['pages/game/board.wxss', '.win-title', 'var(--font-title, 40rpx)'],
  ['pages/game/board.wxss', '.input-overlay-title', 'var(--font-title, 40rpx)'],
  ['pages/result/result.wxss', '.result-points', 'var(--font-hero, 96rpx)'],
  ['pages/quick-score/quick-score.wxss', '.score-total', 'var(--font-score, 64rpx)'],
  ['components/calculator-entry/index.wxss', ':host', 'var(--font-body, 28rpx)'],
  ['components/quick-score-entry/index.wxss', ':host', 'var(--font-body, 28rpx)'],
]) assert.strictEqual(sizeFor(file, selector), expected, `${file}: ${selector}`)
assert(declarations > 250, 'scan must cover all current page/component styles')
console.log(`Typography: ${declarations} declarations checked; shared scale and semantic anchors passed.`)
