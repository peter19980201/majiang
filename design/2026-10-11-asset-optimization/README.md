# 素材瘦身（2026-10-11）

删除20张被完整牌面替代的旧SVG，清理faceSrc生成、模板分支及样式；保留37张完整牌面PNG、分享封面和现有台呢原文件。

4张背景JPEG采用Pillow quality=85、optimize=True、subsampling=2，保持原分辨率；profile-motto.png只优化PNG编码，解码后RGBA逐字节一致。背景对比完整缩略图和原尺寸局部，未见明显差异。原始文件可从Git前一版本恢复，统计详见compression-report.json。

资源文件共减少396383字节（387.1 KiB），不是微信编译后包体实测值。分享封面SHA256：a0d987ed483122366e12e4fca24b4714e952fad1d26fed13329bf38a94892882。

测试：ui-state维护资源映射，其余既有分享、导航、台呢和战报套件覆盖引用与行为；交付前执行node test/run.js全量。未修改计分和存储。
