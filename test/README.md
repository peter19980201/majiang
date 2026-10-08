# 日麻计分助手独立测试模块

本模块统一维护项目现有测试，独立于小程序运行代码，无 Node 第三方依赖；项目已有打包配置排除整个 `test` 目录。当前收录19个原有回归套件、原半庄数据生成器中的完整对局校验，以及1个执行器契约套件，加上流局满贯套件，再加字号与主导航套件，共24个默认套件。另有可选Python独立计分核验。

## 运行

在仓库根目录执行：

```sh
node test/run.js
node test/run.js --list
node test/run.js --suite=quick-score
node test/run.js --group=engine
node test/watch.js
```

也可在本目录运行 `npm test`、`npm run watch`，不需要 `npm install`。支持Node 18以上，本次用Node 24验证。可从任意工作目录用绝对路径启动runner。

`watch`启动后先跑全量；业务源码、WXML/WXSS、资源、配置或测试变化后自动再跑。正在运行时的变更会排队，不同时启动两个回归。生成报告不触发自身循环，Ctrl+C停止。监听只在进程运行期间有效，不安装后台服务。

## 模块结构

| 位置 | 职责 |
| --- | --- |
| run.js | 统一命令入口，异常或失败返回非零 |
| manifest.json | 套件ID、分组、功能编号、超时；未登记的suite阻止执行 |
| suites/ | 所有可执行Node测试；保留原断言 |
| harness/runner.js | 隔离进程、超时、源码指纹、日志及报告 |
| watch.js | 源码变更监听与串行自动回归 |
| fixtures/ | 旧数据和6000例固定独立预期、manifest哈希 |
| winning-hands.cases.js | 100例人工固定预期，保留原文件字节与oracle哈希 |
| winning-hands-oracle.py | Python独立核验，不调用项目引擎生成答案 |
| generate-winning-hands.py | 显式重生成独立扩展集工具，不由回归自动执行 |
| local-data/ | 既有8场81局数据及生成器、历史导入凭据 |
| reports/ | 每次运行HTML、JSON、各套件完整日志及latest.json；不提交Git |
| 顶层旧同名JS | 兼容原命令；真实实现已迁至suites |

默认测试清单：

| 分组 | 套件 | 范围 |
| --- | --- | --- |
| engine | test、winning-hands、winning-hands-expanded | 基础110项、100固定牌、6000扩展牌 |
| game | game-round、free-play、manual-tsumo、stage-three、round-corrections、local-data、nagashi | 领域、规则、支付、修改撤销及8场81局连续性 |
| storage | game-migrations | schemaVersion、迁移备份、损坏/未来数据与存储失败 |
| ui | embedded-entry、form-contract、red-five-entry、round-detail、ui-state、yakuman-display | 表单宿主契约、赤五、详情、显示及状态 |
| report | battle-report、share | 战报转换、Canvas Mock、分享参数 |
| scoring | quick-score | 番符、速查与对局接入 |
| regression | review-regressions | 历史缺陷回归 |
| infrastructure | runner-contract | 注册检查、路径越界、失败码、超时、缺运行时 |

`stage-three`为历史命名，内容是规则与对局回归，不代表玩家档案功能。清单中的features是相关功能映射，不表示对应功能的所有计划用例已实现。完整待补用例见[测试计划](../design/2026-10-04-test-plan/README.md)。现有测试主要为纯函数与wx Mock，尚不包含真实开发者工具E2E或手机权限验收。

## 独立计分核验

```sh
python3 -m venv test/.venv
# macOS/Linux；Windows使用test/.venv/Scripts/python.exe
test/.venv/bin/python -m pip install -r test/requirements-oracle.txt
node test/run.js --oracle --python=test/.venv/bin/python
```

也可用 `MAJIANG_TEST_PYTHON` 指定已安装 `mahjong==1.4.0` 的解释器，默认python3。`--oracle`在全部已选Node套件后执行独立核验；缺环境或库版本不对会报失败，普通运行明确记录oracle未执行，不伪装通过。独立核验在本地使用这个锁定版本运行。

现有独立报告、牌例说明保留在顶层，可继续用旧命令单例复现或显式刷新：

```sh
node test/winning-hands.js H001
node test/winning-hands-expanded.js G00001
node test/winning-hands.js --report
node test/winning-hands-expanded.js --report
```

默认回归不写固定样本、不刷新历史报告。半庄校验通过 `--check` 只生成内存数据并校验，既不覆盖JSON也不导入开发者工具。若确需重生成，显式运行 `node test/local-data/generate-hanchan.js`；6000例重生成用Python工具，评审预期变化及来源后才能替换基准。

## 每次代码更新的工作流

1. 根据manifest找到相关套件。新增功能补正反例和边界，修复缺陷先保留可复现例；纯重构维护有效断言，不必制造重复测试。
2. 在 `suites/` 修改或新增测试，更新manifest和相关计划。各套件独立进程运行，Mock不能共享进程污染。
3. 开发时可先跑相关套件或保持watch运行；交付前运行 `node test/run.js` 全量。涉及独立计分预期时加 `--oracle`。
4. 查看报告，不能把失败、环境缺失、源码中途变化当成功。修复后重跑，不用被测实现生成期望。
5. 将代码与测试更新一同保存，保留本地测试报告。按用户要求，仅使用本地测试，不配置云端CI。

此约定同时写入根 `AGENTS.md` 和 `CLAUDE.md`，供后续开发任务遵循。本地监听负责自动运行；它不会自动判断新功能该有的正确预期，用例维护仍随代码变更进行。

