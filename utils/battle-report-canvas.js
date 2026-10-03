// Layout follows the approved image: the exported poster and preview are identical.
const WIDTH = 750
const HEIGHT = 1220
const FONT = '"Songti SC", "STSong", "SimSun", serif'
// Shrink first, then wrap at the minimum size; never exceed two lines.
function fitName(ctx, value, width, bold = false, maximum = 32, minimum = 20) {
  const text = String(value || '')
  let size = maximum
  const setFont = () => { ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}` }
  setFont()
  while (size > minimum && ctx.measureText(text).width > width) { size--; setFont() }
  if (ctx.measureText(text).width <= width) return { size, lines: [text] }
  const lines = ['']
  for (const ch of Array.from(text)) {
    const index = lines.length - 1
    if (ctx.measureText(lines[index] + ch).width > width) {
      if (lines.length === 2) break
      lines.push(ch)
    } else lines[index] += ch
  }
  return { size, lines }
}
function draw(ctx, report, artwork) {
  ctx.fillStyle = '#faf8ee'; ctx.fillRect(0, 0, WIDTH, HEIGHT)
  if (artwork) ctx.drawImage(artwork, 0, 0, WIDTH, HEIGHT)
  function line(text, x, y, size = 28, color = '#172d25', align = 'center', max = 640, bold = false) {
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align
    ctx.fillText(String(text), x, y, max)
  }
  function roundRect(x,y,w,h,r) {
    ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r)
    ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h)
    ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath()
  }
  // Small vertical seal, brand and subline present in the reference.
  roundRect(50,53,31,60,5); ctx.fillStyle='#35543d';ctx.fill()
  line('日',65,74,16,'#faf8ee'); line('麻',65,99,19,'#faf8ee')
  line('日麻计分助手',96,82,29,'#172d25','left')
  line('以牌会友 · 记录每一场',96,109,17,'#61705b','left')
  line(report.title,375,240,78,'#10291f','center',600,true)
  line(report.date,375,294,28)
  if(report.status === '提前结束') line('提前结束',375,321,18,'#6a7463')
  // One rounded table contains both the column headings and the four results.
  roundRect(67,354,616,378,16); ctx.fillStyle='rgba(255,254,249,0.72)';ctx.fill()
  ctx.save();ctx.clip();ctx.fillStyle='rgba(197,208,180,0.53)';ctx.fillRect(67,416,616,79);ctx.restore()
  ctx.strokeStyle='#d8d8c9';ctx.lineWidth=1;roundRect(67,354,616,378,16);ctx.stroke()
  const xs=[120,260,450,609]
  ;['顺位','玩家','点数','得点'].forEach((s,i)=>line(s,xs[i],395,25))
  report.rows.forEach((r,i)=>{
    const top=416+i*79, baseline=top+53
    ctx.strokeStyle='#deded1';ctx.beginPath();ctx.moveTo(67,top);ctx.lineTo(683,top);ctx.stroke()
    if(i===0){
      const gradient=ctx.createLinearGradient(99,top+16,139,top+64);gradient.addColorStop(0,'#dbc780');gradient.addColorStop(1,'#a48029')
      ctx.beginPath();ctx.arc(120,top+40,25,0,Math.PI*2);ctx.fillStyle=gradient;ctx.fill()
      ctx.strokeStyle='#f2e4b2';ctx.lineWidth=1;ctx.beginPath();ctx.arc(120,top+40,22,0,Math.PI*2);ctx.stroke()
      line(r.rank,120,baseline,37,'#fff9df')
    }else line(r.rank,120,baseline,36)
    const name = fitName(ctx, r.name, 146, i === 0)
    const step = name.size + 4
    name.lines.forEach((s,j)=>line(s,260,top+40+name.size*.34+(j-(name.lines.length-1)/2)*step,name.size,'#142c23','center',146,i===0))
    line(r.pointsText,450,baseline,37,'#172b22','center',150)
    line(r.finalText,609,baseline,37,i===0?'#987024':'#172b22','center',125)
  })
  line(`${report.rules} · ${report.uma}`,375,774,21,'#172d25','center',616)
  ctx.strokeStyle='#babeaa';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(95,795);ctx.lineTo(655,795);ctx.stroke()
  // Gold framed label with corner notches and small side ornaments.
  function plaque(inset){const x=270+inset,y=812+inset,w=210-inset*2,h=47-inset*2,d=9
    ctx.beginPath();ctx.moveTo(x+d,y);ctx.lineTo(x+w-d,y);ctx.lineTo(x+w-d,y+4);ctx.lineTo(x+w,y+d);ctx.lineTo(x+w-4,y+h/2);ctx.lineTo(x+w,y+h-d);ctx.lineTo(x+w-d,y+h-4);ctx.lineTo(x+w-d,y+h);ctx.lineTo(x+d,y+h);ctx.lineTo(x+d,y+h-4);ctx.lineTo(x,y+h-d);ctx.lineTo(x+4,y+h/2);ctx.lineTo(x,y+d);ctx.lineTo(x+d,y+4);ctx.closePath();ctx.stroke()}
  ctx.strokeStyle='#ac9052';plaque(0);plaque(4)
  ;[240,510].forEach(x=>{ctx.beginPath();ctx.arc(x,836,4,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(x<375?195:514,836);ctx.lineTo(x<375?236:555,836);ctx.stroke()})
  line('本场大牌',375,845,28,'#293222')
  const h=report.highlights[0]
  if (h) {
    // Gold double frame, header band, wind tile, score and yaku chips.
    roundRect(67,880,616,226,17);ctx.fillStyle='rgba(255,254,249,0.78)';ctx.fill()
    ctx.strokeStyle='#b79a58';ctx.lineWidth=1.5;ctx.stroke()
    roundRect(71,884,608,218,14);ctx.lineWidth=.6;ctx.stroke()
    ctx.beginPath();ctx.arc(96,907,6,0,Math.PI*2);ctx.fillStyle='#bea66d';ctx.fill()
    line(`${h.shortRound || h.round} · ${h.honbaLabel}`,116,915,24,'#103e32','left',420,true)
    roundRect(590,892,70,32,12);ctx.fillStyle='#e2e8d5';ctx.fill()
    line(h.typeLabel,625,916,23,'#103e32','center',64,true)
    ctx.strokeStyle='#bda66b';ctx.beginPath();ctx.moveTo(88,936);ctx.lineTo(662,936);ctx.stroke()
    roundRect(103,951,64,87,8);ctx.fillStyle='#426749';ctx.fill()
    roundRect(96,955,64,87,8);ctx.fillStyle='#daceaa';ctx.fill()
    roundRect(96,953,62,85,8);ctx.fillStyle='#fbf5e5';ctx.fill();ctx.strokeStyle='#d5c296';ctx.stroke()
    line(h.seatTile !== null ? ['東','南','西','北'][h.seatTile-27] : '和',127,1014,49,'#103e32','center',54,true)
    const name = fitName(ctx,h.name,260,true,36,22)
    name.lines.forEach((s,j)=>line(s,184,978+j*(name.size+2),name.size,'#103e32','left',260,true))
    ctx.strokeStyle='#d4cfb5';ctx.beginPath();ctx.moveTo(460,955);ctx.lineTo(460,1006);ctx.stroke()
    line(`${h.pointsText} 点`,655,997,39,'#103e32','right',182,true)
    line(h.loser ? `放铳 · ${h.loser}` : h.level,184,1033,23,'#354c3b','left',466)
    ctx.strokeStyle='#bda66b';ctx.beginPath();ctx.moveTo(88,1050);ctx.lineTo(662,1050);ctx.stroke()
    line('役种',94,1082,22,'#696b46','left',52)
    let tagX = 162
    const tags = h.tags.split(' · ')
    // Keep all saved yaku visible within the card's dedicated band.
    ctx.font=`20px ${FONT}`
    const total = tags.reduce((sum,tag)=>sum+ctx.measureText(tag).width+24,0)
    const scale = Math.min(1,490 / Math.max(1,total))
    tags.forEach(tag=>{
      ctx.font=`20px ${FONT}`
      const width=(ctx.measureText(tag).width+24)*scale
      roundRect(tagX,1061,width-6,32,7);ctx.fillStyle='#e6ebdc';ctx.fill()
      line(tag,tagX+(width-6)/2,1084,20*scale,'#103e32','center',width-12,true)
      tagX+=width
    })
  } else {
    line('暂无已记录的满贯及以上和牌',375,992,24,'#162c23','center',580)
  }
  line('日麻计分助手 · 本场战报',375,HEIGHT - 60,18,'#364936')
  return HEIGHT
}
module.exports={draw,WIDTH,HEIGHT,fitName}
