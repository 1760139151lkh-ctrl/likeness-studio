# 0005 · 安装交接：把哈基秀装在这台电脑上，做成你自己的网站（手机随时能用），先用 OpenAI API Key 出图

你是 Codex，在用户自己的电脑上（多半是 Windows，也可能是 macOS / Linux），在 `likeness-studio` 仓库的 `hajixiu` 分支里工作。用户请你执行这份文件。**先从头读到尾，再动手。** 大部分事情你可以直接做；文中写了「先问用户」的地方，一定先问。说明和现实对不上时，相信现实，改代码，保持测试诚实，并在报告里写清楚。

## 做完是什么样

- 用户在手机浏览器里（Wi-Fi 或流量都行）打开一个 **https 网址**，就是哈基秀：实时变身（摄像头）、上传精修（风格 / 微调 / 细节 / 部位 / 对话）、撤回恢复、作品库，全部能用，出的是 **GPT Image 真图**（不是「模拟出片」）。
- 出图花的是用户自己的 **OpenAI API Key**（`likeness serve --engine openai`）。Key 只存在这台电脑仓库根目录的 `.env.local` 里。
- 网站**只认用户自己的设备**（owner link 模式）：每台手机 / 电脑打开一次用户的「私人链接」就进来了，一年有效；别人打开网址只看到 401，花不了这把 Key 的钱。
- 手机上可以「添加到主屏幕」，像 App 一样从桌面打开。

产品本身是什么、长什么样：根目录 `README.md`，以及 `docs/REBUILD.md`（§6 是最新一轮）。这份交接只管安装、上线和验收。

## 铁律（每一条都不能破）

1. **Key 不出这台电脑的 `.env.local`。** 不进 git、不进日志、不进 `out/`、不进 `REPORT.md`、不打印到屏幕、不发给前端。让用户自己把 Key 粘进 `.env.local`（用编辑器，不要用 `echo sk-... > .env.local` 这种会留在命令历史里的写法）。检查 Key 只用 `uv run likeness probe openai`，它只报「找到 / 没找到 / 能不能用」，从不显示 Key。
2. **上公网只用 owner link 模式**（`.env.local` 里 `LIKENESS_OWNER_LINK=1`）。**永远不要**用 `--open` 或 `LIKENESS_OPEN`；也**不要**把默认的「扫码配对」模式放到隧道或反向代理后面——隧道是从本机连进来的，配对模式会把它当成这台电脑自己，等于对所有人开门。
3. **私人链接就是钥匙**：谁拿到谁就能花这把 Key。只在对话里交给用户本人，不写进仓库、不写进 `REPORT.md`、不发到任何地方。
4. **git**：只在 `hajixiu` 分支提交和推送；不碰 `main`；不 force push。每次提交前看一眼 `git diff --cached`，确认里面没有 `sk-` 开头的字符串，没有 `.env.local`、`private/`、`relay/*/out/`、`REPORT.md`（这些本来就被 `.gitignore` 忽略，别用 `git add -f`）。
5. **花钱的事先问用户**：买域名、开云服务器、给 OpenAI 充值都先问。真实出图每张大约几美分，验收用到的十来张没问题。

## 第 0 步 · 工具和代码

