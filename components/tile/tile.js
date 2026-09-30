const PATTERNS = [
  [[50,50]], [[50,23],[50,77]], [[23,20],[50,50],[77,80]],
  [[25,23],[75,23],[25,77],[75,77]],
  [[23,20],[77,20],[50,50],[23,80],[77,80]],
  [[25,18],[75,18],[25,50],[75,50],[25,82],[75,82]],
  [[23,15],[50,23],[77,31],[25,57],[75,57],[25,85],[75,85]],
  [[25,13],[75,13],[25,38],[75,38],[25,63],[75,63],[25,88],[75,88]],
  [[22,18],[50,18],[78,18],[22,50],[50,50],[78,50],[22,82],[50,82],[78,82]]
]
// Full-body artwork for the 34 tile types and three distinct red fives.
const ENGRAVED_TILES = {
  0:'man-1', 1:'man-2', 2:'man-3', 3:'man-4', 4:'man-5',
  5:'man-6', 6:'man-7', 7:'man-8', 8:'man-9',
  9:'pin-1', 10:'pin-2', 11:'pin-3', 12:'pin-4', 13:'pin-5',
  14:'pin-6', 15:'pin-7', 16:'pin-8', 17:'pin-9',
  18:'sou-1', 19:'sou-2', 20:'sou-3', 21:'sou-4', 22:'sou-5',
  23:'sou-6', 24:'sou-7', 25:'sou-8', 26:'sou-9',
  27:'honor-east', 28:'honor-south', 29:'honor-west', 30:'honor-north',
  31:'honor-white', 32:'honor-green', 33:'honor-red'
}
const RED_FIVES = {4:'man-5-red', 13:'pin-5-red', 22:'sou-5-red'}
Component({
  properties: {
    tid: { type:Number,value:-1 },
    size: { type:String,value:'normal' },
    extra: { type:String,value:'' }
  },
  data: { face:'', number:'', suit:'', marks:[], isRed:false, faceSrc:'', label:'', bodySrc:'' },
  observers: {
    'tid, extra': function(id,extra) { this.updateDisplay(id,extra) }
  },
  lifetimes: { attached() { this.updateDisplay(this.data.tid,this.data.extra) } },
  methods: {
    updateDisplay(id,extra) {
      if (id < 0 || id > 33) { this.setData({ face:'',marks:[],faceSrc:'',bodySrc:'',number:'',suit:'',label:'',isRed:false }); return }
      const number=['一','二','三','四','五','六','七','八','九'][id%9]
      const face=id<9?'man':id<18?'pin':id<27?'sou':'honor'
      const rank=id%9+1
      const isRed=(extra||'').indexOf('red5')!==-1
      const bodyName = isRed && RED_FIVES[id] ? RED_FIVES[id] : ENGRAVED_TILES[id]
      const bodySrc = bodyName ? '/assets/tiles/engraved-v1/'+bodyName+'.png' : ''
      const marks=face==='pin'||face==='sou' ? PATTERNS[rank-1].map((p,i)=>({
        x:p[0],y:p[1],red:isRed||(face==='pin'&&((rank===5&&i===2)||(rank===9&&i>=3&&i<6)))
      })) : []
      const faceSrc = face==='pin'||face==='sou' ? '/assets/tiles/'+face+'-'+rank+(isRed&&rank===5?'-red':'')+'.svg' : ''
      const label = face==='honor' ? ['東','南','西','北','白','發','中'][id-27] : number+({man:'万',pin:'筒',sou:'索'})[face]
      this.setData({ bodySrc,faceSrc,label,face,number,suit:face==='honor'?['東','南','西','北','白','發','中'][id-27]:'',marks,isRed })
    }
  }
})
