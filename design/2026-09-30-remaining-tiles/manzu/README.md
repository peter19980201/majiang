# 万子补全

2026-09-30，使用内置 image_gen 逐张生成 9 张：一、二、三、四、六、七、八、九万与赤五万。已确认的普通五万保持原文件。

参考：[AMOS 官方牌种介绍](https://shop.taiyo-chemicals.co.jp/blog/?p=1288)。传统上下结构，上方深蓝黑数码，下方朱红萬；赤五万使用红色伍与萬。牌身、凹刻笔画与漆色质感沿用已批准的 `../../2026-09-30-tile-image-samples/originals/man-5.png`。

- `originals/`：内置 image_gen 原始透明 PNG。
- `prompts.json`：逐张完整提示词及参考路径。
- `export.swift`：复用原批准批次的透明牌身裁切、缩放导出流程，只机械裁切缩放，不重画。
- `export-report.json`：尺寸、透明像素和裁切记录。
- 发布路径：`assets/tiles/engraved-v1/man-{1,2,3,4,6,7,8,9}.png` 与 `man-5-red.png`，统一 192×264，RGBA。

已逐张目视确认一二三的横画数量、四的内外结构、六七八九字形、繁体萬与赤伍颜色；导出程序验证真实透明通道。本批未改组件代码、测试或已批准五万。
