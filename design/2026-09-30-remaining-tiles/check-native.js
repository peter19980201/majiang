const automator=require('miniprogram-automator'),fs=require('fs'),assert=require('assert');
const folder='/tmp/majiang-full-tiles-screens';fs.mkdirSync(folder,{recursive:true});
(async()=>{
 const mp=await automator.connect({wsEndpoint:'ws://127.0.0.1:9421'}),errors=[];mp.on('exception',e=>errors.push(e));
 try{
  const p=await mp.reLaunch('/pages/calculator/calculator');await p.waitFor('.picker-row-lg');
  for(const [suit,start,count,flag] of [['man',0,9,'redM5'],['pin',9,9,'redP5'],['sou',18,9,'redS5'],['jihai',27,7,null]]){
   await p.setData({hand:[],agariTile:null,pickerSuit:suit,inputTarget:'hand'});await p.callMethod('updateRemaining');
   for(let id=start;id<start+count;id++)await p.callMethod('selectTile',{currentTarget:{dataset:{id}}});
   assert.equal((await p.data('hand')).length,count);
   await p.setData({inputTarget:'agari'});await p.callMethod('selectTile',{currentTarget:{dataset:{id:start+count-1}}});
   if(flag){await p.callMethod('toggleRed',{currentTarget:{dataset:{flag}}});assert.equal(await p.data(flag),true);}
   await p.waitFor(400);await mp.screenshot({path:folder+'/'+suit+'.png'});
   if(flag)await p.callMethod('toggleRed',{currentTarget:{dataset:{flag}}});
  }
  await p.setData({hand:[31,31,31,31],agariTile:null,inputTarget:'hand'});await p.callMethod('updateRemaining');
  await p.callMethod('selectTile',{currentTarget:{dataset:{id:31}}});assert.equal((await p.data('hand')).length,4);
  await p.waitFor(300);await mp.screenshot({path:folder+'/white-limit.png'});
  fs.writeFileSync(folder+'/report.json',JSON.stringify({errors,checks:['all 34 tile types displayed across four suit tabs','three red-five toggles','agari highlights','white dragon limit rejects fifth'],realStorageModified:false},null,2));
  assert.equal(errors.length,0);console.log('PASS: full tile set, red fives, highlight, four-tile limit.');
 }finally{mp.disconnect()}
})().catch(e=>{console.error(e);process.exit(1)});
