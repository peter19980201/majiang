const { withShare } = require('../../utils/share')
const { YAKU_DATA, CATEGORIES } = require('../../utils/yaku-data')
const { SPECIAL_SECTIONS } = require('../../utils/special-reference')
const { prepareExample } = require('../../utils/yaku-example-view')

Page(withShare({
  data: {
    rulesTab: 'yaku',
    specialSections: SPECIAL_SECTIONS,
    expandedSpecial: '', visitedSpecial: {},
    categories: CATEGORIES,
    activeCategory: '',
    keyword: '',
    filterMenzen: false,
    filteredYaku: [],
    expandedIndex: -1, expandedYaku:{}
  },

  onLoad() {
    this.allYaku = YAKU_DATA.map((y, i) => ({
      ...y, _index: i, _examples: y.examples.map(prepareExample)
    }))
    this.applyFilter()
  },

  selectRulesTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (['yaku', 'points', 'special'].includes(tab)) this.setData({ rulesTab: tab })
  },

  onSpecialTap(e) {
    const id = e.currentTarget.dataset.id
    if (!SPECIAL_SECTIONS.some(section => section.cards.some(card => card.id === id))) return
    this.setData({ expandedSpecial: this.data.expandedSpecial === id ? '' : id,
      visitedSpecial: { ...this.data.visitedSpecial, [id]: true } })
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
    const item = this.data.filteredYaku[idx]
    if (!item) return
    this.setData({ expandedIndex: this.data.expandedIndex === idx ? -1 : idx,
      expandedYaku: { ...this.data.expandedYaku, [item._index]:true } })
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
}))