需要：git、[uv](https://docs.astral.sh/uv/)（它会自己装 Python 3.12）、Node.js 20 或更新（带 npm）、第 4 步要用的 cloudflared。没有的装上（Windows 用 winget：`astral-sh.uv`、`OpenJS.NodeJS.LTS`、`Cloudflare.cloudflared`；macOS 用 Homebrew：`uv node cloudflared`）。

拿代码：

```sh
git clone --branch hajixiu https://github.com/1760139151lkh-ctrl/likeness-studio.git
cd likeness-studio
```

已经有副本就 `git fetch`、`git switch hajixiu`、`git pull`。仓库如果已经改成私有：先 `gh auth login`（用户自己登录），再 `gh repo clone 1760139151lkh-ctrl/likeness-studio -- --branch hajixiu`。

## 第 1 步 · 放 Key

在仓库根目录建 `.env.local`（已被 git 忽略），请用户自己粘进这一行：

```
OPENAI_API_KEY=sk-...
```

文件里每行一个 `名字=值`，服务启动时自动读，不会覆盖已经设好的环境变量。用户说这把 Key 大约 7 天后会删掉；到时出图会提示「生图服务的 Key 不可用」，换一把新 Key 进来、重启服务就行。

## 第 2 步 · 跑交接包（机械部分）

```sh
uv run likeness relay run 0005
```

按顺序跑：`sync`（装 Python 依赖）→ `pytest` → `npm`（npm ci）→ `build`（打包前端）→ `key`（检查 Key，免费，不出图）→ `browsers` + `browser`（浏览器测试，失败不挡路）。遇到第一个失败的关卡就停，每一步的日志在 `relay/0005-website/out/`，总表在 `out/RUN.md`。

- `key` 失败：看 `out/key.json` 里的 `problem`，上面写了原因和办法（Key 没找到 / 401 已删除或过期 / 429 额度 / 某个型号用不了）。型号用不了就在 `private/studio.toml` 里只覆盖 `[openai.pace.*].model`（格式同根目录 `studio.toml`）。
- 别的失败：修好原因（必要时改代码并补测试），再 `uv run likeness relay run 0005 --only <那一步>`。

## 第 3 步 · 先在这台电脑上出一张真图

```sh
uv run likeness serve --engine openai
```

在这台电脑的浏览器打开 `http://127.0.0.1:8787/` →「上传精修」→「用示例玩」→ 选一个人 → 底部「一键变身」。七到十秒出图，徽章写的是真图而不是「模拟出片」。再试一次「部位」（选发色 → 精修这 1 处）和「对话」（打一句「背景换成海边日落」）。都好了再往下走。想先不花钱，就用 `--engine simulator` 把流程走一遍。

## 第 4 步 · 变成你的网站（https，手机能用）

做法：服务只监听本机（127.0.0.1），由 **Cloudflare Tunnel** 把一个 https 网址接到它。手机必须用 https 才会给网页开摄像头，隧道顺便把这件事解决了。

**4a. 打开 owner link 模式。**

```sh
uv run likeness link
```

第一次会生成 `private/owner.secret`（git 忽略），并告诉你要往 `.env.local` 里加的两行：

```
LIKENESS_OWNER_LINK=1
LIKENESS_OWNER_SECRET_FILE=private/owner.secret
```

加上，然后重启服务（`uv run likeness serve --engine openai`）。启动时会打印「Owner link mode」。从这一刻起，没开过私人链接的浏览器（包括这台电脑上的）都进不来。

**4b. 今天就能用：临时隧道。** 另开一个终端：

```sh
cloudflared tunnel --url http://127.0.0.1:8787
```

它会打印一个 `https://<随机词>.trycloudflare.com` 地址。然后：

```sh
uv run likeness link --base https://<随机词>.trycloudflare.com
```

打印出来的 `https://…/open/<64 位>` 就是私人链接：**在对话里交给用户**，请用户在手机上打开一次（之后直接打开网址就能进）。临时隧道每次重启地址都会变：变了就用新地址再跑一次 `likeness link --base …`（链接后半段不变，只是前面的网址换了）。

**4c. 固定网址 = 你自己的网站。** 先问用户：有没有放在 Cloudflare 上的域名、想用哪个子域名（例如 `studio.用户的域名`）。有的话：

```sh
cloudflared tunnel login
cloudflared tunnel create hajixiu
cloudflared tunnel route dns hajixiu studio.<域名>
```

在 cloudflared 的配置目录写 `config.yml`：tunnel 是刚建的那个，ingress 把 `studio.<域名>` 指向 `http://127.0.0.1:8787`，最后一条 `service: http_status:404`。`cloudflared tunnel run hajixiu` 试通，再装成系统服务（Windows：`cloudflared service install`）开机自启。最后 `uv run likeness link --base https://studio.<域名>`，把新链接交给用户。没有域名：先用 4b，并在报告里告诉用户买一个域名放到 Cloudflare 就能有固定网址（买之前先问）。

**4d. 让它一直在。** 这台电脑开着、不睡眠，网站才在。问过用户后：把 `uv run likeness serve --engine openai`（工作目录是仓库根目录）设成登录后自动启动（Windows 用「任务计划程序」，macOS 用 launchd），插电时不睡眠。以后想要不依赖这台电脑、24 小时在线，再换到一台 Linux 云服务器（同样的 owner link 模式 + cloudflared）——这次不做。

**为什么不放到 GitHub Pages 这类纯静态网站上：** 纯静态网页藏不住 Key。仓库里的静态演示版（`npm run serve`）可以放任何地方，但只能看示例人物的样张，不能出真图。

## 第 5 步 · 在手机上验收（每一条都要有结果）

先在 iPhone 和安卓（有哪个测哪个）上，**关掉 Wi-Fi 用流量**测一遍，再连 Wi-Fi 测一遍：

1. 打开私人链接 → 进到哈基秀；关掉浏览器再直接打开网址 → 还能进。
2. 用另一个浏览器或无痕窗口直接打开网址 → 只看到「Open Likeness Studio using your access link」（401）。
3. 实时变身：允许摄像头 → 镜头里有风格和贴纸 → 按快门 → 十秒左右出真图 → 不重拍换个风格。
4. 上传精修：传一张用户自己相册的照片 → 一键变身 → 部位里改发色 → 对话里说一句 → 撤回、恢复都对。
5. 软键盘：在对话里打字，输入框贴着键盘上沿，顶栏不动、页面不被挤扁。
6. 出图到一半锁屏 / 切走，再回来能接上；刷新后作品、草稿还在。
7. 添加到主屏幕（iPhone：Safari 分享 →「添加到主屏幕」；安卓：Chrome 菜单 →「添加到主屏幕」），从桌面打开也能用。
8. 运行 `likeness serve` 的终端里没有报错。

做不到的写进报告，写清楚在哪台设备、哪个网络、看到了什么。

## 第 6 步 · 花钱、换 Key、收回访问

- 请用户在 OpenAI 后台给这把 Key 所在的项目设一个每月预算上限（用户自己操作）。
- 换 Key：改 `.env.local` 里 `OPENAI_API_KEY` 那一行，重启服务，`uv run likeness probe openai` 自查。
- 收回所有设备的访问（例如链接不小心发出去了）：`uv run likeness link --new --base <网址>`，重启服务，把新链接交给用户。
- 想给朋友用：**不要**发私人链接（等于把 Key 交出去）。这需要「邀请码 + 每天次数上限」这样的新功能，先问用户要不要做。
- 照片、作品、账号数据都在 `private/`（git 忽略）。要备份就备份这个文件夹；App 里「我的 → 备份」也能导出。

## 出问题时

| 现象 | 原因与办法 |
|---|---|
| 打开网址显示 401 | 这个浏览器还没开过私人链接：再打开一次 `likeness link --base <网址>` 给的链接 |
| 打开私人链接显示 403 | 链接不对，或者 secret 换过：重新 `likeness link --base <网址>` |
| 页面能看，但一操作就提示「Open Likeness Studio to make changes」 | 服务器没收到「这是 https」：隧道必须和服务在同一台电脑上、指向 `http://127.0.0.1:8787`（服务器只相信本机转发来的 `X-Forwarded-Proto`）；换成别的反向代理时，设 `FORWARDED_ALLOW_IPS` 为代理的地址 |
| 手机上摄像头打不开 | 用的不是 https 地址（例如直接 `http://电脑IP:8787`）：改走隧道地址；或者在手机设置里给浏览器摄像头权限。摄像头不给也能用「上传精修」 |
| 出图失败「生图服务的 Key 不可用」 | Key 被删或过期：换 Key，`uv run likeness probe openai` 自查 |
| 「排队的人有点多」 | 同时出图太多：等一下，或调 `private/studio.toml` 的 `[studio].workers` |
| trycloudflare 地址打不开了 | 临时隧道重启后换了地址：看 cloudflared 新打印的地址，或改用 4c 的固定网址 |

## 做完之后

- 在 `relay/0005-website/REPORT.md`（git 忽略，留在这台电脑上）写给用户：跑了什么、网站地址（**不写私人链接**）、第 5 步每一条在每台设备上的结果、改了哪些文件和为什么、需要用户决定的事。
- 有代码改动就补测试、提交、推送到 `hajixiu`；推送前确认 `git diff --cached` 里没有任何密钥和私人文件。
- 最后用三五句话告诉用户：网址是什么、私人链接已经在对话里给了、电脑要开着、Key 到期了怎么换。
