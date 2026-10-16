/**
 * 报告组装服务：编排 API 数据获取、统计计算与口径降级，
 * 输出统一 YearlyReport 模型。
 *
 * 数据获取策略：
 * - 用户资料 + 仓库列表（REST，必须）
 * - 贡献日历（GraphQL，需 Token；无 Token 时降级为 REST commits 近似）
 * - 年度 PR/Issue/Review/评论（Search API，高效计数）
 * - 语言统计（REST languages，限量查询，超出标记部分统计）
 * - Gists（REST）
 *
 * 所有指标带数据状态（完整/部分/不支持/错误），禁止伪造数据。
 */
import { getContributionsCollection, hasGithubToken } from '../api/github-graphql'
import {
  getGists,
  getRepositoryCommits,
  getRepositoryLanguages,
  getUserProfile,
  getUserRepositories,
  searchCommenterCount,
  searchIssueStats,
  searchPullRequestStats,
  searchReviewedPrCount,
} from '../api/github-rest'
import { GithubApiError } from '../api/github-errors'
import { complete, empty, unsupported } from '../types/data-status'
import type {
  GithubCommit,
  GithubContributionDay,
  GithubLanguages,
  GithubRepository,
} from '../types/github'
import type {
  ActivityPanelData,
  ExtraStats,
  HeatmapDay,
  MetricCards,
  ReportHeader,
  YearlyReport,
} from '../types/report'
import {
  aggregateLanguages,
  buildHeatmapDays,
  consistencyCheck,
  currentRepoForks,
  currentRepoStars,
  isValidYear,
  monthlyTrend,
  primaryLanguage,
  rankRepositories,
  reposCreatedInYear,
} from './statistics-service'
import { dayOfYear, longestStreak, yearEndDate, yearStartDate } from '../utils/date'

/** 匿名模式下提交/语言查询的仓库数量上限（控制 REST 限流） */
const ANON_REPO_QUERY_LIMIT = 10
/** Token 模式下提交/语言查询上限 */
const TOKEN_REPO_QUERY_LIMIT = 25

/** 简单并发池：控制并发请求数，避免触发限流 */
async function pool<T>(tasks: Array<() => Promise<T>>, concurrency: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let index = 0
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (true) {
      const i = index++
      if (i >= tasks.length) return
      try {
        results[i] = await tasks[i]()
      } catch (err) {
        results[i] = err as T
      }
    }
  })
  await Promise.all(workers)
  return results
}

/** 失败项提取：将池结果中的错误标记出来 */
function isError<T>(v: T): v is T & Error {
  return v instanceof Error
}

/** 计算每日贡献等级（GitHub 风格四级制） */
function contributionLevel(count: number, max: number): GithubContributionDay['contributionLevel'] {
  if (count <= 0) return 'NONE'
  if (max <= 0) return 'FIRST_QUARTILE'
  const ratio = count / max
  if (ratio > 0.66) return 'FOURTH_QUARTILE'
  if (ratio > 0.33) return 'THIRD_QUARTILE'
  return 'SECOND_QUARTILE'
}

