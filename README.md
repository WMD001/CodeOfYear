# GitHub Yearly Report

基于 GitHub 公开数据的个人年度开发活动统计与可视化平台。输入 GitHub 用户名并选择年份，自动获取公开数据，生成可交互、可导出的年度开发者贡献报告。

## 功能

- 首页查询：用户名 + 年份（默认当前年），支持 URL 直接访问 `/report/:username?year=YYYY`
- 用户资料区：头像、简介、仓库/关注者数、账号创建时间
- 8 张核心指标卡：总提交、年度新建仓库、Star、Fork、贡献天数、PR、Issue、代码评审（均带数据状态与口径说明）
- 全年贡献热力图：GitHub 风格贡献日历，悬停查看每日贡献，颜色按贡献数动态分档
- 年度热门仓库 Top 5：按年度提交数排序（不可完整获取时降级为 Star 排序并注明）
- 编程语言分布：环形图，当前公开仓库代码语言字节占比
- 月度提交趋势：未来月份显示"未统计"，不填充虚构零值
- 年度活跃度面板：最长连续贡献、首次/最后贡献、活跃仓库、PR 合并、Issue 关闭率
- PNG 高清导出、分享链接复制
- 所有指标带数据状态（完整 / 部分 / 暂无数据 / 不支持统计 / 获取失败），禁止演示数字与随机数据

## 技术栈

React 19 · TypeScript · Vite · Tailwind CSS · Apache ECharts · react-router-dom · date-fns · html-to-image · Vitest

## 数据来源与口径

- GitHub REST API：用户资料、仓库、语言、提交、Gists、Search（年度 PR/Issue/Review/评论）
- GitHub GraphQL API：贡献日历（需 Token，见下）
- 当前年份统计截止于当日，不展示未来贡献
- Star/Fork 年度增量无法可靠还原时，降级展示当前总数并改标指标名
- 语言占比 = 该语言字节数 ÷ 全部语言字节数；同一代码存在于多个仓库时可能重复计算

### 关于 GitHub 登录与数据范围

完整贡献日历来自 GitHub GraphQL API，而 GraphQL **必须携带 Token** 才能调用。

| 场景 | 凭据 | 数据范围 |
|---|---|---|
| 未登录 | 无；配置 `GITHUB_PAT_TOKEN` 后走服务端代理 | 公开数据；配置代理 PAT 后可用完整公开贡献日历 |
| 登录后查本人 | OAuth App（`repo` scope） | 本人公开 + 私有仓库 / 私有贡献 |
| 登录后查他人 | OAuth App（仍用 token 提高额度） | **强制公开数据**，Search 加 `is:public` |

- OAuth App 在 `api/auth/github.js` 中申请 `repo` scope；classic OAuth App 的 `repo` 是私有仓库读写权限，仅用于读取本人数据。
- 私有仓库名称会出现在本人报告中；分享链接不会携带 token，他人打开时仍按自己的登录状态与公开口径查询。
- 报告包含私有仓库时，页面会显示隐私提示；导出的 PNG 会包含私有仓库名称。
- 本地开发如果没有 OAuth 服务，可使用首页右上角的「开发 Token」弹窗（仅 `import.meta.env.DEV` 显示，生产构建不包含）。

### 未登录公开数据代理

未登录访客不能直接持有 PAT，因此生产环境的前端请求会走 `/api/github` 代理，由 Vercel Function 在服务端附加 `GITHUB_PAT_TOKEN`。

- 代理只允许 `/users/*`、`/repos/*`、`/search/*`、`/graphql`，不转发 `/user`、`/gists`、`/notifications` 等认证用户专属路径。
- `GITHUB_PAT_TOKEN` 必须是**空 scope 的 classic PAT**，或**仅公开仓库只读的 fine-grained PAT**。
- **不要**使用带 `repo` scope 的 Token：否则匿名访客可能通过 `/repos/*` 读到该 Token 所有者可访问的私有仓库数据。
- 未配置 `GITHUB_PAT_TOKEN` 时，代理自动回退为匿名请求，额度恢复 60 次/小时。
- 本地 `npm run dev` 不包含 `/api` Functions，未登录仍直连匿名接口；本地验证完整数据用「开发 Token」。

> 匿名模式下 GitHub API 限流约 60 次/小时（Search API 10 次/分钟）；
> 配置 `GITHUB_PAT_TOKEN` 或登录后 REST 5000 次/小时、Search 30 次/分钟。语言/提交统计按需限量查询并缓存，超出部分标记为"部分统计"。

## 本地开发

```bash
npm install
npm run dev        # 启动开发服务器（不含 OAuth Functions）
npm run test       # 运行测试（LIVE_API=1 时额外执行真实 API 集成测试）
npm run build      # 生产构建（输出 dist/）
npm run preview    # 预览构建产物
```

需要本地验证 OAuth 登录时使用 `npx vercel dev --listen 3001`，并配置 `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET`。使用 3001 是因为本机 3000 被 IDE 占用；OAuth App 回调需临时改为 `http://localhost:3001/api/auth/github/callback`。

## 部署（Vercel）

1. 推送源码到 GitHub 仓库
2. Vercel → Import Project → 选择仓库
3. 构建配置：
   - Build Command：`npm run build`
   - Output Directory：`dist`
4. 配置 GitHub OAuth App：
   - Authorization callback URL：`https://<你的域名>/api/auth/github/callback`
   - 环境变量（Vercel Project Settings）：
     - `GITHUB_OAUTH_CLIENT_ID`
     - `GITHUB_OAUTH_CLIENT_SECRET`
     - `GITHUB_PAT_TOKEN`（可选，未登录公开数据代理；必须公开只读）
5. SPA 路由回退由项目根目录的 `vercel.json` 处理：`/report/*` 会回退到 `index.html`

## 项目结构

```
src/
├── api/               # GitHub REST / GraphQL 封装（请求、重试、分页、错误归一化）
├── components/        # ReportHeader / MetricCards / ContributionHeatmap / WrappedSummary /
│                      # LoadingScreen / OtherStatsPanel / RepositoryRanking / LanguageChart /
│                      # CommitTrend / DevActivityPanel / DevTokenDialog / DataStatus
├── pages/             # HomePage / ReportPage
├── hooks/             # useReport（加载状态机）
├── services/          # report-service（编排与降级）/ statistics-service（统计口径）
├── types/             # github.ts / report.ts / data-status.ts
├── utils/             # date / format / cache / export-image / echarts
└── index.css          # 设计令牌（深色主题）
tests/                 # 单元测试 / API 测试 / 页面测试
```

## 测试

- 单元测试：日期范围、每日/月度汇总、连续贡献、语言汇总、仓库排行、指标状态
- API 测试：有效/不存在用户、限流、网络失败、分页、Token 头、本人私有 / 他人公开范围
- 页面测试：查询交互、加载/错误/成功状态、分享与导出入口
- 真实 API 集成（可选）：`LIVE_API=1 npx vitest run tests/api/live.test.ts`

## 统计口径说明

详见各指标卡上的「口径提示」与「数据状态」徽章。核心原则：

- 年度增量 ≠ 当前状态（如当年新建仓库 ≠ 当前公开仓库总数）
- 无法可靠归因的提交不计入个人贡献
- 无法可靠还原的指标明确标记"不支持统计"，不使用估算值
