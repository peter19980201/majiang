// Touch tracking only rejects drags; opening and closing require a click.
Component({
  properties: { expanded: { type:Boolean, value:true } },
  lifetimes: { detached() { this._gesture = null } },
  methods: {
    start(e) {
      this._suppressTap = false
      this._gesture = null
      if (!e.touches || e.touches.length !== 1) { this._suppressTap = true; return }
      const t = e.touches[0]
      this._gesture = { id:t.identifier, x:t.clientX, y:t.clientY, moved:false }
    },
    move(e) {
      const g = this._gesture
      if (!g) return
      if (!e.touches || e.touches.length !== 1 || e.touches[0].identifier !== g.id) { this.cancel(); return }
      const t = e.touches[0]
      if (Math.max(Math.abs(t.clientX-g.x), Math.abs(t.clientY-g.y)) > 8) g.moved = true
    },
    end(e) {
      const g = this._gesture
      this._gesture = null
      if (!g) return
      const t = (e.changedTouches || []).find(t => t.identifier === g.id)
      if (!t) { this._suppressTap = true; return }
      const dx = Math.abs(t.clientX-g.x), dy = t.clientY-g.y
      this._suppressTap = g.moved || Math.max(dx, Math.abs(dy)) > 8
    },
    cancel() { this._gesture = null; this._suppressTap = true },
    tap() {
      if (this._suppressTap) return
      this.triggerEvent('activate')
    }
  }
})
