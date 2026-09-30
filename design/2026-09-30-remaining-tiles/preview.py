"""Assemble existing tile PNGs into a review sheet; does not draw tile artwork."""
import base64
from pathlib import Path

here = Path(__file__).resolve().parent
root = here.parents[1]
rows = [
    ('萬子', [f'man-{i}' for i in range(1, 10)]),
    ('筒子', [f'pin-{i}' for i in range(1, 10)]),
    ('索子', [f'sou-{i}' for i in range(1, 10)]),
    ('字牌', ['honor-' + n for n in ['east','south','west','north','white','green','red']]),
    ('赤牌', ['man-5-red', 'pin-5-red', 'sou-5-red']),
]
parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1600" viewBox="0 0 1600 1600">',
         '<rect width="1600" height="1600" fill="#f4f1e8"/>',
         '<text x="70" y="88" font-family="serif" font-size="42" fill="#234a3b">完整牌面 · 传统雕刻系列</text>',
         '<text x="70" y="133" font-family="sans-serif" font-size="23" fill="#758276">34 种普通牌 + 3 种赤五 · 小程序实际素材</text>']
for row, (label, names) in enumerate(rows):
    y = 170 + row * 270
    parts.append(f'<rect x="55" y="{y}" width="1490" height="250" rx="24" fill="#214f40"/>')
    parts.append(f'<text x="77" y="{y+45}" font-family="serif" font-size="26" fill="#f4f1e8">{label}</text>')
    for col, name in enumerate(names):
        data = base64.b64encode((root / 'assets/tiles/engraved-v1' / (name + '.png')).read_bytes()).decode()
        parts.append(f'<image x="{167+col*150}" y="{y+24}" width="142" height="196" href="data:image/png;base64,{data}"/>')
parts.append('</svg>')
(here / 'preview.svg').write_text('\n'.join(parts))
