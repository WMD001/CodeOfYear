/**
 * 统计服务：所有统计口径的唯一实现
 * - 日期过滤 / 年度汇总 / 月度汇总 / 每日汇总
 * - 语言字节数汇总 / 仓库排行 / 连续贡献天数
 * - 指标一致性校验 / 数据完整性标记
 */
import type { GithubContributionDay, GithubLanguages, GithubRepository } from '../types/github'
import type {
  HeatmapDay,
  LanguageStat,
  MonthlyTrendItem,
  RepositoryRankItem,
} from '../types/report'
import { dayOfYear, isWithinRange, monthLabels } from '../utils/date'

/** 将 GraphQL 贡献日归一化为 HeatmapDay（含 dayOfYear / month） */
export function buildHeatmapDays(
  days: GithubContributionDay[],
  startDate: string,
  endDate: string,
): HeatmapDay[] {
  return days
    .filter((d) => isWithinRange(d.date, startDate, endDate))
    .map((d) => {
      const month = Number(d.date.slice(5, 7))
      return {
        ...d,
        dayOfYear: dayOfYear(d.date),
        month,
      }
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1))
}

/** 全年贡献总数与每日贡献汇总一致性校验。不一致返回差异说明。 */
export function consistencyCheck(
  totalContributions: number,
  days: HeatmapDay[],
): { ok: boolean; detail: string } {
  const sum = days.reduce((acc, d) => acc + d.contributionCount, 0)
  if (sum === totalContributions) {
    return { ok: true, detail: '全年贡献总数与每日汇总一致' }
  }
  return {
    ok: false,
    detail: `全年贡献总数（${totalContributions}）与每日汇总（${sum}）不一致，差异 ${totalContributions - sum}`,
  }
}

/** 月度提交趋势：1-12 月，未来月份 commits 为 null（未统计） */
export function monthlyTrend(
  days: HeatmapDay[],
  endDate: string,
): MonthlyTrendItem[] {
  const endMonth = Number(endDate.slice(5, 7))
  const byMonth = new Map<number, number>()
  for (const d of days) {
    byMonth.set(d.month, (byMonth.get(d.month) ?? 0) + d.contributionCount)
  }
  return monthLabels().map((label, i) => {
    const month = i + 1
    // 未来月份：不填充虚构零值，commits 置 null
    const isFuture = month > endMonth
    return {
      month,
      monthLabel: label,
      commits: isFuture ? null : byMonth.get(month) ?? 0,
      isComplete: !isFuture,
    }
  })
}

/**
 * 语言字节汇总
 * 输入：仓库全名 → 语言字节数映射列表
 * 输出：按字节降序的语言统计（百分比保留 2 位小数）
 */
export function aggregateLanguages(
  repoLanguages: Array<{ repo: string; languages: GithubLanguages }>,
): { stats: LanguageStat[]; totalBytes: number; repoCount: number } {
  const total = new Map<string, number>()
  let totalBytes = 0
  for (const { languages } of repoLanguages) {
    for (const [lang, bytes] of Object.entries(languages)) {
      total.set(lang, (total.get(lang) ?? 0) + bytes)
      totalBytes += bytes
    }
  }
  const stats: LanguageStat[] = [...total.entries()]
    .map(([language, bytes]) => ({
      language,
      bytes,
      percentage: totalBytes > 0 ? (bytes / totalBytes) * 100 : 0,
    }))
    .sort((a, b) => b.bytes - a.bytes)

  return { stats, totalBytes, repoCount: repoLanguages.length }
}

/** 主要开发语言（字节占比最高的语言） */
export function primaryLanguage(stats: LanguageStat[]): string | null {
  return stats.length > 0 ? stats[0].language : null
}

/**
 * 仓库排行（Top N）
 * 排序规则：优先按年度提交数（可可靠获取时）降序；
 * 无法可靠统计年度提交数时，榜单命名为"热门公开仓库"，按 Star 数排序并注明。
 */
export function rankRepositories(
  repos: GithubRepository[],
  yearlyCommits: Map<string, number>,
  limit: number,
): { items: RepositoryRankItem[]; sortedByCommits: boolean; sortNote: string } {
  const withCommits = repos
    .filter((r) => !r.fork)
    .map((r) => {
      const commits = yearlyCommits.get(r.fullName) ?? null
      return { repo: r, commits }
    })

  const hasReliableCommits = withCommits.some((w) => w.commits !== null && w.commits > 0)

  const sorted = [...withCommits].sort((a, b) => {
    if (hasReliableCommits) {
      const ca = a.commits ?? 0
      const cb = b.commits ?? 0
      if (cb !== ca) return cb - ca
    }
    return b.repo.stargazersCount - a.repo.stargazersCount
  })

  const sortNote = hasReliableCommits
    ? '按所选年度内可归因的提交数降序排序；提交数不可完整获取的仓库以 Star 数为次级排序。'
    : '无法可靠统计年度提交数，榜单按当前公开仓库 Star 数降序排序（"热门公开仓库"口径）。'

  const items = sorted.slice(0, limit).map(({ repo, commits }, i) => ({
    rank: i + 1,
    name: repo.name,
    fullName: repo.fullName,
    description: repo.description,
    language: repo.language,
    stars: repo.stargazersCount,
    forks: repo.forksCount,
    yearlyCommits: hasReliableCommits ? commits : null,
    createdAt: repo.createdAt,
    htmlUrl: repo.htmlUrl,
  }))

  return { items, sortedByCommits: hasReliableCommits, sortNote }
}

/** 年度内新建的公开仓库（created_at 位于年度内） */
export function reposCreatedInYear(
  repos: GithubRepository[],
  startDate: string,
  endDate: string,
): GithubRepository[] {
  return repos.filter(
    (r) => !r.fork && isWithinRange(r.createdAt.slice(0, 10), startDate, endDate),
  )
}

/** 当前公开仓库的 Star / Fork 总数 */
export function currentRepoStars(repos: GithubRepository[]): number {
  return repos.filter((r) => !r.fork).reduce((acc, r) => acc + r.stargazersCount, 0)
}

export function currentRepoForks(repos: GithubRepository[]): number {
  return repos.filter((r) => !r.fork).reduce((acc, r) => acc + r.forksCount, 0)
}

/** 有效统计年份判断 */
export function isValidYear(year: number): boolean {
  const current = new Date().getFullYear()
  return Number.isInteger(year) && year >= 2008 && year <= current
}
