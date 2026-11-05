import { useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useReport } from '../hooks/useReport'
import { hasGithubToken, setGithubToken } from '../api/http'
import { openGithubLogin } from '../api/oauth'
import DevTokenDialog from '../components/DevTokenDialog'
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

const CURRENT_YEAR = new Date().getFullYear()

function ReportPage() {
  const { username: rawUsername } = useParams<{ username: string }>()
  const [searchParams] = useSearchParams()
  const [exporting, setExporting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const reportRef = useRef<HTMLDivElement>(null)

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
  const [loggedIn, setLoggedIn] = useState(() => hasGithubToken())

  /** 登录成功 / 退出后刷新登录态并重新加载报告 */
  function handleLogin() {
    openGithubLogin(() => {
      setLoggedIn(hasGithubToken())
      reload()
    })
  }
  function handleLogout() {
    setGithubToken(null)
    setLoggedIn(false)
    reload()
  }

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
          {import.meta.env.DEV && (
            <DevTokenDialog
              size="md"
              onSaved={() => {
                setLoggedIn(hasGithubToken())
                reload()
              }}
            />
          )}
          {!loggedIn && (
            <button
              type="button"
              onClick={handleLogin}
              className="border border-[#30363d] hover:border-[#3d444d] text-[#e6edf3] font-medium rounded-lg px-6 py-2 transition"
            >
              使用 GitHub 登录
            </button>
          )}
          <Link
            to="/"
            className="border border-[#30363d] hover:border-[#3d444d] text-[#e6edf3] font-medium rounded-lg px-6 py-2 transition"
          >
            返回首页
          </Link>
        </div>
        {state.kind === 'rate_limited' && (
          <p className="text-xs text-[#6e7681] max-w-md text-center leading-relaxed">
            提示：使用 GitHub 登录可将请求额度提升至 5000 次/小时，登录后会自动重新加载报告
          </p>
        )}
        {import.meta.env.DEV && state.kind === 'rate_limited' && (
          <p className="text-xs text-[#d29922] max-w-md text-center leading-relaxed">
            本地开发没有 OAuth 服务，可点击上方「开发 Token」填入 PAT，立即恢复额度并使用完整
            GraphQL 数据。
          </p>
        )}
      </div>
    )
  }

  const report = state.report
  const modeLabel =
    report.dataMode === 'graphql'
      ? '完整数据模式'
      : loggedIn
        ? '降级数据模式'
        : '匿名数据模式'

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

  const headerActions = (
    <>
      {copied && (
        <span className="text-[10px] text-[#3fb950]" role="status">
          ✓ 已复制
        </span>
      )}
      {exportError && (
        <span className="text-[10px] text-[#f85149]" role="alert">
          导出失败：{exportError}
        </span>
      )}
      {import.meta.env.DEV && (
        <DevTokenDialog
          onSaved={() => {
            setLoggedIn(hasGithubToken())
            reload()
          }}
        />
      )}
      <button
        type="button"
        onClick={handleCopyLink}
        aria-label="复制分享链接"
        className="h-7 text-[10.5px] border border-white/10 hover:border-white/20 text-[#9aa7b6] hover:text-[#e6edf3] rounded-md px-2.5 transition"
      >
        复制链接
      </button>
      <button
        type="button"
        onClick={handleExport}
        disabled={exporting}
        className="h-7 text-[10.5px] bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 text-white rounded-md px-2.5 transition"
      >
        {exporting ? '导出中…' : '导出 PNG'}
      </button>
      <button
        type="button"
        onClick={loggedIn ? handleLogout : handleLogin}
        className="h-7 text-[10.5px] border border-white/10 hover:border-white/20 text-[#9aa7b6] hover:text-[#e6edf3] rounded-md px-2.5 transition"
      >
        {loggedIn ? '退出登录' : '使用 GitHub 登录'}
      </button>
    </>
  )

  return (
    <div className="min-h-screen page-glow">
      <div className="mx-auto max-w-[1600px] px-4 py-4 md:px-8 md:py-5">
        {/* 报告主体（导出 PNG 范围） */}
        <div ref={reportRef}>
          <ReportHeader
            header={report.header}
            user={report.user}
            modeLabel={modeLabel}
            modeTone={report.dataMode === 'graphql' ? 'complete' : 'partial'}
            actions={headerActions}
          />

          {/* GraphQL 降级（已登录但贡献日历获取失败）时的提示 */}
          {report.graphqlError && (
            <div
              className="mt-3 border border-[#d29922]/30 bg-[#d29922]/[0.07] rounded-lg px-4 py-2 text-[11px] text-[#d29922] leading-relaxed"
              role="status"
            >
              贡献日历降级提示：{report.graphqlError}。可尝试退出后重新登录；
              OAuth 授权默认包含公开贡献读取权限。
            </div>
          )}

          {/* 匿名模式：非侵入式登录引导（不进入导出 PNG） */}
          {!loggedIn && report.dataMode === 'rest' && (
            <div
              className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border border-white/[0.07] bg-[#131a26] rounded-lg px-4 py-2 text-[11px] text-[#8b949e]"
              data-export-ignore="true"
            >
              <span className="text-[#d29922]">匿名模式</span>
              <span>当前为匿名额度访问，贡献热力图与部分指标为近似统计。</span>
              <button
                type="button"
                onClick={handleLogin}
                className="text-[#3fb950] hover:underline underline-offset-2 bg-transparent cursor-pointer"
              >
                使用 GitHub 登录，获取完整数据 →
              </button>
            </div>
          )}

          {/* 指标卡（8 张，含同比） */}
          <section className="mt-4">
            <MetricCards
              metrics={report.metrics}
              year={report.header.year}
              lastYear={report.lastYear}
            />
          </section>

          {/* 热力图 + 贡献亮点 + 年度其他数据 */}
          <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2.8fr)_minmax(0,1fr)_minmax(0,1.3fr)] 2xl:grid-cols-[minmax(0,4.4fr)_minmax(0,1fr)_minmax(0,1.8fr)]">
            <div className="min-w-0">
              <ContributionHeatmap
                days={report.heatmap.days}
                totalContributions={report.heatmap.totalContributions}
                endDate={report.header.endDate}
              />
            </div>
            <ContributionHighlights
              activity={report.activity}
              displayName={report.user.displayName || report.header.username}
              username={report.header.username}
            />
            <OtherStatsPanel extra={report.extra} />
          </section>

          {/* 年度核心分析：Top5 / 语言 / 趋势 / 活跃度 */}
          <section className="mt-4 grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-[1.5fr_1.05fr_1.1fr_0.9fr] gap-4">
            <RepositoryRanking data={report.topRepositories} username={username} />
            <LanguageChart
              data={report.languages}
              totalContributions={report.heatmap.totalContributions}
            />
            <CommitTrend
              trend={report.monthlyTrend}
              year={report.header.year}

              activity={report.activity}
              languages={report.languages.stats}
            />
            <DevActivityPanel activity={report.activity} year={report.header.year} />
          </section>
        </div>
      </div>
    </div>
  )
}

export default ReportPage
