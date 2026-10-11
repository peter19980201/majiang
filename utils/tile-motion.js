// Geometry is measured in the same calculator scope for pages and embedded forms.
function geometry(source, target, root) {
  if (![source,target,root].every(rect => rect && Number.isFinite(rect.left) && Number.isFinite(rect.top)) ||
      ![source.width,source.height,target.width,target.height].every(n => Number.isFinite(n) && n > 0)) return null
  return { left:source.left-root.left, top:source.top-root.top, width:source.width, height:source.height,
    dx:target.left-source.left, dy:target.top-source.top, sx:target.width/source.width, sy:target.height/source.height }
}
const methods = {
  clearTileMotion(render = true) {
    this._tileMotionEpoch = (this._tileMotionEpoch || 0) + 1
    ;(this._tileMotionTimers || []).forEach(clearTimeout)
    this._tileMotionTimers = []
    this._pendingTileFlights = new Map()
    if (render) this.setData({ tileFlights:[], handShift:[], hiddenHandSlots:[], hiddenAgari:false })
  },
  _tileTimer(fn, duration) {
    this._tileMotionTimers = this._tileMotionTimers || []
    let timer
    timer = setTimeout(() => {
      this._tileMotionTimers = this._tileMotionTimers.filter(id => id !== timer)
      fn()
    }, duration)
    this._tileMotionTimers.push(timer)
    return timer
  },
  _reserveTileFlight(targetIndex) {
    if (this._tileMotionInactive || !wx.createSelectorQuery) return { mask:{}, ticket:null }
    const key = (this._tileFlightId || 0) + 1
    this._tileFlightId = key
    const ticket = {id:key,targetIndex,epoch:this._tileMotionEpoch || 0}
    this._pendingTileFlights = this._pendingTileFlights || new Map()
    this._pendingTileFlights.set(key,ticket)
    const mask = targetIndex === 'agari' ? {hiddenAgari:true} : {hiddenHandSlots:Array.from({length:Math.max(this.data.hand.length,targetIndex+1)},(_,i)=>!!this.data.hiddenHandSlots[i])}
    if (targetIndex !== 'agari') mask.hiddenHandSlots[targetIndex] = true
    return { mask, ticket }
  },
  _releaseTileReservation(ticket) {
    this._pendingTileFlights.delete(ticket.id)
    clearTimeout(ticket.timeout)
    this._tileMotionTimers = (this._tileMotionTimers || []).filter(id => id !== ticket.timeout)
  },
  _flyTile(id, red, targetIndex, ticket) {
    if (!ticket || !this._pendingTileFlights || this._pendingTileFlights.get(ticket.id) !== ticket) return
    const epoch = ticket.epoch
    const valid = () => !this._tileMotionInactive && (this._tileMotionEpoch || 0) === epoch && this._pendingTileFlights.get(ticket.id) === ticket
    const fallback = () => {
      if (!valid()) return
      this._releaseTileReservation(ticket)
      this._setTileFlights(this.data.tileFlights)
    }
    if (targetIndex === 'agari' ? this.data.agariTile !== id || this.data.agariRed !== red : this.data.hand[targetIndex] !== id || !!this.data.handRed[targetIndex] !== red) { fallback(); return }
    // A lost measurement callback must not leave a successfully entered tile hidden.
    ticket.timeout = this._tileTimer(fallback,600)
    try {
    const source = `#pick-${id}-${red ? 'red' : 'plain'}`
    const target = targetIndex === 'agari' ? '#agari-flight-target' : `#hand-flight-${targetIndex}`
    const query = wx.createSelectorQuery().in(this)
    query.select(source).boundingClientRect()
    query.select(target).boundingClientRect()
    query.select('.calculator').boundingClientRect()
    query.exec(rects => {
      if (!valid()) return
      const box = geometry(...(rects || []))
      if (!box) { fallback(); return }
      this._releaseTileReservation(ticket)
      const key = ticket.id
      const effect = {id:key,tid:id,red,targetIndex,...box,arrived:false}
      const flights = this.data.tileFlights.concat(effect)
      this._setTileFlights(flights, () => {
        if ((this._tileMotionEpoch || 0) !== epoch) return
        this._tileTimer(() => {
          if ((this._tileMotionEpoch || 0) !== epoch) return
          this._setTileFlights(this.data.tileFlights.map(f => f.id === key ? {...f,arrived:true} : f))
          this._tileTimer(() => {
            if ((this._tileMotionEpoch || 0) === epoch) this._setTileFlights(this.data.tileFlights.filter(f => f.id !== key))
          }, 260)
        }, 20)
      })
    })
    } catch (error) { fallback() }
  },
  _setTileFlights(tileFlights, done) {
    const reserved = [...(this._pendingTileFlights || new Map()).values()]
    const active = tileFlights.concat(reserved)
    const hiddenHandSlots = this.data.hand.map((_,i) => active.some(f => f.targetIndex === i))
    this.setData({tileFlights,hiddenHandSlots,hiddenAgari:active.some(f => f.targetIndex === 'agari')},done)
  },
  _shiftHandAfterRemoval(index) {
    if (this._tileMotionInactive || !wx.createSelectorQuery) return
    const epoch=this._tileMotionEpoch || 0
    wx.createSelectorQuery().in(this).selectAll('.hand-slot').boundingClientRect(rects => {
      if ((this._tileMotionEpoch || 0) !== epoch || !rects) return
      const handShift=this.data.hand.map((_,i) => i>=index && rects[i+1] ? {
        x:rects[i+1].left-rects[i].left,y:rects[i+1].top-rects[i].top
      } : {x:0,y:0})
      this.setData({handShift,handShiftMoving:false},()=>{
        if ((this._tileMotionEpoch || 0) !== epoch) return
        this._tileTimer(()=>{
          if ((this._tileMotionEpoch || 0) !== epoch) return
          this.setData({handShiftMoving:true,handShift:handShift.map(()=>({x:0,y:0}))})
        },20)
      })
    }).exec()
  },
  onShow() { this._tileMotionInactive = false },
  onHide() { this._tileMotionInactive = true; this.clearTileMotion() },
  onUnload() { this._tileMotionInactive = true; this.clearTileMotion(false) },
  onPageScroll() { this.clearTileMotion() },
  cancelTileMotionOnTouch() { if (this.data.tileFlights.length || this.data.handShift.length || (this._pendingTileFlights && this._pendingTileFlights.size)) this.clearTileMotion() }
}
module.exports = { geometry, methods }
