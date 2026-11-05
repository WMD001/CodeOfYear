/**
 * WrappedSummary：年度分享卡片（默认视图）
 * 参照已验证的单屏总览 demo：总览 / 仓库 / 语言 / Star / 社交 / 年度关键词 + 全宽热力图。
 * 全部数据来自 YearlyReport，不发起额外请求；「查看完整仪表盘」切换到仪表盘视图。
 */
import { useMemo, useRef, useState } from 'react'
import type { YearlyReport } from '../types/report'
import { formatNumber } from '../utils/date'
import { copyText, exportElementAsPng } from '../utils/export-image'
import { languageColor } from '../utils/language-colors'
import ContributionHeatmap from './ContributionHeatmap'

interface Props {
  report: YearlyReport
  modeLabel: string
  modeTone: 'complete' | 'partial'
  onViewFull: () => void
}

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function numOrDash(n: number | null): string {
  return n === null ? '—' : formatNumber(n)
}

function Stat({
  value,
  label,
  color,
}: {
  value: string
  label: string
  color: string
}) {
  return (
    <div>
      <div
        className="mono-num text-[30px] font-bold leading-none tracking-[-0.03em]"
        style={{ color }}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[10.5px] text-[#8b949e]">{label}</div>
    </div>
  )
}

function Keyword({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/[0.05] last:border-b-0 text-[10.5px]">
      <span className="text-[#8b949e]">{label}</span>
      <span className="mono-num font-semibold text-[#dbe4ee]">{value}</span>
    </div>
  )
}

export default function WrappedSummary({
  report,
  modeLabel,
  modeTone,
  onViewFull,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const { header, user, metrics, languages, topRepositories, activity, heatmap, monthlyTrend } =
    report

  const joinedYears = useMemo(() => {
    const created = Number(user.createdAt.slice(0, 4))
    return Number.isFinite(created) && header.year >= created
      ? header.year - created + 1
      : null
  }, [user.createdAt, header.year])

  const topLanguages = languages.stats.slice(0, 5)
  const topRepos = topRepositories.items.slice(0, 2)
  const maxRepoCommits = Math.max(
    ...topRepos.map((repo) => repo.yearlyCommits ?? 0),
    1,
  )

  const busiestMonth = useMemo(() => {
    const completed = monthlyTrend.filter((month) => month.commits !== null)
    if (completed.length === 0) return null
    return completed.reduce((best, month) =>
      (month.commits ?? 0) > (best.commits ?? 0) ? month : best,
    )
  }, [monthlyTrend])

  const busiestWeekday = useMemo(() => {
    const totals = [0, 0, 0, 0, 0, 0, 0]
    for (const day of heatmap.days) {
      if (day.contributionCount <= 0) continue
      const weekday = new Date(`${day.date}T00:00:00Z`).getUTCDay()
      totals[weekday] += day.contributionCount
    }
    const max = Math.max(...totals)
    return max > 0 ? WEEKDAY_NAMES[totals.indexOf(max)] : null
  }, [heatmap.days])

  const streakDays = activity.longestStreak.value?.days ?? null
  const primaryLanguage = topLanguages[0]?.language ?? null

  async function handleExport() {
    if (!cardRef.current || exporting) return
    setExporting(true)
    setExportError(null)
    const result = await exportElementAsPng(
      cardRef.current,
      `github-${header.username}-${header.year}-wrapped`,
    )
    setExporting(false)
    if (!result.ok) setExportError(result.error ?? '导出失败')
  }

  async function handleCopyLink() {
    const url = new URL(
      `/report/${encodeURIComponent(header.username)}`,
      window.location.origin,
    )
    url.searchParams.set('year', String(header.year))
    const ok = await copyText(url.toString())
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="min-h-screen page-glow">
      <div className="mx-auto max-w-[1180px] px-4 py-5 md:px-6">
        <div ref={cardRef}>
          {/* 顶部：用户名 + 总览说明 + 分享操作 */}
          <header className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <h1 className="mono-num text-[34px] md:text-[40px] font-bold leading-none tracking-[-0.04em] text-[#f2f6fa]">
                {header.username}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#8b949e]">
                <span>{header.year} · GitHub 年度贡献总览</span>
                {joinedYears !== null && (
                  <>
                    <span className="text-[#334052]">·</span>
                    <span>加入 GitHub 的第 {joinedYears} 年</span>
                  </>
                )}
                <span className="text-[#334052]">·</span>
                <span
                  className={
                    modeTone === 'complete' ? 'text-[#3fb950]' : 'text-[#d29922]'
                  }
                >
                  <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current align-middle" />
                  {modeLabel}
                </span>
              </div>
            </div>

            <div
              className="flex flex-wrap items-center gap-2"
              data-export-ignore="true"
            >
              {copied && (
                <span className="text-[10px] text-[#3fb950]" role="status">
                  ✓ 已复制
                </span>
              )}
              {exportError && (
                <span className="text-[10px] text-[#f85149]" role="alert">
                  导出失败
                </span>
              )}
              <button
                type="button"
                onClick={handleCopyLink}
                className="h-7 rounded-md border border-white/10 px-2.5 text-[10.5px] text-[#9aa7b6] transition hover:border-white/20 hover:text-[#e6edf3]"
              >
                复制链接
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                className="h-7 rounded-md border border-white/10 px-2.5 text-[10.5px] text-[#9aa7b6] transition hover:border-white/20 hover:text-[#e6edf3] disabled:opacity-50"
              >
                {exporting ? '导出中…' : '导出分享卡'}
              </button>
              <button
                type="button"
                onClick={onViewFull}
                className="h-7 rounded-md bg-[#238636] px-2.5 text-[10.5px] text-white transition hover:bg-[#2ea043]"
              >
                查看完整仪表盘 →
              </button>
            </div>
          </header>

          {/* 三栏总览 */}
          <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-[1.55fr_1fr_1fr]">
            <div className="flex min-w-0 flex-col gap-3">
              <section className="card p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-[14px] font-semibold text-[#e6edf3]">总览</h2>
                  <span className="mono-num text-[10px] text-[#6e7681]">
                    {header.year}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4">
                  <Stat
                    value={numOrDash(metrics.totalCommits.value)}
                    label="总提交"
                    color="#58a6ff"
                  />
                  <Stat
                    value={formatNumber(heatmap.totalContributions)}
                    label="总贡献"
                    color="#e3b341"
                  />
                  <Stat
                    value={formatNumber(user.publicRepos)}
                    label="公开仓库"
                    color="#3fb950"
                  />
                  <Stat
                    value={numOrDash(metrics.pullRequests.value)}
                    label="Pull Requests"
                    color="#a371f7"
                  />
                </div>
              </section>

              <section className="card flex flex-1 flex-col p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-[14px] font-semibold text-[#e6edf3]">仓库</h2>
                  <span className="text-[10px] text-[#6e7681]">年度提交分布</span>
                </div>

                {topRepos.length === 0 ? (
                  <p className="mt-4 text-[11px] text-[#8b949e]">
                    暂无年度仓库数据
                  </p>
                ) : (
                  <div className="mt-4 flex flex-col gap-3">
                    {topRepos.map((repo, index) => {
                      const commits = repo.yearlyCommits
                      const width =
                        commits === null
                          ? 0
                          : Math.max(4, (commits / maxRepoCommits) * 100)
                      return (
                        <div key={repo.fullName}>
                          <div className="mb-1.5 flex items-center justify-between gap-3">
                            <span className="truncate text-[10.5px] text-[#c7d1dd]">
                              {repo.name}
                            </span>
                            <span className="mono-num shrink-0 text-[9.5px] text-[#8b949e]">
                              {commits === null
                                ? '提交数不可用'
                                : `${formatNumber(commits)} 次提交`}
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                            <span
                              className="block h-full rounded-full"
                              style={{
                                width: `${width}%`,
                                background:
                                  index === 0
                                    ? 'linear-gradient(90deg,#d29922,#e3b341)'
                                    : 'linear-gradient(90deg,#2ea043,#3fb950)',
                              }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="mt-auto flex flex-wrap gap-3 pt-3">
                  {topRepos.map((repo) => (
                    <a
                      key={repo.fullName}
                      href={repo.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[10.5px] text-[#58a6ff] hover:underline"
                    >
                      {repo.name}
                      <span className="mono-num text-[9.5px] text-[#e3b341]">
                        ★ {formatNumber(repo.stars)}
                      </span>
                    </a>
                  ))}
                </div>
              </section>
            </div>

            <div className="flex min-w-0 flex-col gap-3">
              <section className="card flex-1 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-[14px] font-semibold text-[#e6edf3]">
                    编程语言
                  </h2>
                  {!languages.isComplete && (
                    <span className="text-[9.5px] text-[#d29922]">部分仓库</span>
                  )}
                </div>

                {topLanguages.length === 0 ? (
                  <p className="mt-4 text-[11px] text-[#8b949e]">暂无语言数据</p>
                ) : (
                  <ul className="mt-4 flex flex-col gap-2.5">
                    {topLanguages.map((lang) => (
                      <li
                        key={lang.language}
                        className="flex items-center gap-2 text-[11px]"
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: languageColor(lang.language) }}
                        />
                        <span className="flex-1 truncate text-[#c7d1dd]">
                          {lang.language}
                        </span>
                        <span className="mono-num text-[9.5px] text-[#8b949e]">
                          {lang.percentage.toFixed(1)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="card p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-[14px] font-semibold text-[#e6edf3]">
                    Star / Fork
                  </h2>
                  <span className="text-[10px] text-[#6e7681]">当前总数</span>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="mono-num text-[27px] font-bold leading-none text-[#3fb950]">
                    {numOrDash(metrics.stars.value)}
                  </span>
                  <span className="text-[10.5px] text-[#8b949e]">当前 Star</span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="mono-num text-[27px] font-bold leading-none text-[#e3b341]">
                    {numOrDash(metrics.forks.value)}
                  </span>
                  <span className="text-[10.5px] text-[#8b949e]">当前 Fork</span>
                </div>
                <p className="mt-3 text-[9.5px] leading-relaxed text-[#6e7681]">
                  公开 API 无法还原年度增量
                </p>
              </section>
            </div>

            <div className="flex min-w-0 flex-col gap-3">
              <section className="card p-4">
                <h2 className="text-[14px] font-semibold text-[#e6edf3]">社交</h2>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="mono-num text-[27px] font-bold leading-none text-[#dbe4ee]">
                    {formatNumber(user.following)}
                  </span>
                  <span className="text-[10.5px] text-[#8b949e]">关注</span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="mono-num text-[27px] font-bold leading-none text-[#dbe4ee]">
                    {formatNumber(user.followers)}
                  </span>
                  <span className="text-[10.5px] text-[#8b949e]">粉丝</span>
                </div>
              </section>

              <section className="card flex-1 p-4">
                <h2 className="text-[14px] font-semibold text-[#e6edf3]">
                  年度关键词
                </h2>
                <div className="mt-2 flex flex-col">
                  <Keyword
                    label="🔥 最长连续"
                    value={streakDays === null ? '—' : `${streakDays} 天`}
                  />
                  <Keyword label="☕ 主力语言" value={primaryLanguage ?? '—'} />
                  <Keyword
                    label="📈 最忙月份"
                    value={busiestMonth?.monthLabel ?? '—'}
                  />
                  <Keyword label="🗓 最活跃" value={busiestWeekday ?? '—'} />
                </div>
              </section>
            </div>
          </div>

          {/* 全宽热力图 */}
          <div className="mt-3">
            <ContributionHeatmap
              days={heatmap.days}
              totalContributions={heatmap.totalContributions}
              endDate={header.endDate}
            />
          </div>

          <div
            className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[10px] text-[#5f6b7a]"
            data-export-ignore="true"
          >
            <span>数据来源：GitHub 公开 API · 当前查看的是年度摘要</span>
            <button
              type="button"
              onClick={onViewFull}
              className="rounded-md bg-[#238636] px-2.5 py-1.5 text-[10.5px] text-white transition hover:bg-[#2ea043]"
            >
              查看完整仪表盘 →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}