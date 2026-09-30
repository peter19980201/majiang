from pathlib import Path
import base64
P=Path(__file__).parent;root=P.parent.parent
names=[f'pin-{i}' for i in range(1,10)];labels=list('一二三四五六七八九')
def img(n,x,y,w,h):
 data=base64.b64encode((root/'assets/tiles/engraved-v1'/f'{n}.png').read_bytes()).decode()
 return f'<image href="data:image/png;base64,{data}" x="{x}" y="{y}" width="{w}" height="{h}" preserveAspectRatio="none"/>'
s='<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1400" viewBox="0 0 1400 980"><rect width="1400" height="980" fill="#F4F1E8"/><text x="65" y="73" font-family="Songti SC" font-size="34" fill="#203D31">筒子 · 一至九</text><text x="65" y="108" font-family="Helvetica Neue" font-size="14" fill="#728073">ENGRAVED PINZU / TRANSPARENT PNG / 192 × 264</text><rect x="40" y="145" width="1320" height="638" rx="22" fill="#194536"/>'
for i,n in enumerate(names):
 row=0 if i<5 else 1;col=i if i<5 else i-5;x=(96 if row==0 else 220)+col*253;y=176+row*300
 s+=img(n,x,y,166,228)
 s+=f'<text x="{x+83}" y="{y+261}" text-anchor="middle" font-family="Songti SC" font-size="23" fill="#F4EFDF">{labels[i]}筒</text>'
s+='<text x="65" y="827" font-family="Songti SC" font-size="20" fill="#203D31">选牌尺寸</text>'
for i,n in enumerate(names):s+=img(n,65+i*54,854,42,54)
s+='<text x="700" y="827" font-family="Songti SC" font-size="20" fill="#203D31">副露小牌</text>'
for i,n in enumerate(names):s+=img(n,700+i*28,854,19,25)
s+='<text x="65" y="950" font-family="Songti SC" font-size="16" fill="#738071">配色与排列核对：AMOS 官方牌面图。五筒保留已确认样板；赤五筒另批制作。</text></svg>'
(P/'preview.svg').write_text(s)
