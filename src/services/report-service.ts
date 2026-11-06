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
import { getContributionsCollection } from '../api/github-graphql'
import {
  getGists,
  getRepositoryCommits,
  getRepositoryLanguages,
  getUserProfile,
  getUserRepositories,
  searchCommenterCount,
  searchIssueStats,
  searchMergedPrDurations,
  searchPullRequestStats,
  searchReviewedPrCount,
} from '../api/github-rest'
import { fetchViewerLogin, getGithubLogin, hasGithubToken, usesGithubProxy } from '../api/http'
import { GithubApiError } from '../api/github-errors'
import { complete, empty, error, unsupported } from '../types/data-status'
import type {
  GithubCommit,
  GithubContributionDay,
  GithubContributionsCollection,
  GithubLanguages,
  GithubRepository,
} from '../types/github'
import type {
  ActivityPanelData,
  ExtraStats,
  HeatmapDay,
  LastYearSnapshot,
  MetricCards,
  ReportHeader,
  ReportStage,
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

/**
 * 将可能失败的统计请求收敛为结果对象。
 * Search API 限流（匿名 10 次/分钟）时不应阻塞整份报告，
 * 失败项由调用方映射为 error 数据状态，而不是用 0 掩盖。
 */
async function settle<T>(
  promise: Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; reason: string }> {
  try {
    return { ok: true, value: await promise }
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error && err.message ? err.message : '请求失败',
    }
  }
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

/**
 * 上一年度同口径数据（best-effort，用于指标卡同比展示）。
 * 任一来源失败/限流时缺省对应字段，调用方据此隐藏同比行（禁止估算）。
 * - Search API：去年创建的 PR / Issue / Review（匿名与 Token 模式均尝试）
 * - GraphQL：去年贡献日历（仅当前年已成功使用 GraphQL 时）
 * - 去年新建公开仓库：由当前仓库列表按 created_at 过滤
 */
async function loadLastYearStats(
  username: string,
  year: number,
  useGraphql: boolean,
  repos: GithubRepository[],
  publicOnly: boolean,
  cacheScope: 'self' | 'public',
): Promise<LastYearSnapshot | undefined> {
  if (year <= 2009) return undefined // 无法获取 2008 年前的对比数据
  const lastYear = year - 1
  const from = yearStartDate(lastYear)
  const to = yearEndDate(lastYear)
  const snapshot: LastYearSnapshot = {}

  // 去年新建公开仓库（当前仍可查询到的口径，与当年一致）
  try {
    const created = reposCreatedInYear(repos, from, to)
    if (created.length > 0) snapshot.newRepositories = created.length
  } catch {
    /* 忽略，不展示同比 */
  }

  // 去年 PR / Issue / Review（Search API）
  try {
    const [pr, issue, review] = await Promise.all([
      searchPullRequestStats(username, from, to, publicOnly),
      searchIssueStats(username, from, to, publicOnly),
      searchReviewedPrCount(username, from, to, publicOnly),
    ])
    snapshot.pullRequests = pr.total
    snapshot.issues = issue.total
    snapshot.reviews = review
  } catch {
    /* 限流或失败：忽略，不展示同比 */
  }

  // 去年贡献日历（仅 GraphQL 可用时，同当年口径）
  if (useGraphql) {
    try {
      const collection = await getContributionsCollection(
        username,
        from,
        to,
        cacheScope,
      )
      snapshot.totalCommits = collection.totalCommitContributions
      snapshot.contributionDays = collection.contributionCalendar.weeks
        .flatMap((w) => w.contributionDays)
        .filter((d) => d.contributionCount > 0).length
    } catch {
      /* 忽略，不展示同比 */
    }
  }

  return Object.keys(snapshot).length > 0 ? snapshot : undefined
}

export async function loadYearlyReport(
  username: string,
  year: number,
  onStage?: (stage: ReportStage) => void,
): Promise<YearlyReport> {
  if (!isValidYear(year)) {
    throw new GithubApiError('validation', `统计年份无效：${year}`, null)
  }

  onStage?.('profile')

  const startDate = yearStartDate(year)
  const endDate = yearEndDate(year)
  const generatedAt = new Date().toISOString()
  const hasToken = hasGithubToken()
  // 未登录的生产环境会走 /api/github 代理，由服务端附加应用级 PAT
  const serverProxy = usesGithubProxy()
  // 只有“登录用户本人”才允许读取私有仓库；他人报告强制公开口径
  const viewerLogin = hasToken
    ? (getGithubLogin() ?? (await fetchViewerLogin()))
    : null
  const isSelf = Boolean(
    hasToken &&
      viewerLogin &&
      viewerLogin.toLowerCase() === username.toLowerCase(),
  )
  const includePrivate = isSelf
  const publicOnly = !isSelf
  const cacheScope: 'self' | 'public' = isSelf ? 'self' : 'public'

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
  onStage?.('repos')
  let repos: GithubRepository[] = []
  try {
    repos = await getUserRepositories(username, includePrivate)
  } catch (err) {
    // 仓库列表失败：其余指标按空仓库继续，最终以数据状态标记
    console.warn(`[gyr] 仓库列表获取失败：${err instanceof Error ? err.message : err}`)
  }
  const nonForkRepos = repos.filter((r) => !r.fork)

  /* ---------- 3. GraphQL 贡献日历（已登录时优先，精确口径） ---------- */
  onStage?.('contributions')
  let calendarDays: HeatmapDay[] = []
  let calendarTotal = 0
  let useGraphql = false
  let graphqlError: string | undefined
  let collection: GithubContributionsCollection | undefined

  if (hasToken || serverProxy) {
    try {
      collection = await getContributionsCollection(
        username,
        startDate,
        endDate,
        cacheScope,
      )
      calendarDays = buildHeatmapDays(
        collection.contributionCalendar.weeks.flatMap((w) => w.contributionDays),
        startDate,
        endDate,
      )
      calendarTotal = collection.contributionCalendar.totalContributions
      useGraphql = true
    } catch (err) {
      // 登录用户的失败需要提示；未登录代理失败则静默降级，避免对匿名访客报错
      if (hasToken) {
        graphqlError = err instanceof Error ? err.message : '贡献日历获取失败'
        console.warn(`[gyr] GraphQL 贡献日历不可用，降级为提交近似：${graphqlError}`)
      }
    }
  }

  /* ---------- 3b. 仓库级年度提交（排行 / 活跃仓库用） ---------- */
  // GraphQL 模式：commitContributionsByRepository 一次拿全（精确，无请求开销）
  // 降级模式：REST 逐仓库拉取提交并按作者归因（覆盖最近 N 个仓库，近似）
  const queryRepos = useGraphql
    ? []
    : [...nonForkRepos]
        .sort((a, b) => (b.pushedAt ?? '').localeCompare(a.pushedAt ?? ''))
        .slice(0, hasToken ? TOKEN_REPO_QUERY_LIMIT : ANON_REPO_QUERY_LIMIT)

  const restCommitsByRepo = new Map<string, GithubCommit[]>()
  if (queryRepos.length > 0) {
    const commitResults = await pool(
      queryRepos.map((r) => () =>
        getRepositoryCommits(r.fullName.split('/')[0], r.name, startDate, endDate),
      ),
      3,
    )
    commitResults.forEach((res, i) => {
      if (!isError(res)) restCommitsByRepo.set(queryRepos[i].fullName, res)
    })
  }

  // 归因提交：按 author.login 匹配目标用户（无法归因的不计入）
  const attributedCommits = new Map<string, GithubCommit[]>()
  for (const [fullName, commits] of restCommitsByRepo) {
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

  // 仓库 → 年度提交数（排序口径：GraphQL 精确值 / REST 归因近似值）
  const yearlyCommitsMap = new Map<string, number>()
  if (useGraphql && collection) {
    for (const r of collection.commitsByRepo) yearlyCommitsMap.set(r.fullName, r.count)
  } else {
    for (const [fullName, commits] of attributedCommits) {
      yearlyCommitsMap.set(fullName, commits.length)
    }
  }

  // 匿名降级日历：以归因提交日期为贡献日（口径：仅提交贡献，不含 PR/Issue 等）
  if (!useGraphql) {
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

  // 上一年度同口径数据（best-effort，同比展示用）
  onStage?.('languages')
  const lastYear = await loadLastYearStats(
    username,
    year,
    useGraphql,
    nonForkRepos,
    publicOnly,
    cacheScope,
  )

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
  onStage?.('search')
  // Search API 匿名限流仅 10 次/分钟，失败时保留其余数据并把对应指标标为 error
  const [prResult, issueResult, reviewResult, commentResult] = await Promise.all([
    settle(searchPullRequestStats(username, startDate, endDate, publicOnly)),
    settle(searchIssueStats(username, startDate, endDate, publicOnly)),
    settle(searchReviewedPrCount(username, startDate, endDate, publicOnly)),
    settle(searchCommenterCount(username, startDate, endDate, publicOnly)),
  ])
  const prStats = prResult.ok ? prResult.value : null
  const issueStats = issueResult.ok ? issueResult.value : null
  const reviewedCount = reviewResult.ok ? reviewResult.value : null
  const commenterCount = commentResult.ok ? commentResult.value : null
  const searchFailureNote = 'GitHub Search API 请求失败，该指标暂不可用'

  // 已合并 PR 平均合并时长（有已合并 PR 时才有意义；失败不阻塞报告）
  let mergeDuration: { total: number; sampled: number; avgDays: number | null } | null = null
  if (prStats && prStats.merged > 0) {
    try {
      mergeDuration = await searchMergedPrDurations(
        username,
        startDate,
        endDate,
        publicOnly,
      )
    } catch (err) {
      console.warn(`[gyr] PR 合并时长获取失败：${err instanceof Error ? err.message : err}`)
    }
  }

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
  // 年度内有可归因提交的仓库（GraphQL 精确口径，含参与协作的他人仓库）
  const activeRepoNames = new Set(yearlyCommitsMap.keys())
  // 占比分子限定为本人公开仓库，保证比值 ≤ 100%
  const ownActiveRepos = nonForkRepos.filter((r) => yearlyCommitsMap.has(r.fullName)).length

  const contributionDaysCount = activeDates.length
  // 总提交 = 纯提交口径（GraphQL totalCommitContributions / REST 归因提交数），
  // 与热力图的"全部贡献"（含 PR/Issue/Review）分开统计
  const totalCommitCount = useGraphql && collection
    ? collection.totalCommitContributions
    : totalCommitsAttributed

  const completedMonths = monthlyTrend(calendarDays, endDate).filter((m) => m.isComplete)
  const avgMonthlyCommits =
    completedMonths.length > 0 ? totalCommitCount / completedMonths.length : 0

  const metrics: MetricCards = {
    totalCommits: {
      status: useGraphql ? 'complete' : calendarDays.length > 0 ? 'partial' : 'empty',
      value: totalCommitCount,
      note: useGraphql
        ? '来自 GitHub 贡献统计（Commit Contributions，仅计提交，不含 PR/Issue/Review）'
        : `未登录降级：基于最近 ${queryRepos.length} 个公开仓库的提交记录按作者归因统计，非完整贡献口径`,
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
    pullRequests: prStats
      ? {
          status: 'complete',
          value: prStats.total,
          note: `创建 ${prStats.total} / 合并 ${prStats.merged} / 关闭未合并 ${prStats.closedUnmerged} / 开放 ${prStats.open}（author 口径）`,
          source: 'GitHub Search API',
        }
      : error<number>(searchFailureNote),
    issues: issueStats
      ? {
          status: 'complete',
          value: issueStats.total,
          note: `创建 ${issueStats.total} / 已关闭 ${issueStats.closed} / 当前开放 ${issueStats.open}（author 口径）`,
          source: 'GitHub Search API',
        }
      : error<number>(searchFailureNote),
    reviews: reviewedCount === null
      ? error<number>(searchFailureNote)
      : {
          status: 'partial',
          value: reviewedCount,
          note: '按 reviewed-by 近似统计参与评审的 PR 数，不等于 Review 次数',
          source: 'GitHub Search API',
        },
  }

  /* ---------- 8. 仓库排行 ---------- */
  const ranking = rankRepositories(nonForkRepos, yearlyCommitsMap, 5)

  /* ---------- 9. 活跃度面板 ---------- */
  const activity: ActivityPanelData = {
    longestStreak: streak
      ? complete(streak, useGraphql ? '来自贡献日历（含提交/PR/Issue/Review 贡献）' : '来自提交记录近似')
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
      note: useGraphql ? '至少存在一项贡献的日期数' : '有提交记录的日期数（近似）',
    },
    activeRepos: {
      status: activeRepoNames.size > 0 || nonForkRepos.length === 0 ? 'complete' : 'partial',
      value: activeRepoNames.size,
      note: useGraphql
        ? '年度内有可归因提交的仓库数（含参与协作的他人仓库）'
        : `降级口径：最近 ${queryRepos.length} 个仓库中有年度提交的仓库数`,
    },
    activeRepoRatio: {
      status: nonForkRepos.length > 0 ? 'complete' : 'empty',
      value: nonForkRepos.length > 0 ? (ownActiveRepos / nonForkRepos.length) * 100 : null,
      note: `分子为本人公开仓库中年度有提交的（${ownActiveRepos}），分母为当前可访问的公开仓库数（${nonForkRepos.length}）`,
    },
    avgMonthlyCommits: {
      status: completedMonths.length > 0 ? 'complete' : 'empty',
      value: avgMonthlyCommits,
      note: `口径：年度提交数 ÷ 已完成月份数（${completedMonths.length}）`,
    },
    prMerged: prStats
      ? { status: 'complete', value: prStats.merged }
      : error<number>(searchFailureNote),
    avgPrMergeDays: !prStats
      ? error<number>(searchFailureNote)
      : !mergeDuration || mergeDuration.avgDays === null
        ? prStats.merged === 0
          ? empty<number>('年度内无已合并 PR')
          : unsupported<number>('已合并 PR 明细获取失败，暂无法计算')
        : {
            status: mergeDuration.total > mergeDuration.sampled ? 'partial' : 'complete',
            value: mergeDuration.avgDays,
            note:
              mergeDuration.total > mergeDuration.sampled
                ? `口径：创建 → 合并时间差均值（抽样最近 ${mergeDuration.sampled} 条 / 共 ${mergeDuration.total} 条）`
                : `口径：${mergeDuration.sampled} 个已合并 PR 的创建 → 合并时间差均值`,
          },
    issueCloseRate: !issueStats
      ? error<number>(searchFailureNote)
      : issueStats.total > 0
        ? {
            status: 'complete',
            value: (issueStats.closed / issueStats.total) * 100,
            note: `范围：年度创建的 ${issueStats.total} 个 Issue 中当前已关闭的比例`,
          }
        : empty<number>('年度内未创建 Issue'),
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
    yearlyPRs: prStats
      ? { status: 'complete', value: prStats.total }
      : error<number>(searchFailureNote),
    yearlyIssues: issueStats
      ? { status: 'complete', value: issueStats.total }
      : error<number>(searchFailureNote),
    yearlyReviews: reviewedCount === null
      ? error<number>(searchFailureNote)
      : { status: 'partial', value: reviewedCount, note: 'reviewed-by 近似口径' },
    comments: commenterCount === null
      ? error<number>(searchFailureNote)
      : {
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
    dataMode: useGraphql ? 'graphql' : 'rest',
    includesPrivate: includePrivate && repos.some((repo) => repo.isPrivate),
    graphqlError,
    lastYear,
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

  onStage?.('done')
  return report
}
