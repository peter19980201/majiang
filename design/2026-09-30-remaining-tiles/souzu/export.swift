import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
let root=URL(fileURLWithPath:FileManager.default.currentDirectoryPath)
let design=root.appendingPathComponent("design/2026-09-30-remaining-tiles/souzu")
let output=root.appendingPathComponent("assets/tiles/engraved-v1")
let names=["sou-1","sou-2","sou-4","sou-5","sou-6","sou-7","sou-8","sou-9","sou-5-red"]
var report=[[String:Any]]()
for name in names {
 let url=design.appendingPathComponent("originals/\(name).png")
 let src=CGImageSourceCreateWithURL(url as CFURL,nil)!
 let img=CGImageSourceCreateImageAtIndex(src,0,nil)!
 let w=img.width,h=img.height
 let ctx=CGContext(data:nil,width:w,height:h,bitsPerComponent:8,bytesPerRow:w*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
 ctx.draw(img,in:CGRect(x:0,y:0,width:w,height:h))
 let bytes=ctx.data!.assumingMemoryBound(to:UInt8.self)
 var columns=[Int](repeating:0,count:w),rows=[Int](repeating:0,count:h), transparent=0
 for y in 0..<h { for x in 0..<w {
  let a=bytes[(y*w+x)*4+3]
  if a>240 {columns[x]+=1;rows[y]+=1}
  if a==0 {transparent+=1}
 }}
 precondition(transparent > w*h/30,"Missing transparent background")
 // Trim outer canvas using the opaque tile body; ignore isolated generated speckles.
 let left=columns.firstIndex(where:{$0>h/5})!,right=columns.lastIndex(where:{$0>h/5})!
 let top=rows.firstIndex(where:{$0>w/5})!,bottom=rows.lastIndex(where:{$0>w/5})!
 let bounds=CGRect(x:max(0,left-2),y:max(0,top-2),width:min(w-left+2,right-left+5),height:min(h-top+2,bottom-top+5))
 let cropped=img.cropping(to:bounds)!
 let dest=CGContext(data:nil,width:192,height:264,bitsPerComponent:8,bytesPerRow:192*4,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
 dest.interpolationQuality = .high
 dest.draw(cropped,in:CGRect(x:1,y:1,width:190,height:262))
 let file=output.appendingPathComponent("\(name).png")
 let writer=CGImageDestinationCreateWithURL(file as CFURL,UTType.png.identifier as CFString,1,nil)!
 CGImageDestinationAddImage(writer,dest.makeImage()!,nil)
 precondition(CGImageDestinationFinalize(writer))
 let size=(try! FileManager.default.attributesOfItem(atPath:file.path)[.size]) as! Int
 report.append(["name":name,"originalWidth":w,"originalHeight":h,"transparentPixels":transparent,"crop":[Int(bounds.minX),Int(bounds.minY),Int(bounds.width),Int(bounds.height)],"width":192,"height":264,"bytes":size])
}
let data=try! JSONSerialization.data(withJSONObject:report,options:[.prettyPrinted,.sortedKeys])
try! data.write(to:design.appendingPathComponent("export-report.json"))
print(String(data:data,encoding:.utf8)!)
