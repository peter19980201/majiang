const { YAKU_DATA, CATEGORIES } = require('../../utils/yaku-data')
const T = require('../../utils/tiles')

Page({
  data: {
    categories: CATEGORIES,
    activeCategory: '',
    keyword: '',
    filterMenzen: false,
    filteredYaku: [],
    expandedIndex: -1
  },

  onLoad() {
    this.allYaku = YAKU_DATA.map((y, i) => {
      const item = { ...y, _index: i }
      if (y.example && y.example.hand) {
        item._handTiles = T.parseTiles(y.example.hand)
        if (y.example.agari) {
          item._agariTile = T.parseTiles(y.example.agari)[0]
        }
      }
      return item
    })
    this.applyFilter()
  },

  onCategoryTap(e) {
    const cat = e.currentTarget.dataset.cat
    this.setData({
      activeCategory: this.data.activeCategory === cat ? '' : cat,
      expandedIndex: -1
    })
    this.applyFilter()
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value, expandedIndex: -1 })
    this.applyFilter()
  },

  onClearKeyword() {
    this.setData({ keyword: '', expandedIndex: -1 })
    this.applyFilter()
  },

  onToggleMenzen() {
    this.setData({ filterMenzen: !this.data.filterMenzen, expandedIndex: -1 })
    this.applyFilter()
  },

  onExpandTap(e) {
    const idx = parseInt(e.currentTarget.dataset.idx)
    this.setData({ expandedIndex: this.data.expandedIndex === idx ? -1 : idx })
  },

  applyFilter() {
    let list = this.allYaku
    const { activeCategory, keyword, filterMenzen } = this.data

    if (activeCategory) {
      list = list.filter(y => y.category === activeCategory)
    }
    if (filterMenzen) {
      list = list.filter(y => y.menzenOnly)
    }
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase()
      list = list.filter(y =>
        y.name.toLowerCase().includes(kw) ||
        y.nameJa.toLowerCase().includes(kw) ||
        y.desc.includes(kw)
      )
    }

    this.setData({ filteredYaku: list })
  }
})
