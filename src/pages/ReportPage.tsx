import { useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useReport } from '../hooks/useReport'
import { hasGithubToken } from '../api/github-graphql'
import { copyText, exportElementAsPng } from '../utils/export-image'
import ReportHeader from '../components/ReportHeader'
import MetricCards from '../components/MetricCards'
import ContributionHeatmap from '../components/ContributionHeatmap'
import ContributionHighlights from '../components/ContributionHighlights'
import OtherStatsPanel from '../components/OtherStatsPanel'
import RepositoryRanking from '../components/RepositoryRanking'
import LanguageChart from '../components/LanguageChart'
import CommitTrend from '../components/CommitTrend'
import DevActivityPanel from '../components/DevActivityPanel'
import TokenSetting from '../components/TokenSetting'

const CURRENT_YEAR = new Date().getFullYear()

function ReportPage() {
  const { username: rawUsername } = useParams<{ username: string }>()
  const [searchParams] = useSearchParams()
  const [tokenOpen, setTokenOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const reportRef = useRef<HTMLDivElement>(null)
  const tokenConfigured = hasGithubToken()

  // URL 参数恢复：刷新后仍能根据 URL 恢复用户名和年份
  const username = useMemo(
    () => (rawUsername ? decodeURIComponent(rawUsername) : ''),
    [rawUsername],
  )

  const year = useMemo(() => {
    const raw = searchParams.get('year')
    const n = raw ? Number(raw) : NaN
    // 年份合法范围：2008（GitHub 成立）至当前年份
    return Number.isInteger(n) && n >= 2008 && n <= CURRENT_YEAR
      ? n
      : CURRENT_YEAR
  }, [searchParams])

  const { state, reload } = useReport(username, year)

  if (!username) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-lg text-[#8b949e]">缺少 GitHub 用户名</p>
        <Link to="/" className="text-[#58a6ff] hover:underline">
          返回首页查询
        </Link>
      </div>
    )
  }

  // 加载状态：显示当前数据获取阶段
  if (state.phase === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
        <div className="animate-spin w-10 h-10 border-2 border-[#30363d] border-t-[#2ea043] rounded-full" />
        <div className="text-center">
          <p className="text-lg text-[#e6edf3]">
            正在获取 <span className="text-[#58a6ff]">{username}</span> 的{' '}
            {year} 年 GitHub 数据…
          </p>
          <p className="mt-1 text-sm text-[#8b949e]">
            从 GitHub 公开 API 拉取用户资料、仓库、贡献日历与活动数据
          </p>
        </div>
      </div>
    )
  }

  // 错误状态
  if (state.phase === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-lg text-[#f85149]" role="alert">
          {state.message}
        </p>
        <div className="flex gap-3 flex-wrap justify-center">
          <button
            type="button"
            onClick={reload}
            className="bg-[#238636] hover:bg-[#2ea043] text-white font-medium rounded-lg px-6 py-2 transition"
          >
            重试
          </button>
          <button
            type="button"
            onClick={() => setTokenOpen(true)}
            className="border border-[#30363d] hover:border-[#3d444d] text-[#e6edf3] font-medium rounded-lg px-6 py-2 transition"
          >
            {tokenConfigured ? '修改 Token' : '配置 Token（可选）'}
          </button>
          <Link
            to="/"
            className="border border-[#30363d] hover:border-[#3d444d] text-[#e6edf3] font-medium rounded-lg px-6 py-2 transition"
          >
            返回首页
          </Link>
        </div>
        {state.kind === 'rate_limited' && (
          <p className="text-xs text-[#6e7681] max-w-md text-center leading-relaxed">
            提示：配置 Token 可将请求额度提升至 5000 次/小时，保存后会自动重新加载报告
          </p>
        )}
        <TokenSetting
          open={tokenOpen}
          onClose={() => setTokenOpen(false)}
          onSaved={reload}
        />
      </div>
    )
  }

  const report = state.report

  async function handleExport() {
    if (!reportRef.current || exporting) return
    setExporting(true)
    setExportError(null)
    const result = await exportElementAsPng(
      reportRef.current,
      `github-${report.header.username}-${report.header.year}-report`,
    )
    setExporting(false)
    if (!result.ok) setExportError(result.error ?? '导出失败')
  }

  async function handleCopyLink() {
    const url = `${window.location.origin}/report/${encodeURIComponent(report.header.username)}?year=${report.header.year}`
    const ok = await copyText(url)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="min-h-screen px-4 py-6 md:px-8 max-w-[1920px] mx-auto">
      {/* 数据模式工具条 + 导出/分享 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[#8b949e]">
          {report.dataMode === 'graphql' ? (
            <>
              <span className="text-[#3fb950]">● 完整数据模式</span>
              <span className="ml-2 text-[#6e7681]">
                已配置 Token，贡献日历使用 GitHub GraphQL 完整口径
              </span>
            </>
          ) : tokenConfigured ? (
            <>
              <span className="text-[#d29922]">● 降级数据模式</span>
              <span className="ml-2 text-[#6e7681]">
                已配置 Token，但贡献日历获取失败，已降级为公开仓库提交近似统计
              </span>
            </>
          ) : (
            <>
              <span className="text-[#d29922]">● 匿名数据模式</span>
              <span className="ml-2 text-[#6e7681]">
                贡献日历为公开仓库提交近似统计；配置 Token 可获得完整贡献日历
              </span>
            </>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {copied && (
            <span className="text-xs text-[#3fb950]" role="status">
              ✓ 链接已复制
            </span>
          )}
          {exportError && (
            <span className="text-xs text-[#f85149]" role="alert">
              导出失败：{exportError}
            </span>
          )}
          <button
            type="button"
            onClick={handleCopyLink}
            className="text-xs border border-[#30363d] hover:border-[#3d444d] text-[#8b949e] hover:text-[#e6edf3] rounded-lg px-3 py-1.5 transition"
          >
            复制分享链接
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="text-xs bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 text-white rounded-lg px-3 py-1.5 transition"
          >
            {exporting ? '导出中…' : '导出 PNG'}
          </button>
          <button
            type="button"
            onClick={() => setTokenOpen(true)}
            className="text-xs border border-[#30363d] hover:border-[#3d444d] text-[#8b949e] hover:text-[#e6edf3] rounded-lg px-3 py-1.5 transition"
          >
            {tokenConfigured ? '修改 Token' : '配置 Token（可选）'}
          </button>
        </div>
      </div>

      {/* 已配置 Token 但贡献日历降级时的提示 */}
      {report.graphqlError && (
        <div className="mb-4 border border-[#d29922]/40 bg-[#d29922]/10 rounded-lg px-4 py-2.5 text-xs text-[#d29922] leading-relaxed" role="status">
          贡献日历降级提示：{report.graphqlError}。完整热力图需 GitHub
          GraphQL 权限（classic Token 勾 public_repo 即可；fine-grained
          Token 需额外授予 Account → Contributions 读取权限）。
        </div>
      )}

      {/* 报告主体（导出 PNG 范围） */}
      <div ref={reportRef}>
        {/* 第一行：标题 + 用户资料条 */}
        <ReportHeader header={report.header} user={report.user} />

        {/* 第二行：核心指标卡片（8 张，含同比） */}
        <section className="mt-6">
          <MetricCards
            metrics={report.metrics}
            year={report.header.year}
            lastYear={report.lastYear}
          />
        </section>

        {/* 第三行：全年贡献热力图 + 右侧两面板（连续贡献/首次提交/寄语 + 年度其他数据） */}
        <section className="mt-6 grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr] gap-4">
          <ContributionHeatmap
            days={report.heatmap.days}
            totalContributions={report.heatmap.totalContributions}
            endDate={report.header.endDate}
          />
          <ContributionHighlights
            activity={report.activity}
            year={report.header.year}
            displayName={report.user.displayName || report.header.username}
            username={report.header.username}
          />
          <OtherStatsPanel extra={report.extra} />
        </section>

        {/* 第四行：年度核心分析（Top5 / 语言 / 趋势 / 活跃度，四列） */}
        <section className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <RepositoryRanking data={report.topRepositories} username={username} />
          <LanguageChart data={report.languages} />
          <CommitTrend
            trend={report.monthlyTrend}
            year={report.header.year}
            activity={report.activity}
            languages={report.languages.stats}
          />
          <DevActivityPanel activity={report.activity} year={report.header.year} />
        </section>

        <footer className="mt-8 pb-6 text-center text-xs text-[#6e7681]">
          数据来源：GitHub 公开 API（REST &amp; GraphQL）· 统计截止于{' '}
          {report.header.endDate} · 仅统计可公开获取的数据
        </footer>
      </div>

      <TokenSetting
        open={tokenOpen}
        onClose={() => setTokenOpen(false)}
        onSaved={reload}
      />
    </div>
  )
}

export default ReportPage
