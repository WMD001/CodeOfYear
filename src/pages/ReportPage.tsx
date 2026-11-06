import { useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useReport } from '../hooks/useReport'
import { hasGithubToken, setGithubToken } from '../api/http'
import { openGithubLogin } from '../api/oauth'
import DevTokenDialog from '../components/DevTokenDialog'
import WrappedSummary from '../components/WrappedSummary'
import LoadingScreen from '../components/LoadingScreen'
import { copyText, exportElementAsPng } from '../utils/export-image'
import ReportHeader from '../components/ReportHeader'
import MetricCards from '../components/MetricCards'
import ContributionHeatmap from '../components/ContributionHeatmap'

import OtherStatsPanel from '../components/OtherStatsPanel'
import RepositoryRanking from '../components/RepositoryRanking'
import LanguageChart from '../components/LanguageChart'
import CommitTrend from '../components/CommitTrend'
import DevActivityPanel from '../components/DevActivityPanel'

const CURRENT_YEAR = new Date().getFullYear()

function ReportPage() {
  const { username: rawUsername } = useParams<{ username: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
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

  const { state, reload, stage } = useReport(username, year)
  const [loggedIn, setLoggedIn] = useState(() => hasGithubToken())

  // 默认展示分享摘要；?view=full 进入完整仪表盘
  const view = searchParams.get('view') === 'full' ? 'full' : 'wrapped'

  function handleViewFull() {
    const next = new URLSearchParams(searchParams)
    next.set('view', 'full')
    setSearchParams(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleViewWrapped() {
    const next = new URLSearchParams(searchParams)
    next.delete('view')
    setSearchParams(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

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

  // 加载状态：按真实请求阶段展示生成过程动画
  if (state.phase === 'loading') {
    return <LoadingScreen username={username} year={year} stage={stage} />
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
  const visibilityLabel = report.includesPrivate ? '含私有' : '公开'
  const modeLabel =
    report.dataMode === 'graphql'
      ? `完整数据模式（${visibilityLabel}）`
      : loggedIn
        ? `降级数据模式（${visibilityLabel}）`
        : '匿名数据模式（公开）'
  const modeTone = report.dataMode === 'graphql' ? 'complete' : 'partial'
  const displayName = report.user.displayName || report.header.username
  const streakDays = report.activity.longestStreak.value?.days
  const firstContribution = report.activity.firstContribution.value
  // 连续贡献 / 首次提交并入热力图顶部统计行，避免单独占一张卡片
  const heatmapExtraStats = [
    {
      label: '最长连续',
      value: streakDays === null || streakDays === undefined ? '—' : `${streakDays} 天`,
    },
    {
      label: '首次提交',
      value: firstContribution ? firstContribution.slice(5) : '—',
    },
  ]

  if (view === 'wrapped') {
    return (
      <WrappedSummary
        report={report}
        modeLabel={modeLabel}
        modeTone={modeTone}
        onViewFull={handleViewFull}
      />
    )
  }

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
    const url = new URL(
      `/report/${encodeURIComponent(report.header.username)}`,
      window.location.origin,
    )
    url.searchParams.set('year', String(report.header.year))
    if (view === 'full') url.searchParams.set('view', 'full')
    const ok = await copyText(url.toString())
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const headerActions = (
    <>
      <button
        type="button"
        onClick={handleViewWrapped}
        className="h-7 text-[10.5px] border border-white/10 hover:border-white/20 text-[#9aa7b6] hover:text-[#e6edf3] rounded-md px-2.5 transition"
      >
        ← 返回摘要
      </button>
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

          {/* 私有数据提示：分享/导出前必须让用户明确知道 */}
          {report.includesPrivate && (
            <div
              className="mt-3 border border-[#d29922]/30 bg-[#d29922]/[0.07] rounded-lg px-4 py-2 text-[11px] text-[#d29922] leading-relaxed"
              role="status"
              data-export-ignore="true"
            >
              本报告包含私有仓库信息。分享链接或导出的 PNG 会显示私有仓库名称，请确认后再分享。
            </div>
          )}

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

          {/* 热力图 + 年度其他数据：热力图占主宽度，连续贡献/首次提交/寄语合并进卡片 */}
          <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3.6fr)_minmax(0,1fr)]">
            <ContributionHeatmap
              days={report.heatmap.days}
              totalContributions={report.heatmap.totalContributions}
              endDate={report.header.endDate}
              extraStats={heatmapExtraStats}
              quote={{
                text: '代码不只是工作，更是让想法变成现实的方式。',
                author: `${displayName}，继续加油！`,
              }}
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
