Component({
  data: { visible:false, title:'', content:'', confirmText:'确定', cancelText:'取消', showCancel:true },
  lifetimes: { detached() { this.dismiss() } },
  pageLifetimes: { hide() { this.dismiss() } },
  methods: {
    show(options) {
      if (this._pending) {
        const error = { errMsg:'confirmation:fail busy' }
        try { if (options.fail) options.fail(error) } finally { if (options.complete) options.complete(error) }
        return
      }
      this._pending = options
      this.setData({ visible:true, title:options.title || '', content:options.content || '',
        confirmText:options.confirmText || '确定', cancelText:options.cancelText || '取消',
        showCancel:options.showCancel !== false })
    },
    blockTouch() {},
    confirm() { this.resolve(true) },
    cancel() { this.resolve(false) },
    resolve(confirm) {
      const pending = this._pending
      if (!pending) return
      this._pending = null
      this.setData({ visible:false })
      const result = { confirm, cancel:!confirm }
      try { if (pending.success) pending.success(result) }
      finally { if (pending.complete) pending.complete(result) }
    },
    dismiss() {
      const pending = this._pending
      if (!pending) return
      this._pending = null
      this.setData({ visible:false })
      // A lifecycle dismissal is not the cancel button: some legacy choices act on cancel.
      const result = { errMsg:'confirmation:fail dismissed' }
      try { if (pending.fail) pending.fail(result) }
      finally { if (pending.complete) pending.complete(result) }
    }
  }
})
