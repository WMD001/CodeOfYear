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

### 关于 Token（可选）

完整贡献日历来自 GitHub GraphQL API，而 GraphQL **必须携带 Token** 才能调用。
未配置 Token 时（默认匿名模式），贡献日历降级为基于公开仓库提交记录的近似统计，并明确标记"部分"。

如需完整口径：报告页右上角「配置 Token」→ 填入 GitHub Personal Access Token
（classic 需 `repo` 或 `public_repo` 读取权限）。Token 仅保存在浏览器 localStorage，**不会**出现在分享链接中。

> 匿名模式下 GitHub API 限流约 60 次/小时（Search API 10 次/分钟），
> 语言/提交统计按需限量查询并缓存，超出部分标记为"部分统计"。

## 本地开发

```bash
npm install
npm run dev        # 启动开发服务器
npm run test       # 运行测试（LIVE_API=1 时额外执行真实 API 集成测试）
npm run build      # 生产构建（输出 dist/）
npm run preview    # 预览构建产物
```

## 部署（Vercel）

静态站点部署，无需后端：

1. 推送源码到 GitHub 仓库
2. Vercel → Import Project → 选择仓库
3. 构建配置：
   - Build Command：`npm run build`
   - Output Directory：`dist`
4. SPA 路由回退（Vercel 已内置）：直接打开/刷新报告 URL 不会 404

第一版无需环境变量、无需 Vercel Functions。

## 项目结构

```
src/
├── api/               # GitHub REST / GraphQL 封装（请求、重试、分页、错误归一化）
├── components/        # ReportHeader / MetricCards / ContributionHeatmap / RepositoryRanking /
│                      # LanguageChart / CommitTrend / ActivityPanel / ExtraStats / TokenSetting / DataStatus
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
- API 测试：有效/不存在用户、限流、网络失败、分页、Token 头
- 页面测试：查询交互、加载/错误/成功状态、分享与导出入口
- 真实 API 集成（可选）：`LIVE_API=1 npx vitest run tests/api/live.test.ts`

## 统计口径说明

详见各指标卡上的「口径提示」与「数据状态」徽章。核心原则：

- 年度增量 ≠ 当前状态（如当年新建仓库 ≠ 当前公开仓库总数）
- 无法可靠归因的提交不计入个人贡献
- 无法可靠还原的指标明确标记"不支持统计"，不使用估算值
