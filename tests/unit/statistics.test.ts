import { describe, expect, it } from 'vitest'
import type { GithubContributionDay } from '../../src/types/github'
import {
  aggregateLanguages,
  buildHeatmapDays,
  consistencyCheck,
  currentRepoForks,
  currentRepoStars,
  monthlyTrend,
  rankRepositories,
  reposCreatedInYear,
} from '../../src/services/statistics-service'
import type { GithubRepository } from '../../src/types/github'

function day(date: string, count: number): GithubContributionDay {
  return {
    date,
    contributionCount: count,
    contributionLevel: count === 0 ? 'NONE' : 'FOURTH_QUARTILE',
  }
}

describe('每日贡献汇总与一致性校验', () => {
  it('buildHeatmapDays 过滤年度范围并归一化', () => {
    const days = [
      day('2026-01-01', 2),
      day('2026-06-15', 5),
      day('2025-12-31', 99), // 范围外
      day('2027-01-01', 99), // 范围外
    ]
    const result = buildHeatmapDays(days, '2026-01-01', '2026-12-31')
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ date: '2026-01-01', month: 1, dayOfYear: 1 })
    expect(result[1]).toMatchObject({ date: '2026-06-15', month: 6, dayOfYear: 166 })
  })

  it('一致性校验：总数与每日汇总一致时通过', () => {
    const days = [day('2026-01-01', 3), day('2026-01-02', 4)]
    const check = consistencyCheck(7, days)
    expect(check.ok).toBe(true)
  })

  it('一致性校验：不一致时报告差异', () => {
    const days = [day('2026-01-01', 3)]
    const check = consistencyCheck(10, days)
    expect(check.ok).toBe(false)
    expect(check.detail).toContain('差异 7')
  })
})

describe('月度提交汇总', () => {
  it('返回 12 个月，已完成月份有值', () => {
    const days = buildHeatmapDays(
      [
        day('2026-01-05', 2),
        day('2026-01-20', 3),
        day('2026-03-01', 1),
      ],
      '2026-01-01',
      '2026-10-16',
    )
    const trend = monthlyTrend(days, '2026-10-16')
    expect(trend).toHaveLength(12)
    expect(trend[0]).toEqual({ month: 1, monthLabel: '1月', commits: 5, isComplete: true })
    expect(trend[2]).toEqual({ month: 3, monthLabel: '3月', commits: 1, isComplete: true })
  })

  it('未来月份显示 null（未统计），不填充虚构零值', () => {
    const trend = monthlyTrend([], '2026-10-16')
    expect(trend[9].commits).toBe(0) // 10月：当前月，已完成但无数据
    expect(trend[9].isComplete).toBe(true)
    expect(trend[10].commits).toBeNull() // 11月
    expect(trend[10].isComplete).toBe(false)
    expect(trend[11].commits).toBeNull() // 12月
  })

  it('过去年份全部月份均已完成', () => {
    const trend = monthlyTrend([], '2025-12-31')
    expect(trend.every((t) => t.isComplete)).toBe(true)
    expect(trend.every((t) => t.commits === 0)).toBe(true)
  })
})

describe('语言字节汇总', () => {
  it('按字节降序汇总并计算占比', () => {
    const result = aggregateLanguages([
      { repo: 'a', languages: { Java: 600, TypeScript: 300 } },
      { repo: 'b', languages: { Java: 100, Python: 500 } },
    ])
    expect(result.totalBytes).toBe(1500)
    expect(result.repoCount).toBe(2)
    expect(result.stats[0]).toMatchObject({ language: 'Java', bytes: 700, percentage: 700 / 1500 * 100 })
    expect(result.stats[1]).toMatchObject({ language: 'Python', bytes: 500 })
    expect(result.stats[2]).toMatchObject({ language: 'TypeScript', bytes: 300 })
  })

  it('空输入返回空统计', () => {
    const result = aggregateLanguages([])
    expect(result.stats).toHaveLength(0)
    expect(result.totalBytes).toBe(0)
  })
})

function repo(
  name: string,
  overrides: Partial<GithubRepository> = {},
): GithubRepository {
  return {
    id: 1,
    name,
    fullName: `user/${name}`,
    description: null,
    htmlUrl: `https://github.com/user/${name}`,
    language: null,
    stargazersCount: 0,
    forksCount: 0,
    fork: false,
    createdAt: '2026-01-01T00:00:00Z',
    pushedAt: null,
    size: 0,
    ...overrides,
  }
}

describe('仓库排行榜', () => {
  it('有可靠提交数时按提交数降序', () => {
    const repos = [
      repo('a', { stargazersCount: 100 }),
      repo('b', { stargazersCount: 50 }),
    ]
    const commits = new Map([
      ['user/a', 10],
      ['user/b', 30],
    ])
    const r = rankRepositories(repos, commits, 5)
    expect(r.sortedByCommits).toBe(true)
    expect(r.items[0].name).toBe('b')
    expect(r.items[0].yearlyCommits).toBe(30)
    expect(r.items[1].name).toBe('a')
  })

  it('无可靠提交数时按 Star 排序并标注口径', () => {
    const repos = [
      repo('a', { stargazersCount: 100 }),
      repo('b', { stargazersCount: 200 }),
    ]
    const r = rankRepositories(repos, new Map(), 5)
    expect(r.sortedByCommits).toBe(false)
    expect(r.items[0].name).toBe('b')
    expect(r.items[0].yearlyCommits).toBeNull()
    expect(r.sortNote).toContain('Star')
  })

  it('排除 fork 仓库并限制数量', () => {
    const repos = [
      repo('a'),
      repo('forked', { fork: true, stargazersCount: 999 }),
      repo('b'),
    ]
    const r = rankRepositories(repos, new Map(), 1)
    expect(r.items).toHaveLength(1)
    expect(r.items[0].name).not.toBe('forked')
  })
})

describe('仓库年度与当前统计', () => {
  it('reposCreatedInYear 按 created_at 过滤年度', () => {
    const repos = [
      repo('old', { createdAt: '2025-06-01T00:00:00Z' }),
      repo('new1', { createdAt: '2026-03-01T00:00:00Z' }),
      repo('new2', { createdAt: '2026-12-31T00:00:00Z' }),
      repo('forked-new', { createdAt: '2026-05-01T00:00:00Z', fork: true }),
    ]
    const created = reposCreatedInYear(repos, '2026-01-01', '2026-12-31')
    expect(created.map((r) => r.name)).toEqual(['new1', 'new2'])
  })

  it('currentRepoStars / Forks 排除 fork', () => {
    const repos = [
      repo('a', { stargazersCount: 10, forksCount: 2 }),
      repo('forked', { stargazersCount: 999, forksCount: 999, fork: true }),
      repo('b', { stargazersCount: 5, forksCount: 1 }),
    ]
    expect(currentRepoStars(repos)).toBe(15)
    expect(currentRepoForks(repos)).toBe(3)
  })
})
