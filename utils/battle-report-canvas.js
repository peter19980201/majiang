// Layout follows the approved image: the exported poster and preview are identical.
const WIDTH = 750
const HEIGHT = 1160
const FONT = '"Songti SC", "STSong", "SimSun", serif'
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
    ctx.font=`32px ${FONT}`
    const lines=[];let part=''
    for(const ch of Array.from(String(r.name))){if(part&&ctx.measureText(part+ch).width>146){lines.push(part);part=''}part+=ch}
    if(part)lines.push(part)
    const step=Math.min(33,65/Math.max(1,lines.length))
    lines.forEach((s,j)=>line(s,260,baseline-(lines.length-1)*step/2+j*step,Math.min(32,step),'#142c23','center',146,i===0))
    line(r.pointsText,450,baseline,37,'#172b22','center',150)
    line(r.finalText,609,baseline,37,i===0?'#987024':'#172b22','center',125)
  })
  line(report.rules,375,780,26)
  line(report.uma,375,819,25)
  ctx.strokeStyle='#babeaa';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(95,862);ctx.lineTo(655,862);ctx.stroke()
  // Gold framed label with corner notches and small side ornaments.
  function plaque(inset){const x=270+inset,y=893+inset,w=210-inset*2,h=47-inset*2,d=9
    ctx.beginPath();ctx.moveTo(x+d,y);ctx.lineTo(x+w-d,y);ctx.lineTo(x+w-d,y+4);ctx.lineTo(x+w,y+d);ctx.lineTo(x+w-4,y+h/2);ctx.lineTo(x+w,y+h-d);ctx.lineTo(x+w-d,y+h-4);ctx.lineTo(x+w-d,y+h);ctx.lineTo(x+d,y+h);ctx.lineTo(x+d,y+h-4);ctx.lineTo(x,y+h-d);ctx.lineTo(x+4,y+h/2);ctx.lineTo(x,y+d);ctx.lineTo(x+d,y+4);ctx.closePath();ctx.stroke()}
  ctx.strokeStyle='#ac9052';plaque(0);plaque(4)
  ;[240,510].forEach(x=>{ctx.beginPath();ctx.arc(x,917,4,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(x<375?195:514,917);ctx.lineTo(x<375?236:555,917);ctx.stroke()})
  line('本场大牌',375,926,28,'#293222')
  const h=report.highlights[0]
  line(h?`${h.name} · ${h.shortRound || h.round} · ${h.level}`:'暂无已记录的满贯及以上和牌',375,992,h?31:24,'#162c23','center',580,Boolean(h))
  line('日麻计分助手 · 本场战报',375,1098,20,'#364936')
  return HEIGHT
}
module.exports={draw,WIDTH,HEIGHT}
