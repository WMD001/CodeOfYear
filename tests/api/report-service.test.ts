import { describe, expect, it, vi } from 'vitest'
import { loadYearlyReport } from '../../src/services/report-service'
import type { GithubRepository } from '../../src/types/github'

// Mock API 层，避免真实网络请求
vi.mock('../../src/api/github-graphql', () => ({
  hasGithubToken: vi.fn(() => false),
  getContributionsCollection: vi.fn(async () => {
    throw new Error('需要 Token')
  }),
}))

vi.mock('../../src/api/github-rest', () => ({
  getUserProfile: vi.fn(async (username: string) => ({
    login: username,
    id: 1,
    avatarUrl: `https://avatar/${username}`,
    htmlUrl: `https://github.com/${username}`,
    name: 'Octo Cat',
    company: null,
    blog: null,
    location: null,
    bio: 'Hello',
    publicRepos: 3,
    followers: 10,
    following: 5,
    createdAt: '2011-01-25T18:44:36Z',
  })),
  getUserRepositories: vi.fn(async (): Promise<GithubRepository[]> => {
    const mk = (name: string, created: string, extra: Partial<GithubRepository> = {}): GithubRepository => ({
      id: 1,
      name,
      fullName: `octocat/${name}`,
      description: null,
      htmlUrl: `https://github.com/octocat/${name}`,
      language: 'TypeScript',
      stargazersCount: 5,
      forksCount: 1,
      fork: false,
      createdAt: created,
      pushedAt: '2026-10-01T00:00:00Z',
      size: 10,
      ...extra,
    })
    return [
      mk('app', '2026-03-01T00:00:00Z'),
      mk('lib', '2025-06-01T00:00:00Z'),
      mk('legacy', '2020-01-01T00:00:00Z', { fork: true }),
    ]
  }),
  getRepositoryCommits: vi.fn(async (_owner: string, repo: string) => {
    // 模拟归因提交：app 仓库 3 条，lib 仓库 1 条
    const dates = repo === 'app'
      ? ['2026-01-05T10:00:00Z', '2026-01-05T11:00:00Z', '2026-03-02T10:00:00Z']
      : ['2026-06-15T10:00:00Z']
    return dates.map((date, i) => ({
      sha: `${repo}-${i}`,
      authorLogin: 'octocat',
      authorName: 'Octo',
      date,
      message: 'fix',
    }))
  }),
  getRepositoryLanguages: vi.fn(async (_owner: string, repo: string) =>
    repo === 'app' ? { TypeScript: 800, Java: 200 } : { TypeScript: 500 },
  ),
  searchPullRequestStats: vi.fn(async () => ({ total: 6, merged: 4, open: 1, closedUnmerged: 1 })),
  searchIssueStats: vi.fn(async () => ({ total: 3, open: 1, closed: 2 })),
  searchReviewedPrCount: vi.fn(async () => 2),
  searchCommenterCount: vi.fn(async () => 5),
  getGists: vi.fn(async () => [{ id: '1', description: null, htmlUrl: '', createdAt: '', updatedAt: '' }]),
}))

describe('report-service 报告组装', () => {
  it('匿名模式生成完整报告，指标带状态与口径', async () => {
    const report = await loadYearlyReport('octocat', 2026)

    expect(report.header.username).toBe('octocat')
    expect(report.header.year).toBe(2026)
    expect(report.header.startDate).toBe('2026-01-01')
    // 当前年份截止今日（2026-10-16）
    expect(report.header.endDate).toBe('2026-10-16')

    // 用户资料
    expect(report.user.publicRepos).toBe(3)

    // 指标：提交数来自归因提交（app 3 + lib 1 = 4）
    expect(report.metrics.totalCommits.value).toBe(4)
    expect(report.metrics.totalCommits.status).toBe('partial')
    expect(report.metrics.totalCommits.note).toContain('降级')

    // Star/Fork 降级为当前总数口径
    expect(report.metrics.starsIsYearly).toBe(false)
    expect(report.metrics.stars.value).toBe(10) // app 5 + lib 5（fork 排除）

    // 年度新建仓库：仅 app（2026-03-01）
    expect(report.metrics.newRepositories.value).toBe(1)

    // PR/Issue 来自 search
    expect(report.metrics.pullRequests.value).toBe(6)
    expect(report.metrics.pullRequests.note).toContain('合并 4')
    expect(report.metrics.issues.value).toBe(3)

    // 贡献天数：提交日期去重 = 2026-01-05, 2026-03-02, 2026-06-15 → 3 天
    expect(report.metrics.contributionDays.value).toBe(3)

    // 热力图与趋势
    expect(report.heatmap.days).toHaveLength(3)
    const jan = report.monthlyTrend[0]
    expect(jan.commits).toBe(2) // 1月：01-05 两条
    const nov = report.monthlyTrend[10]
    expect(nov.commits).toBeNull() // 11月未来未统计
    expect(nov.isComplete).toBe(false)

    // 仓库排行：按年度提交数（app 3 > lib 1）
    expect(report.topRepositories.sortedByCommits).toBe(true)
    expect(report.topRepositories.items[0].name).toBe('app')
    expect(report.topRepositories.items[0].yearlyCommits).toBe(3)

    // 语言统计
    const ts = report.languages.stats.find((s) => s.language === 'TypeScript')
    expect(ts?.bytes).toBe(1300)
    expect(report.languages.repoCount).toBe(2)

    // 活跃度
    expect(report.activity.longestStreak.value).toEqual({ days: 1, start: '2026-01-05', end: '2026-01-05' })
    expect(report.activity.prMerged.value).toBe(4)
    expect(report.activity.issueCloseRate.value).toBeCloseTo(66.67, 1)

    // 其他统计
    expect(report.extra.currentPublicRepos).toBe(2)
    expect(report.extra.gists.value).toBe(1)
  })

  it('不存在用户时抛出 not_found 错误', async () => {
    const { getUserProfile } = await import('../../src/api/github-rest')
    vi.mocked(getUserProfile).mockRejectedValueOnce(
      Object.assign(new Error('not found'), { kind: 'not_found' }),
    )
    await expect(loadYearlyReport('nobody-404', 2026)).rejects.toMatchObject({
      kind: 'not_found',
    })
  })

  it('无效年份抛出 validation 错误', async () => {
    await expect(loadYearlyReport('octocat', 1990)).rejects.toMatchObject({
      kind: 'validation',
    })
  })
})