## 报告解释

终端显示每套件结果和报告绝对路径；`reports/latest.json`指向最后一次运行。每次报告有唯一runId、Node与平台、源码SHA-256、测试期间源码是否变化、已选范围、oracle状态、耗时、失败码和每套件完整输出。单套件运行的1/1不代表全量通过。

默认超时每套件60秒，执行器自身10秒、oracle120秒；失败继续收集其他套件结果，整体返回非零。源码运行期间变化也返回非零，要求稳定后重跑。报告生成失败同样返回非零，不悄悄忽略。

迁移只调整测试路径及组织，原有CLI兼容入口保持可运行。业务源码未因本次模块整理而修改。首次计划中的148条规格仍是后续扩展目标，不能将“已有测试全部迁入”写成“148条全部实现”。

## 本次模块验收

2026-10-04：21个默认套件及Python独立核验共22/22通过（Node v24.13.0，现有隔离环境mahjong 1.4.0）。旧基础测试命令与G00001单例命令通过；未知套件/参数返回失败；从仓库外使用绝对路径可运行。watch已验证首次全量及文件变更后自动再跑全量。执行器另验证非零退出、缺解释器、超时和注册完整性。云端CI配置已按用户要求移除；开发者工具和真机自动化仍属于计划范围。

## 流局满贯

新增 `nagashi` 套件（F24）：独立固定支付预期、全部庄位与达成组合、供托守恒、听牌连庄、空选择拒绝、修改快照及战报识别。执行 `node test/run.js --suite=nagashi`。抽屉选择、滚动及真机点数预览仍需设备验收。

## 统一字号

新增 `typography` 套件（ui，F25），默认套件共23个。执行 `node test/run.js --suite=typography` 检查全页字号变量、组件回退值和关键标题/按钮/分数层级，防止新增零散字号或行内绕过规范。统一定义位于 `styles/typography.wxss`：22/24/28/32/36/40/48/64/96rpx。麻将牌面、键盘图形和局数相对比例是明确例外；导出战报 Canvas 使用独立画布像素，沿用其排版。静态测试不代表渲染验收，窄屏、长昵称、负分、内嵌抽屉及真机字体仍待检查。

## 底部导航与规则分栏（2026-10-08）

新增 `main-navigation`（F26）：四个主页面切换与高亮、新建独立页面及已有对局确认/取消、防重复打开、历史继续对局的返回路径、首页固定对局区域与双列算分、规则筛选状态保留、点数表庄闲/荣和/自摸固定支付预期。`typography` 和源码指纹/自动监听均纳入 `custom-tab-bar/`。全量执行 `node test/run.js`，共24套；执行器成功、失败、超时与缺运行时由 `runner-contract` 验证。开发者工具检查记录见测试计划F26；真机安全区及窄屏仍待验收。

底栏图标（F26）：按用户参考图改为本地SVG资源，首页/战绩/规则/我的各含灰色与绿色两态，中央新建使用较大的圆形加号；`main-navigation`检查资源完整性、状态绑定和独立矢量文件。视觉比例与真机渲染由人工验收。

F26底栏轮廓调整：普通图标48rpx，新建72rpx并上移18rpx；中央180rpx宽的平滑拱形与底栏同色、边线连续，标签仍对齐。主导航回归覆盖拱形资源引用、装饰不拦截点击、突出部分不裁切；实际形状及点击区需开发者工具/真机检查。

## 绿色台呢材质（F27）

`felt-surfaces`验证台呢与既有牌桌素材一致、WXSS无需网络加载、页面与组件样式导入及禁用状态取消纹理。默认共25套。按钮、选中项、分数卡片及深绿徽标共享 `styles/felt.wxss`；文字、图标、浅色卡片及现有插画保持原样。开发者工具检查实际纹理，真机清晰度仍待验收。

首页提前结束（F01/F15/F16/F26）：对局卡片并排显示继续对局、提前结束；二次确认后按当前点数结算并保存战绩，首页转为空状态。`home-end-game`覆盖确认前不写入、取消、重复点击、对局变更、存储失败及成功保存，默认共26套。实际按钮排版与确认框另以开发者工具验收，真机待检查。

首页算分入口视觉调整（F01/F26）：双列卡片增加字牌边框、右上箭头与既有竹叶山纹插画，标题和说明按参考图纵向排列。入口行为不变，沿用 `main-navigation` 的双列及路由覆盖；本次不新增重复行为用例。实际排版以开发者工具检查，真机待验收。

战绩左滑删除（F15/F16/F26）：移除清空入口，统一卡片间隔为20rpx；已结束记录左滑显示右侧删除按钮，保留删除确认。`history-swipe`覆盖方向锁定、展开阈值、单条展开、右滑收起、手势中断、防误触详情及确认/取消删除，默认共27套。开发者工具/真机滑动与滚动手感另行验收。

左滑性能修正：手势与回弹移至WXS视图层，逐帧不调用setData；仅正常点击进入逻辑层。沿用history-swipe套件，增加快速甩动、动画中重新拖动、过期动画取消及零逐帧桥接断言。真机帧率仍需设备验收。

战绩滑动视觉收尾：裁切边界由卡片行移至屏幕边缘，左滑卡片可越过页面左侧留白；竹叶装饰加柔边蒙版，消除矩形底色。交互不变，沿用history-swipe全部行为覆盖，不新增重复行为测试；视觉另以开发者工具检查。
