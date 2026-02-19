# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

日麻计分助手 — 微信小程序，用于日本麻将（リーチ麻雀）的符数/番数/点数计算、对局记分和役种速查。规则基准为雀魂（じゃんたま）规则。

## Commands

```bash
# 运行测试（110个用例，覆盖核心引擎全部模块）
node test/test.js

# 预览/调试需在微信开发者工具中打开项目目录
```

无构建步骤、无 npm 依赖、无 lint 配置。项目直接使用微信小程序原生框架，所有代码为纯 JavaScript (ES6+) + WXML + WXSS。

## Architecture

### 计算引擎 (`utils/`)

核心计算是一条单向管线，由 `calculator.js` 编排：

```
手牌输入 → tiles(编码) → decompose(拆解) → yaku(役判定) + fu(符计算) → score(点数/分账)
```

- **tiles.js**: 牌编码系统（0-33 映射 34 种牌），工具函数（花色判定、幺九判定、ドラ计算、简写解析如 `"123m456p"` → ID 数组）
- **decompose.js**: 递归回溯拆解手牌为 面子+雀头 组合，支持三种牌型：regular（4面子1雀头）、chitoitsu（七对子）、kokushi（国士无双）
- **yaku.js**: 役种判定，先判役满（短路），再判普通役。`getAllMentsu()` 合并手牌拆解与副露。`countAnko()` 处理荣和时刻子明暗判定
- **fu.js**: 符数计算，含雀魂特殊规则
- **score.js**: 基本点/满贯判定/分账计算
- **calculator.js**: 入口函数 `calculate(input)`，对所有合法拆解计算取最优（得点最高）
- **yaku-data.js**: 役种速查表数据（名称、说明、示例牌型），纯展示用

### 牌编码规则

```
万子: 0-8 (一万~九万)    筒子: 9-17    索子: 18-26
字牌: 27=東 28=南 29=西 30=北 31=白 32=发 33=中
```

手牌用 `number[]`（牌种 ID）表示，34 长度计数数组用于拆解算法。

### 页面 (`pages/`)

- **index**: 首页，4 个入口（快速计分、对局管理、历史、役种速查）
- **calculator**: 图形选牌器，输入手牌/副露/场况/宝牌
- **result**: 计算结果展示（役种列表、符番明细、点数分账）
- **reference**: 役种速查表（搜索/筛选/展开详情/示例牌型图形化）
- **game/setup**: 对局设置（类型/点棒/顺位马/昵称）
- **game/board**: 记分板（荣和/自摸/流局录入，庄家轮转，本场棒/立直棒）
- **game/history**: 历史对局（`wx.setStorageSync` 本地存储）

### 自定义组件

- **components/tile/tile**: 牌面图形组件，通过 `tid`（0-33）渲染对应牌面

## 雀魂规则要点

这些是与标准规则不同、影响计算逻辑的关键差异：

- 连风牌雀头 = **4 符**（非标准的 2 符）
- 切上满贯：30 符 4 番 → 满贯
- 七对子 = 固定 25 符 2 番
- 双倍役满：四暗刻单骑、国士十三面、纯正九莲宝灯、大四喜
- 副露断幺九成立
- 累计役满：13 番以上

## 微信小程序注意事项

- 自定义组件 WXML 中**禁止使用自闭合标签** `<comp />`，必须写 `<comp></comp>`，否则报 "expect START descriptor" 错误
- 无 npm，模块通过 `require()` 相对路径引用
- 数据持久化使用 `wx.setStorageSync` / `wx.getStorageSync`

## 测试约定

测试文件 `test/test.js` 使用自编断言框架（无第三方依赖）。构造测试用例时注意：

- 手牌数 = 13 - 3 × 副露组数（不含和了牌）
- 断幺九等役会被自动检测，构造测试用例时需考虑额外役种对番数的影响
- `calculate()` 的 `input.hand` 接受 `number[]`（牌种 ID），不含副露和和了牌
