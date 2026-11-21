# 给编程代理（Codex 等）的说明

哈基秀：自拍 → 艺术头像的手机网页 App（`web/`，原生 ES modules + JSDoc），加一个 FastAPI 工作室服务器（`likeness/`，Python 3.12，用 uv 管理）。产品说明见 `README.md`，设计与每一轮的验收见 `docs/REBUILD.md`。

**要安装、做成网站、在手机上用：照 `relay/0005-website/PROMPT.md` 做。** `relay/START.md`、`relay/0003-codex-studio/` 和 `HOST-INTEGRATION.md` 写的是旧架构（Codex CLI 出图、`studio` 分支），只作历史参考。

## 常用命令

```sh
uv sync --locked && npm ci          # 装依赖
npm run build                       # 改了 web/js 之后要重新打包（服务器自动用 workstation/bundle/）
npm run check                       # 前端类型检查（tsc，JSDoc）
uv run pytest                       # 服务器测试，不联网
npm test                            # Playwright：静态演示版 + 模拟引擎（先 npx playwright install chromium）
npm run accept                      # 完整验收（慢，Chromium + WebKit）
uv run likeness serve --engine openai      # 真图（Key 在 .env.local）；--engine simulator 不花钱
uv run likeness probe openai               # 检查 Key 和型号，免费，不显示 Key
uv run likeness link --base https://<网址>  # owner link 模式的私人链接
```

## 规矩

- **密钥**：`OPENAI_API_KEY` 只放 `.env.local`（git 忽略）。永远不提交、不打印、不写进日志或报告。照片、作品、账号数据、`owner.secret` 都在 `private/`（git 忽略）。
- **上公网**只用 owner link 模式（`LIKENESS_OWNER_LINK=1`），不要用 `--open`，不要把默认的扫码配对模式放到隧道或反向代理后面。
- **git**：在 `hajixiu` 分支工作，不碰 `main`，不 force push。
- **界面文案**是 zh-SG（`web/js/copy.js` 等），语气轻松，按钮 2–4 个字；改界面要在 360×640 到 430×932 的手机尺寸上不换行、不截断、切换不跳动（`npm run accept` 会查）。
- 改了前端：`npm run check`、`npm run build`、`npm test`；改了服务器：`uv run pytest`。
