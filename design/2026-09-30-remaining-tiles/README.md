# 完整雕刻麻将牌面

用户确认六至九筒连纹版后，授权三个 subagent 分批补齐剩余25张。全部使用内置 image_gen 逐张生成，以已确认五万、三索、东风、五筒为牌身与雕刻风格参考；图案与配色继续核对 [AMOS 官方参考](https://shop.taiyo-chemicals.co.jp/blog/?p=1288)。

## 三个批次与提示词

- [万子批次](manzu/README.md)：一二三四六七八九万与赤五万；[完整提示词](manzu/prompts.json)。保留原普通伍萬字形。
- [索子批次](souzu/README.md)：一二四五六七八九索与赤五索；[完整提示词](souzu/prompts.json)。九索首版误生成六根已弃用，最终九根为三列三行，中心列红。
- [字牌和赤五筒](honors/README.md)：南西北白發中、赤五筒；[完整提示词](honors/prompts.json)。白板为空白，發绿、中红。

各批次保留高清 originals、export.swift 和 export-report.json。已有12张图案保持，全部37张运行素材统一进行调色板压缩。

## 交付

- 小程序素材：`../../assets/tiles/engraved-v1/`，34种普通牌与3种赤五，统一192×264透明PNG。
- `preview.png`：完整37张牌面预览；`preview.py`只拼版已生成PNG，不绘制牌面。
- `uncompressed-exports/`：压缩前37张标准尺寸素材。
- `optimize.py`：pngquant quality 85–100调色板压缩，保留透明背景。此为有损调色板优化，高清原图与未压缩导出均保留。
- `compression-report.json`：体积由3314339 bytes降为1044356 bytes，减少约68.5%。此前各批次export-report记录的是压缩前字节数。
- `screens/`：微信开发者工具各花色实际显示截图与验证报告。

组件已接入全部牌面，赤五在相同牌ID下根据状态切换到独立红色图片，并保留选中边框。

## 验证

逐张核对数字、字形、索子数量和排列，并检查整套最终压缩图与小程序显示。

- `node test/test.js`：110/110通过。
- `node test/ui-state.js`：通过，覆盖全部图片存在、三种赤五切换、空组件清理及原有界面状态检查。
- 微信开发者工具：四种花色全部显示，三种赤五切换、和了高亮、白板最多四张限制通过；运行异常0。测试只修改页面临时状态，未修改用户对局存储。
- 尚未进行手机真机验证。
