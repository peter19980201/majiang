"""Compress runtime PNGs with pngquant; keep uncompressed exports for review."""
import json
import shutil
import subprocess
from pathlib import Path

here = Path(__file__).resolve().parent
assets = here.parents[1] / 'assets/tiles/engraved-v1'
backup = here / 'uncompressed-exports'
backup.mkdir(exist_ok=True)
report = []
for src in sorted(assets.glob('*.png')):
    original = backup / src.name
    if not original.exists():
        shutil.copy2(src, original)
    result = subprocess.run(['pngquant', '--quality=85-100', '--speed', '1', '--force', '--output', str(src), str(original)])
    if result.returncode != 0:
        shutil.copy2(original, src)
    report.append({'file': src.name, 'beforeBytes': original.stat().st_size, 'afterBytes': src.stat().st_size, 'quantized': result.returncode == 0})
(here / 'compression-report.json').write_text(json.dumps(report, indent=2))
print(json.dumps({'count':len(report), 'beforeBytes':sum(r['beforeBytes'] for r in report), 'afterBytes':sum(r['afterBytes'] for r in report)}))
