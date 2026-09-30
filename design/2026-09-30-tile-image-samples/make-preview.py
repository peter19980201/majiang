from pathlib import Path
import base64
P=Path(__file__).parent
root=P.parent.parent
names=['pin-5','sou-3','man-5','honor-east'];labels=['五筒','三索','伍萬','東']
def uri(name):return 'data:image/png;base64,'+base64.b64encode((root/'assets/tiles/engraved-v1'/f'{name}.png').read_bytes()).decode()
def pic(n,x,y,w,h):return f'<image href="{uri(n)}" x="{x}" y="{y}" width="{w}" height="{h}" preserveAspectRatio="none"/>'
s='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 850"><rect width="1200" height="850" fill="#F4F1E8"/><text x="66" y="78" font-family="Songti SC" font-size="32" fill="#203D31">第一批 · 四张正式样板</text><text x="66" y="111" font-family="Helvetica Neue" font-size="13" fill="#718075">IMAGE GENERATED / TRANSPARENT PNG / 192 × 264</text><rect x="44" y="143" width="1112" height="392" rx="20" fill="#194536"/>'
for j,(n,l) in enumerate(zip(names,labels)):
 x=105+j*273
 s+=pic(n,x,177,170,234)
 s+=f'<text x="{x+85}" y="472" text-anchor="middle" font-family="Songti SC" font-size="24" fill="#F3EEDC">{l}</text>'
s+='<text x="66" y="584" font-family="Songti SC" font-size="21" fill="#203D31">小尺寸检查</text>'
for k,(w,h,label) in enumerate([(42,54,'选牌区'),(39,50,'手牌'),(19,25,'副露小牌')]):
 x=66+k*375
 s+=f'<text x="{x}" y="625" font-family="Songti SC" font-size="17" fill="#627062">{label} · {w} × {h}</text>'
 for j,n in enumerate(names):s+=pic(n,x+j*(w+8),650,w,h)
s+='<text x="66" y="789" font-family="Songti SC" font-size="17" fill="#718075">完整牌身已接入组件，选中与禁用状态由小程序绘制。</text></svg>'
(P/'preview.svg').write_text(s)
html='''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>牌面样板验收</title><style>body{background:#f4f1e8;color:#203d31;font-family:system-ui;margin:32px auto;max-width:1000px;padding:0 20px}h1{font-size:26px}p{color:#627062}section{padding:28px;border-radius:18px;margin:20px 0}.pine{background:#194536;color:#f8f5eb}.tiles{display:flex;gap:20px;align-items:start;flex-wrap:wrap}.large img{width:144px;height:198px}.small img{width:42px;height:54px}.mini img{width:19px;height:25px}figure{margin:0;text-align:center}figcaption{margin-top:12px}button{font:inherit;padding:10px 15px;border-radius:10px;border:1px solid #b9c1b5;background:#fff;cursor:pointer}.state{position:relative;border-radius:4px}.agari{outline:2px solid #b69343}.disabled{opacity:.28}</style><h1>四张正式样板</h1><p>image 生成 · 透明 PNG · 192 × 264。下方小尺寸按 375px 屏宽换算；浏览器缩放保持 100%。</p><section class="pine"><div class="tiles large">'''
for n,l in zip(names,labels):html+=f'<figure><img src="../../assets/tiles/engraved-v1/{n}.png" alt="{l}"><figcaption>{l}</figcaption></figure>'
html+='</div></section><h2>选牌区 · 42 × 54 px</h2><section><div class="tiles small">'
for n in names:html+=f'<img src="../../assets/tiles/engraved-v1/{n}.png" alt="{n}">'
html+='</div></section><h2>副露 · 19 × 25 px</h2><section class="pine"><div class="tiles mini">'
for n in names:html+=f'<img src="../../assets/tiles/engraved-v1/{n}.png" alt="{n}">'
html+='</div></section><h2>交互状态</h2><section><div class="tiles small"><figure><img class="state agari" src="../../assets/tiles/engraved-v1/honor-east.png"><figcaption>和了牌</figcaption></figure><figure><img class="disabled" src="../../assets/tiles/engraved-v1/pin-5.png"><figcaption>已用尽</figcaption></figure></div></section>'
(P/'index.html').write_text(html)
