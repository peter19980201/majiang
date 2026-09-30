# 字牌与赤五筒补全

2026-09-30，使用内置 `image_gen.imagegen` 逐张生成 7 张，未使用 CLI 或程序绘图替代。

## 参考与样式

- 规则与图案参考：[AMOS 官方牌种说明](https://shop.taiyo-chemicals.co.jp/blog/?p=1288)。通过网页字牌区截图核对白牌为空白、南西北字形、红中；發沿用传统绿色方案（网页示意图的發近黑，不作为实物颜色依据）。
- 材质与字形风格以已确认的 `design/2026-09-30-tile-image-samples/originals/honor-east.png` 为基准；赤五筒以该目录 `pin-5.png` 为基准。
- 南、西、北为蓝黑雕刻漆字；白牌无框无字；發为繁体绿色雕刻；中为红色雕刻；赤五筒五个圆纹全部红色，保留普通五筒布局。

## 文件

- `originals/`：7 张未经二次绘制的生成原图。
- `prompts.json`：全部实际提示词、参考图、生成源路径。
- `export.swift`：沿用已确认首批的透明裁边与缩放规范，导出 192×264 RGBA，牌体 190×262，四周 1 像素边距。
- `export-report.json`：原图尺寸、真实透明像素、裁切框、导出体积。
- 小程序素材：`assets/tiles/engraved-v1/honor-{south,west,north,white,green,red}.png` 和 `pin-5-red.png`。

## 验证

逐张目视确认南西北、繁体發与中字符无错字，空白牌无残留字符，赤五筒恰为五枚红色花纹；导出脚本验证原图有真实透明像素。已确认的東牌未修改。组件映射与整批小程序检查由主任务统一完成。
