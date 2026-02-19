Component({
  properties: {
    tid: { type: Number, value: -1 },     // 牌种ID (0-33)
    size: { type: String, value: 'normal' }, // normal|small|mini|picker
    extra: { type: String, value: '' },      // 额外class: agari|dark|clickable|disabled
  },

  observers: {
    'tid': function (id) {
      if (id < 0 || id > 33) return
      this.updateDisplay(id)
    }
  },

  data: {
    displayNum: '',
    displaySuit: '',
    suitClass: '',
    sizeClass: 'normal',
    extraClass: ''
  },

  lifetimes: {
    attached() {
      this.setData({ sizeClass: this.data.size, extraClass: this.data.extra })
      if (this.data.tid >= 0) this.updateDisplay(this.data.tid)
    }
  },

  methods: {
    updateDisplay(id) {
      const NUMS = ['一','二','三','四','五','六','七','八','九']
      const JIHAI = ['東','南','西','北','白','发','中']

      let displayNum = ''
      let displaySuit = ''
      let suitClass = ''

      if (id < 9) {
        displayNum = NUMS[id]
        displaySuit = '万'
        suitClass = 'man'
      } else if (id < 18) {
        displayNum = NUMS[id - 9]
        displaySuit = '筒'
        suitClass = 'pin'
      } else if (id < 27) {
        displayNum = NUMS[id - 18]
        displaySuit = '索'
        suitClass = 'sou'
      } else {
        displayNum = JIHAI[id - 27]
        displaySuit = ''
        if (id === 31) suitClass = 'jihai-haku'
        else if (id === 32) suitClass = 'jihai-hatsu'
        else if (id === 33) suitClass = 'jihai-chun'
        else suitClass = 'jihai'
      }

      this.setData({ displayNum, displaySuit, suitClass, sizeClass: this.data.size, extraClass: this.data.extra })
    },

    onTap() {
      this.triggerEvent('tap', { tid: this.data.tid })
    }
  }
})
