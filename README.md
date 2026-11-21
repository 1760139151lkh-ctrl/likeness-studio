# 哈基秀 · 一张自拍，秒变艺术头像

面向新加坡、马来西亚及亚太区 TikTok 年轻创作者的艺术头像 App。两个平级核心入口：

- **实时变身**：打开就是 9:16 取景器，对着镜头立刻看到风格加持（本机 WebGL 风格化 + 人脸追踪 AR 贴纸），按下快门约 10 秒直出高精艺术头像；不用重拍就能一键换风格。
- **上传精修**：一次上传，无限换装与精雕。照片下面五个工具：
  - **风格**：33 个世界，或一句话自创一个；
  - **微调**：风格强度 / 保留像貌 / 细节丰富度 / 美颜微调，画质与画幅；
  - **细节**：配饰 / 光效 / 背景氛围 / 画框装饰，再补一句；
  - **部位**：点脸上哪里改哪里，或用手指圈一块；发色、唇色当场预览，出图时只改那几处，其余像素一个不动；
  - **对话**：一句话改一版，工作室回你一句，再给三个「接着改」；多来几张、多角度、换背景、去杂物一键直达。

  每一步都能撤回 / 恢复（刷新后也在），每个版本都留着，按住看原图、比上一版。

33 个风格、7 个分类（热门 · 搞怪 · 角色变身 · 梦幻主题 · 二次元 · 氛围出片 · 艺术画风），其中二次元 8 个世界（动漫主角 · 3D动画脸 · 魔法少女 · 热血少年 · 治愈手绘 · 虚拟主播 · 少女漫画 · 复古番剧）。**一风格一世界**：选中哪个风格，整个 App 就换上它的配色、画框、字体气质、装饰语言和实时 AR 信物；停在一个新世界上会有动画转场眼一样的标题卡，出片那一刻是一道光扫过的「蜕变」揭晓。

旧版诊断、重构方案、资产清单、每一轮的验收记录见 [`docs/REBUILD.md`](docs/REBUILD.md)（这一轮的工作台重构与旧功能去向在 §6）。

## 快速开始

```sh
npm ci                     # 前端测试与打包工具
uv sync                    # Python 3.12 + 依赖（https://docs.astral.sh/uv/）

# 1) 真实出片：把 OpenAI Key 放进 .env.local（已在 .gitignore 里，永远不会被提交）
echo 'OPENAI_API_KEY=sk-...' > .env.local
uv run likeness serve      # 检测到 Key 自动用 GPT Image；打开 http://127.0.0.1:8787/

# 2) 不花钱跑通全流程：模拟引擎（成片会盖「模拟出片」章）
uv run likeness serve --engine simulator

# 3) 纯静态演示版（没有服务器）：示例人物出预先生成的样张，自己的照片出本机滤镜预览
npm run serve              # http://127.0.0.1:4173/
```

手机访问：`uv run likeness serve --host 0.0.0.0` 会打印同一 Wi-Fi 下的配对二维码。手机浏览器只在 HTTPS 下开放摄像头，用 `--cert/--key` 提供证书（例如 mkcert）。上线前 `npm run build` 生成打包后的脚本，服务器会自动使用。

## 画质与速度（GPT Image，实测）

| 画质 | 模型 | 典型耗时 |
|---|---|---|
| 极速 | `gpt-image-2.6-flare` low | 7–8 秒 |
| 高清（默认） | `gpt-image-2.6-flare` medium | 约 10 秒 |
| 超清 | `gpt-image-2.6-sunburst` high | 约 30 秒 |

在 `studio.toml` 的 `[openai.pace.*]` 调整；`private/studio.toml` 可以只覆盖本机的设置。部位精修和对话微调同档用时相近（极速档实测：一键变身 6.9 秒、部位精修 7.9 秒、对话改背景 5.6 秒）。每一步的那句回复由文字模型（`text_model`，默认 `gpt-5.4-mini`）和图同时写，不额外加等待。

## 代码结构

