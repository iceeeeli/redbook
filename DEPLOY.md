# 部署到 GitHub Pages（iceeeeli 账号）

架构：**编辑器（静态）上 GitHub Pages** + **AI 请求走 Cloudflare Worker 代理**（藏 DeepSeek key、解决跨域）。

```
浏览器 (iceeeeli.github.io/<repo>/)
   │  导出 Word —— 纯前端，无需后端
   │  AI 生成 —— fetch → Cloudflare Worker → DeepSeek
   ▼
Cloudflare Worker (key 存这里，不进前端)
```

---

## 一、部署 Cloudflare Worker（一次性，约 5 分钟）

需要一个 Cloudflare 账号（免费）。

```bash
cd cloudflare-worker
npm install -g wrangler          # 没装过 wrangler 的话
wrangler login                   # 浏览器授权

# 把 DeepSeek key 存成 Secret（不会写进代码/仓库）
wrangler secret put DEEPSEEK_API_KEY
# 提示输入时，粘贴你的 DeepSeek API key（切勿把 key 写进任何提交的文件！）

wrangler deploy
```

部署完会输出一个网址，形如：
`https://redbook-deepseek-proxy.<你的子域>.workers.dev`
—— **记下它**，下一步要用。

> 部署好 Pages 后，建议把 `wrangler.toml` 里的 `ALLOW_ORIGIN` 从 `"*"` 改成
> `"https://iceeeeli.github.io"` 再 `wrangler deploy` 一次，收紧跨域。

---

## 二、推代码到 GitHub（iceeeeli 账号下建仓库）

> ⚠️ 你本机 `gh` CLI 登录的是 **CL-iceli**（公司号），而 Pages 域名是
> **iceeeeli**。所以仓库要建在 iceeeeli 名下，用 SSH 推送即可（走你的 ssh key，
> 不受 gh CLI 当前账号影响）。仓库名假设叫 `redbook`（可自定）。

```bash
cd D:/ice/redbook
git init
git add .
git commit -m "小红书文案编辑器：TipTap 编辑 + 导出 Word + DeepSeek AI 生成"
git branch -M main
git remote add origin git@github.com:iceeeeli/redbook.git   # 先在网页端建好这个空仓库
git push -u origin main
```

> `.env`（含真实 key）已被 `.gitignore` 忽略，**不会**被提交，放心。

---

## 三、配置仓库变量 + 开启 Pages

在 GitHub 仓库页面：

1. **Settings → Secrets and variables → Actions → Variables → New repository variable**
   - Name: `VITE_API_BASE`
   - Value: 第一步拿到的 Worker 网址（如 `https://redbook-deepseek-proxy.xxx.workers.dev`）

2. **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**

配好后，`.github/workflows/deploy.yml` 会在每次 push 到 main 时自动：
构建（自动把 `base` 设成 `/<仓库名>/`、注入 Worker 地址）→ 部署到 Pages。

几分钟后访问：`https://iceeeeli.github.io/redbook/`

---

## 常见问题

- **AI 按钮报跨域/网络错**：检查 `VITE_API_BASE` 变量是否填对、Worker 是否部署成功（直接用 curl POST 那个 Worker 网址测）。
- **页面白屏、资源 404**：多半是 `base` 不对。用 GitHub Actions 部署会自动处理；若手动 build，记得 `VITE_BASE=/<仓库名>/`。
- **只想先上线编辑器、暂不接 AI**：不设 `VITE_API_BASE` 也能部署，AI 按钮会报错但导出 Word 正常。

---

## 本地开发（不受部署影响）

```bash
npm run dev        # 前端直连线上 Worker（AI 生成 + 草稿），无需本地后端
```

> AI 与草稿都由 Cloudflare Worker 提供：`POST /generate`（DeepSeek，带 IP 限流）、`GET/POST/DELETE /drafts`（D1 数据库存草稿）。key 存在 Worker Secret，本地不需要。改 Worker 逻辑后 `cd cloudflare-worker && wrangler deploy`。
