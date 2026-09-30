from pathlib import Path
import json,math
P=Path(__file__).parent
INK='#15252D'; RED='#AF201A'; GREEN='#14563F'
def character(c,x,y,w,h,color):
 d=json.loads((P/(c+'.json')).read_text()); sx=w/d['w'];sy=h/d['h']
 return f'<path fill="{color}" d="{d["path"]}" transform="translate({x-sx*d["x"]} {y+h+sy*d["y"]}) scale({sx} {-sy})"/>'
def pip(x,y,col):
 s=f'<g transform="translate({x} {y})" fill="{col}"><circle r="19" fill="none" stroke="{col}" stroke-width="3.3"/><circle r="14.9" fill="none" stroke="{col}" stroke-width="1.4"/>'
 for i in range(8):
  s+=f'<path transform="rotate({i*45})" d="M0-13 C3.8-12 4.9-8 1.6-5.1 L0-3.7-1.6-5.1 C-4.9-8-3.8-12 0-13Z"/>'
 s+='<circle r="3.1"/></g>'
 return s

def bamboo(x,y):
 return f'''<g transform="translate({x} {y})" fill="{GREEN}">
<path d="M-11-30 Q-7-34-3-30 Q0-27 4-31 Q8-34 12-31 L10-25 Q3-21-10-25Z M-8-23 Q-3-21 0-23 L-1-5-8-4Z M3-23 8-24 9-4 2-5Z M-11-4 Q-6-8 0-4 Q5-1 11-5 L12 2 Q7 6 1 3 Q-4 1-11 5Z M-8 6-1 5 0 23-8 25Z M3 6 9 5 8 24 2 23Z M-11 25 Q-4 20 2 24 Q7 27 11 24 L12 31 Q7 35 1 31 Q-6 29-12 33Z"/>
<path d="M-5-20-5-8 M5-20 6-8 M-5 9-4 21 M5 9 5 21" stroke="#3B8061" stroke-width="1.4" stroke-linecap="round"/></g>'''
faces={
'pin-5':''.join(pip(x,y,c) for x,y,c in [(43,53,INK),(117,53,INK),(80,110,RED),(43,167,INK),(117,167,INK)]),
'sou-3':bamboo(80,58)+bamboo(45,153)+bamboo(115,153),
'man-5':character('伍',29,25,104,76,INK)+character('萬',32,109,98,88,RED),
'honor-east':character('東',25,30,111,161,INK)
}
fx='''<defs><filter id="cut" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB"><feOffset in="SourceAlpha" dy="1.0" result="off"/><feComposite in="SourceAlpha" in2="off" operator="out" result="rim"/><feFlood flood-color="#000" flood-opacity=".32"/><feComposite in2="rim" operator="in"/><feComposite in2="SourceGraphic" operator="over"/></filter></defs>'''
for name,face in faces.items():
 (P/(name+'.svg')).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="160" height="220" viewBox="0 0 160 220">{fx}<g filter="url(#cut)">{face}</g></svg>')
def tile(x,y,w,face):
 h=w*220/160
 return f'''<g transform="translate({x} {y})"><rect x="-2" y="9" width="{w+4}" height="{h}" rx="13" fill="#071D18" opacity=".25"/><rect y="6" width="{w}" height="{h}" rx="12" fill="#B0A786"/><rect y="2" width="{w}" height="{h}" rx="12" fill="#D4CCB4"/><rect width="{w}" height="{h}" rx="12" fill="url(#ivory)" stroke="#DBD6C5" stroke-width="1.2"/><rect x="3" y="3" width="{w-6}" height="{h-6}" rx="10" fill="none" stroke="#FFFFFF" stroke-opacity=".8" stroke-width="1.5"/><svg width="{w}" height="{h}" viewBox="0 0 160 220"><g filter="url(#cut)">{face}</g></svg></g>'''
svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 800">{fx}<defs><linearGradient id="ivory" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#FFFFF8"/><stop offset=".45" stop-color="#F8F5E9"/><stop offset="1" stop-color="#E8E1CB"/></linearGradient><radialGradient id="felt"><stop stop-color="#2B5749"/><stop offset="1" stop-color="#173C32"/></radialGradient></defs><rect width="1200" height="800" fill="#EFEDE5"/><text x="67" y="73" font-family="Songti SC" font-size="30" fill="#203B31">传统刻纹 · 四张试样</text><text x="68" y="106" font-family="Helvetica Neue" font-size="12" letter-spacing="2" fill="#7E8579">02 / ENGRAVED TILE STUDY</text><rect x="42" y="143" width="1116" height="461" rx="20" fill="url(#felt)"/>'''
for j,((name,face),label) in enumerate(zip(faces.items(),['五筒','三索','伍萬','東'])):
 x=108+j*271
 svg+=tile(x,204,170,face)
 svg+=f'<text x="{x+85}" y="507" text-anchor="middle" fill="#E6E8D9" font-family="Songti SC" font-size="24">{label}</text>'
svg+='<text x="68" y="663" fill="#536C5E" font-family="Songti SC" font-size="19">缩小预览</text>'
for j,face in enumerate(faces.values()): svg+=tile(68+j*52,691,38,face)
svg+='<text x="1125" y="731" text-anchor="end" fill="#7A8378" font-family="Songti SC" font-size="17">雕花筒纹 / 竹骨索纹 / 楷书字形</text></svg>'
(P/'preview.svg').write_text(svg)
(P/'NOTES.txt').write_text('Revision 2. Transparent SVG samples; app assets unchanged. Character contours extracted from locally installed STKaitiSC-Black using CoreText, for visual prototype only; font redistribution/production rights not established. Pips and bamboo drawn as original SVG paths.\n')