```
web/
  index.html  sw.js  manifest.webmanifest
  css/app.css                 全部样式：可插值主题变量、组件、页面、每个风格的画框/字体/装饰
  js/presets.js               33 个风格的唯一数据源：主题、实时滤镜参数、贴纸、Prompt、细节选项、默认值
  js/parts.js                 部位精修的部位与选项（刘海、发型、发色、眉毛、眼妆、唇妆…）
  js/copy.js                  全部界面文案（zh-SG）
  js/core/                    导航(nav) · 本地存储(db) · 私有空间与同步(data) · 服务器(api) · 生成流程(generate) · 撤回(undo) · 软键盘(keyboard) · 认脸与遮罩(face) · 主题(theme) · 图片(image)
  js/studio/                  上传精修的面板：风格 / 微调 / 细节(panels) · 部位(parts) · 对话(chat) · 即时染色(tint) · 圈选画笔(brush)
  js/live/                    摄像头 · WebGL 实时风格化(renderer) · 人脸追踪(tracker) · AR 贴纸与画框(overlay)
  js/screens/                 实时变身 · 结果页 · 上传精修 · 作品库 · 作品详情 · 我的 · 首次引导
  js/ui/                      共用零件 · 抽屉 · 样张抽屉（拍同款）· 分享卡(card) · 沉浸动效（世界转场 / 蜕变揭晓 / 主题粒子 / 震动）
  img/                        生成的全站资产（样张、示例人物、氛围背景、贴纸）+ manifest.json + provenance.json
  vendor/mediapipe/           MediaPipe 人脸关键点（本机运行，画面不出设备）
likeness/                     FastAPI 服务器：账号与私有空间(accounts) · 生成任务(jobs) · 引擎(engines/openai_images|simulator|codex)
tools/make_assets.py          用 GPT Image 批量生成全站资产（Prompt 与 App 发出的完全一致）
tools/process_assets.py       裁切压缩成网页尺寸，写清单与来源
tests/                        pytest（服务器、账号隔离、同步、引擎）+ tests/browser（Playwright 端到端）
```

## 接口一览

```
GET  /studio.json                    引擎、预计耗时、当前账号（首页已内联，零额外请求）
POST /api/assets                     传图到当前账号的私有空间
POST /api/assets (kind=mask)         部位遮罩（RGBA 的透明度 = 要改的地方）
POST /api/turns                      发起生成 {id, text, say, pace, n, aspect, preset, taste, handles, intent{op, subject, refs}, pins[{n, note, mask}], room} → {job, eta}；同 id 重发 = 同一任务
                                     op：restyle · edit · region（只改遮罩里的，合成回原图）· vary（多来几张）· angles（多角度）…
POST /api/styles                     一句话自创风格 {text} → 完整的风格（主题色、8 个细节、Prompt）
GET  /api/jobs/{id}/events           SSE：stage · plan · partial · result · reply · done | failed（GET /api/jobs/{id} 轮询）
POST /api/jobs/{id}/cancel
GET  /api/me · POST /api/auth/signup | login | logout | profile
GET  /api/sync?cursor=N · POST /api/sync      作品/原图/收藏/草稿/偏好，按服务器游标增量同步
```

## 测试与验收

```sh
uv run pytest              # 62 项：生成协议、部位遮罩与合成、回复与灵感、OpenAI 引擎（本地假 API）、账号隔离、注册原地升级、登录归属、同步游标、限流
npm run check              # 前端类型检查
npm test                   # Playwright 18 项：静态演示版 + 模拟引擎服务器，使用 tests/fixtures/camera/selfie.mjpeg 作为假摄像头
npm run accept             # 验收：Chromium + iPhone 13（WebKit）。零跳动、两种键盘行为、安全区、33 个风格卡与全部细节、
                           #       每个抽屉的四种关法、10 个页面「每个按钮都点一遍」都要有反馈且零报错
```

## 隐私

- 实时镜头画面与人脸追踪全部在手机本地完成，不上传。
- 只有按下快门 / 点「一键变身」的那张照片会传到**你自己的私有空间**用于生成；每个账号（包括访客）的上传、成片和记录互相隔离。
- 账号库、私有空间、生成原图都在 git 忽略的 `private/` 里。OpenAI Key 只从环境变量或 `.env.local` 读取，不写日志、不进任务、不返回前端。
- 示例人物全部由生成模型创作，不是真人。

## 关于角色风格

「特摄英雄」「Q版机器人」「憨憨小龙」这类角色风格都是原创设计：抓住一类作品的气质（特摄战甲、复古卡通机器人、圆滚滚的萌系小龙），但造型是自己的，Prompt 不点名任何作品或角色，样张的来源记录（`web/img/provenance.json`）里也没有。
