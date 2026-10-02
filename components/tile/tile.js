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
  data: { face:'', number:'', suit:'', isRed:false, faceSrc:'', label:'', bodySrc:'' },
  observers: {
    'tid, extra': function(id,extra) { this.updateDisplay(id,extra) }
  },
  lifetimes: { attached() { this.updateDisplay(this.data.tid,this.data.extra) } },
  methods: {
    updateDisplay(id,extra) {
      if (id < 0 || id > 33) { this.setData({ face:'',faceSrc:'',bodySrc:'',number:'',suit:'',label:'',isRed:false }); return }
      const number=['一','二','三','四','五','六','七','八','九'][id%9]
      const face=id<9?'man':id<18?'pin':id<27?'sou':'honor'
      const rank=id%9+1
      const isRed=(extra||'').indexOf('red5')!==-1
      const bodyName = isRed && RED_FIVES[id] ? RED_FIVES[id] : ENGRAVED_TILES[id]
      const bodySrc = bodyName ? '/assets/tiles/engraved-v1/'+bodyName+'.png' : ''
      const faceSrc = face==='pin'||face==='sou' ? '/assets/tiles/'+face+'-'+rank+(isRed&&rank===5?'-red':'')+'.svg' : ''
      const label = face==='honor' ? ['東','南','西','北','白','發','中'][id-27] : number+({man:'万',pin:'筒',sou:'索'})[face]
      this.setData({ bodySrc,faceSrc,label,face,number,suit:face==='honor'?['東','南','西','北','白','發','中'][id-27]:'',isRed })
    }
  }
})