export async function loadYearlyReport(
  username: string,
  year: number,
): Promise<YearlyReport> {
  if (!isValidYear(year)) {
    throw new GithubApiError('validation', `统计年份无效：${year}`, null)
  }

  const startDate = yearStartDate(year)
  const endDate = yearEndDate(year)
  const generatedAt = new Date().toISOString()
  const hasToken = hasGithubToken()

  /* ---------- 1. 用户资料（404 直接报错） ---------- */
  let profile
  try {
    profile = await getUserProfile(username)
  } catch (err) {
    if (err instanceof GithubApiError && err.kind === 'not_found') {
      throw new GithubApiError(
        'not_found',
        `未找到 GitHub 用户「${username}」：该用户名不存在或已被删除`,
        404,
      )
    }
    throw err
  }

  /* ---------- 2. 仓库列表 ---------- */
  let repos: GithubRepository[] = []
  try {
    repos = await getUserRepositories(username)
  } catch (err) {
    // 仓库列表失败：其余指标按空仓库继续，最终以数据状态标记
    console.warn(`[gyr] 仓库列表获取失败：${err instanceof Error ? err.message : err}`)
  }
  const nonForkRepos = repos.filter((r) => !r.fork)

  /* ---------- 3. 贡献日历 / 提交近似 ---------- */
  const queryRepos = [...nonForkRepos]
    .sort((a, b) => (b.pushedAt ?? '').localeCompare(a.pushedAt ?? ''))
    .slice(0, hasToken ? TOKEN_REPO_QUERY_LIMIT : ANON_REPO_QUERY_LIMIT)

  // 仓库级年度提交（用于总提交数与排行）
  const commitResults = await pool(
    queryRepos.map((r) => () =>
      getRepositoryCommits(r.fullName.split('/')[0], r.name, startDate, endDate),
    ),
    3,
  )
  const commitsByRepo = new Map<string, GithubCommit[]>()
  commitResults.forEach((res, i) => {
    const repo = queryRepos[i]
    if (!isError(res)) commitsByRepo.set(repo.fullName, res)
  })

  // 归因提交：按 author.login 匹配目标用户（无法归因的不计入）
  const attributedCommits = new Map<string, GithubCommit[]>()
  for (const [fullName, commits] of commitsByRepo) {
    const mine = commits.filter(
      (c) => c.authorLogin && c.authorLogin.toLowerCase() === username.toLowerCase(),
    )
    if (mine.length > 0) attributedCommits.set(fullName, mine)
  }
  const attributedCommitDates = new Set<string>()
  let totalCommitsAttributed = 0
  for (const commits of attributedCommits.values()) {
    for (const c of commits) {
      const d = c.date.slice(0, 10)
      if (d >= startDate && d <= endDate) {
        attributedCommitDates.add(d)
        totalCommitsAttributed++
      }
    }
  }

  // GraphQL 贡献日历（有 Token 时）
  let calendarDays: HeatmapDay[] = []
  let calendarTotal = 0
  let calendarState: 'graphql' | 'rest-fallback' = 'rest-fallback'

  if (hasToken) {
    try {
      const collection = await getContributionsCollection(username, startDate, endDate)
      calendarDays = buildHeatmapDays(
        collection.contributionCalendar.weeks.flatMap((w) => w.contributionDays),
        startDate,
        endDate,
      )
      calendarTotal = collection.contributionCalendar.totalContributions
      calendarState = 'graphql'
    } catch (err) {
      // 降级到 REST 提交近似
      console.warn(`[gyr] GraphQL 贡献日历不可用，降级为提交近似：${err instanceof Error ? err.message : err}`)
    }
  }

  const useGraphql = calendarState === 'graphql'
  if (!useGraphql) {
    // 匿名降级：以归因提交日期为贡献日（口径：仅提交贡献，不含 PR/Issue 等）
    const dates = Array.from(attributedCommitDates).sort()
    const maxCount = Math.max(1, ...dates.map((d) => countForDate(d)))
    calendarDays = dates.map((date) => {
      const count = countForDate(date)
      return {
        date,
        contributionCount: count,
        contributionLevel: contributionLevel(count, maxCount),
        dayOfYear: dayOfYear(date),
        month: Number(date.slice(5, 7)),
      }
    })
    calendarTotal = totalCommitsAttributed
  }

  function countForDate(date: string): number {
    let n = 0
    for (const commits of attributedCommits.values()) {
      for (const c of commits) {
        if (c.date.slice(0, 10) === date) n++
      }
    }
    return n
  }

  /* ---------- 4. 语言统计（限量，部分失败标记部分） ---------- */
  const langLimit = hasToken ? TOKEN_REPO_QUERY_LIMIT : 12
  const langRepos = nonForkRepos
    .sort((a, b) => b.stargazersCount - a.stargazersCount)
    .slice(0, langLimit)
  const langResults = await pool(
    langRepos.map((r) => () => getRepositoryLanguages(r.fullName.split('/')[0], r.name)),
    3,
  )
  const repoLanguages: Array<{ repo: string; languages: GithubLanguages }> = []
  let langErrors = 0
  langResults.forEach((res, i) => {
    if (!isError(res)) repoLanguages.push({ repo: langRepos[i].fullName, languages: res })
    else langErrors++
  })
  const languageAgg = aggregateLanguages(repoLanguages)
  const languagesComplete =
    langErrors === 0 && nonForkRepos.length <= langLimit
  const languagesState = languageAgg.stats.length > 0
    ? {
        stats: languageAgg.stats,
        repoCount: repoLanguages.length,
        totalBytes: languageAgg.totalBytes,
        isComplete: languagesComplete,
      }
    : { stats: [] as typeof languageAgg.stats, repoCount: 0, totalBytes: 0, isComplete: false }

  /* ---------- 5. 年度 PR / Issue / Review / 评论（Search API） ---------- */
  const prStats = await searchPullRequestStats(username, startDate, endDate)
  const issueStats = await searchIssueStats(username, startDate, endDate)
  const reviewedCount = await searchReviewedPrCount(username, startDate, endDate)
  const commenterCount = await searchCommenterCount(username, startDate, endDate)

  /* ---------- 6. Gists ---------- */
  let gistCount = 0
  try {
    gistCount = (await getGists(username)).length
  } catch {
    gistCount = 0
  }

  /* ---------- 7. 指标组装 ---------- */
  const activeDates = calendarDays.filter((d) => d.contributionCount > 0).map((d) => d.date)
  const streak = longestStreak(activeDates)
  const activeRepos = new Set<string>()
  for (const [fullName, commits] of attributedCommits) {
    if (commits.some((c) => c.date.slice(0, 10) >= startDate && c.date.slice(0, 10) <= endDate)) {
      activeRepos.add(fullName)
    }
  }

  const contributionDaysCount = activeDates.length
  const totalCommits = calendarDays.reduce((acc, d) => acc + d.contributionCount, 0)

  const completedMonths = monthlyTrend(calendarDays, endDate).filter((m) => m.isComplete)
  const avgMonthlyCommits =
    completedMonths.length > 0 ? totalCommits / completedMonths.length : 0

  const metrics: MetricCards = {
    totalCommits: {
      status: calendarDays.length > 0 ? (useGraphql ? 'complete' : 'partial') : 'empty',
      value: totalCommits,
      note: useGraphql
        ? '来自 GitHub 贡献统计（Commit Contributions）'
        : `无 Token 降级：基于最近 ${queryRepos.length} 个公开仓库的提交记录按作者归因统计，非完整贡献口径`,
      source: useGraphql ? 'GitHub GraphQL' : 'GitHub REST /repos/*/commits',
    },
    newRepositories: {
      status: repos.length > 0 ? 'complete' : 'empty',
      value: reposCreatedInYear(repos, startDate, endDate).length,
      note: '仅统计当前仍可查询到的公开仓库（created_at 在年度内）',
      source: 'GET /users/{user}/repos',
    },
    stars: {
      status: nonForkRepos.length > 0 ? 'complete' : 'empty',
      value: currentRepoStars(repos),
      note: '公开 API 无法可靠还原年度 Star 增量，展示当前仓库 Star 总数',
      source: 'GET /users/{user}/repos',
    },
    starsIsYearly: false,
    forks: {
      status: nonForkRepos.length > 0 ? 'complete' : 'empty',
      value: currentRepoForks(repos),
      note: '公开 API 无法可靠还原年度 Fork 增量，展示当前仓库 Fork 总数',
      source: 'GET /users/{user}/repos',
    },
    forksIsYearly: false,
    contributionDays: {
      status: calendarDays.length > 0 ? (useGraphql ? 'complete' : 'partial') : 'empty',
      value: contributionDaysCount,
      note: useGraphql
        ? '年度内至少存在一项 GitHub 贡献的日期数'
        : `降级口径：有提交记录的日期数（仅覆盖 ${queryRepos.length} 个仓库）`,
      source: useGraphql ? 'GitHub GraphQL contributionCalendar' : 'REST commits 近似',
    },
    pullRequests: {
      status: 'complete',
      value: prStats.total,
      note: `创建 ${prStats.total} / 合并 ${prStats.merged} / 关闭未合并 ${prStats.closedUnmerged} / 开放 ${prStats.open}（author 口径）`,
      source: 'GitHub Search API',
    },
    issues: {
      status: 'complete',
      value: issueStats.total,
      note: `创建 ${issueStats.total} / 已关闭 ${issueStats.closed} / 当前开放 ${issueStats.open}（author 口径）`,
      source: 'GitHub Search API',
    },
    reviews: {
      status: reviewedCount > 0 ? 'partial' : 'complete',
      value: reviewedCount,
      note: '按 reviewed-by 近似统计参与评审的 PR 数，不等于 Review 次数',
      source: 'GitHub Search API',
    },
  }

  /* ---------- 8. 仓库排行 ---------- */
  const yearlyCommitsMap = new Map<string, number>()
  for (const [fullName, commits] of attributedCommits) {
    yearlyCommitsMap.set(fullName, commits.length)
  }
  const ranking = rankRepositories(nonForkRepos, yearlyCommitsMap, 5)

  /* ---------- 9. 活跃度面板 ---------- */
  const activity: ActivityPanelData = {
    longestStreak: streak
      ? complete(streak, useGraphql ? '来自贡献日历' : '来自提交记录近似')
      : empty('年度内无连续贡献记录'),
    firstContribution:
      activeDates.length > 0
        ? complete(activeDates[0])
        : empty('年度内无贡献记录'),
    lastContribution:
      activeDates.length > 0
        ? complete(activeDates[activeDates.length - 1])
        : empty('年度内无贡献记录'),
    activeDays: {
      status: calendarDays.length > 0 ? (useGraphql ? 'complete' : 'partial') : 'empty',
      value: contributionDaysCount,
    },
    activeRepos: {
      status: activeRepos.size > 0 || nonForkRepos.length === 0 ? 'complete' : 'partial',
      value: activeRepos.size,
      note: useGraphql
        ? '年度内有归因提交记录的仓库数'
        : `降级口径：最近 ${queryRepos.length} 个仓库中有年度提交的仓库数`,
    },
    activeRepoRatio: {
      status: nonForkRepos.length > 0 ? 'complete' : 'empty',
      value: nonForkRepos.length > 0 ? (activeRepos.size / nonForkRepos.length) * 100 : null,
      note: `分母为当前可访问的公开仓库数（${nonForkRepos.length}）`,
    },
    avgMonthlyCommits: {
      status: completedMonths.length > 0 ? 'complete' : 'empty',
      value: avgMonthlyCommits,
      note: `已完成月份数：${completedMonths.length}`,
    },
    prMerged: { status: 'complete', value: prStats.merged },
    avgPrMergeDays: unsupported('需要遍历已合并 PR 的创建/合并时间，第一版暂不统计'),
    issueCloseRate: {
      status: issueStats.total > 0 ? 'complete' : 'empty',
      value: issueStats.total > 0 ? (issueStats.closed / issueStats.total) * 100 : null,
      note: `范围：年度创建的 ${issueStats.total} 个 Issue 中当前已关闭的比例`,
    },
  }

  /* ---------- 10. 其他统计 ---------- */
  const extra: ExtraStats = {
    currentPublicRepos: nonForkRepos.length,
    currentTotalForks: {
      status: repos.length > 0 ? 'complete' : 'empty',
      value: currentRepoForks(repos),
    },
    currentTotalStars: {
      status: repos.length > 0 ? 'complete' : 'empty',
      value: currentRepoStars(repos),
    },
    yearlyNewRepos: {
      status: repos.length > 0 ? 'complete' : 'empty',
      value: reposCreatedInYear(repos, startDate, endDate).length,
    },
    gists: { status: 'complete', value: gistCount, source: 'GET /users/{user}/gists' },
    yearlyPRs: { status: 'complete', value: prStats.total },
    yearlyIssues: { status: 'complete', value: issueStats.total },
    yearlyReviews: { status: 'partial', value: reviewedCount, note: 'reviewed-by 近似口径' },
    comments: {
      status: 'partial',
      value: commenterCount,
      note: '发表过评论的议题/PR 数量（近似，不等于评论条数）',
    },
    primaryLanguage: {
      status: languagesState.stats.length > 0 ? 'complete' : 'empty',
      value: primaryLanguage(languagesState.stats),
    },
    lastConfirmedContribution:
      activeDates.length > 0
        ? complete(activeDates[activeDates.length - 1])
        : empty('年度内无贡献记录'),
  }

  /* ---------- 11. 组装报告 ---------- */
  const header: ReportHeader = {
    username,
    displayName: profile.name || profile.login,
    avatarUrl: profile.avatarUrl,
    year,
    startDate,
    endDate,
    generatedAt,
  }

  // 一致性校验（有 GraphQL 数据时）
  const check = consistencyCheck(calendarTotal, calendarDays)
  if (!check.ok) {
    // 保留数据但记录说明（降级统计不伪装为完整）
    console.warn(`[gyr] 贡献数据一致性校验：${check.detail}`)
  }

  const report: YearlyReport = {
    header,
    user: {
      login: profile.login,
      displayName: profile.name,
      avatarUrl: profile.avatarUrl,
      bio: profile.bio,
      htmlUrl: profile.htmlUrl,
      company: profile.company,
      location: profile.location,
      publicRepos: profile.publicRepos,
      followers: profile.followers,
      following: profile.following,
      createdAt: profile.createdAt,
    },
    metrics,
    heatmap: {
      days: calendarDays,
      totalContributions: calendarTotal,
    },
    topRepositories: ranking,
    languages: languagesState,
    monthlyTrend: monthlyTrend(calendarDays, endDate),
    activity,
    extra,
  }

  return report
}
