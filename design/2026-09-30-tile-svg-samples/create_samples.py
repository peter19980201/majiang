from pathlib import Path
P=Path(__file__).parent
G='#194837'; R='#B02E25'; I='#25392D'
def pip(x,y,c):
 return f'<g transform="translate({x} {y})"><circle r="16" fill="{c}"/><circle r="10.5" fill="none" stroke="#FFFCF1" stroke-width="3"/><circle r="4" fill="#FFFCF1"/></g>'
def bamboo(x,y):
 return f'''<g transform="translate({x} {y})" fill="{G}"><path d="M-10-27 Q0-22 10-27 L12-20 7-17 7-5 11-3 11 3 7 5 7 17 12 20 10 27 Q0 22-10 27 L-12 20-7 17-7 5-11 3-11-3-7-5-7-17-12-20Z"/><path d="M-1-17V-6 M-1 6V17" fill="none" stroke="#FFFCF1" stroke-width="3" stroke-linecap="round"/></g>'''
# Deliberately hand-built filled outlines: no font dependencies.
five='''<path d="M47 34H108L115 41 111 45H86L82 62H101L108 58 117 65 111 70 108 89H115L121 97H39L37 89H55L60 69H46L44 62H62L66 45H46Z M72 69 67 89H97L100 69Z" fill-rule="evenodd"/>'''
man='''<path d="M35 112H61V104H72V112H91V104H102V112H125V120H102V126H91V120H72V126H61V120H35Z"/>
<path d="M49 128H111V160H85V166H121V195Q121 204 107 201L99 194H109V174H85V185H96V179H104V193H57V179H65V185H74V174H51V202H40V166H74V160H49Z M60 136V141H74V136Z M85 136V141H100V136Z M60 148V153H74V148Z M85 148V153H100V148Z" fill-rule="evenodd"/>'''
east='''<path d="M74 30 86 33V48H122L129 57H86V69H116V124H94Q108 147 135 161L126 174Q101 159 86 133V190H74V134Q56 160 33 175L25 165Q49 149 65 124H43V69H74V57H30V48H74Z M55 79V92H74V79Z M86 79V92H104V79Z M55 101V114H74V101Z M86 101V114H104V101Z" fill-rule="evenodd"/>'''
faces={
 'pin-5':''.join(pip(x,y,c) for x,y,c in [(43,58,G),(117,58,G),(80,110,R),(43,162,G),(117,162,G)]),
 'sou-3':bamboo(80,62)+bamboo(47,151)+bamboo(113,151),
 'man-5':f'<g fill="{I}">{five}</g><g fill="{R}">{man}</g>',
 'honor-east':f'<g fill="{I}">{east}</g>'
}
for name,face in faces.items():
 (P/(name+'.svg')).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 220" width="160" height="220">{face}</svg>')
def tile(x,y,w,face):
 h=w*220/160
 return f'''<g transform="translate({x} {y})"><rect y="5" width="{w}" height="{h}" rx="{w*.065}" fill="#ADAD90"/><rect width="{w}" height="{h}" rx="{w*.065}" fill="url(#ivory)" stroke="#C9C0A7"/><rect x="3" y="3" width="{w-6}" height="{h-6}" rx="{w*.05}" fill="none" stroke="#FFFEF8"/><svg width="{w}" height="{h}" viewBox="0 0 160 220">{face}</svg></g>'''
svg='''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760"><defs><linearGradient id="ivory" x2=".8" y2="1"><stop stop-color="#FFFEF8"/><stop offset=".65" stop-color="#FBF6E7"/><stop offset="1" stop-color="#EDE5D0"/></linearGradient></defs><rect width="1200" height="760" fill="#F3F1E8"/><text x="70" y="77" fill="#194837" font-family="Helvetica Neue,Arial" font-size="17" letter-spacing="4">RIICHI / TILE STUDIES</text><text x="70" y="125" fill="#25392D" font-family="Songti SC,serif" font-size="30">松绿 · 朱红 · 象牙白</text><text x="1128" y="78" text-anchor="end" fill="#737C70" font-family="Helvetica Neue,Arial" font-size="13">01 — VECTOR SAMPLES</text>'''
labels=['五筒','三索','五萬','東']
for j,(name,face) in enumerate(faces.items()):
 x=108+j*272
 svg+=tile(x,184,168,face)
 svg+=f'<text x="{x+84}" y="460" text-anchor="middle" fill="#25392D" font-family="Songti SC,serif" font-size="23">{labels[j]}</text>'
 svg+=f'<text x="{x+84}" y="486" text-anchor="middle" fill="#7C8377" font-family="Helvetica Neue,Arial" font-size="12" letter-spacing="1">{name.upper()}</text>'
svg+='<path d="M70 527H1130" stroke="#DADCCE"/><text x="70" y="575" fill="#596B59" font-family="Helvetica Neue,Arial" font-size="13" letter-spacing="2">SMALL SIZE / 32 × 44</text>'
for j,face in enumerate(faces.values()): svg+=tile(72+j*46,603,32,face)
svg+='<text x="1128" y="688" text-anchor="end" fill="#7C8377" font-family="Helvetica Neue,Arial" font-size="12">Hand-drawn paths · No embedded fonts in tile assets</text></svg>'
(P/'preview.svg').write_text(svg)
