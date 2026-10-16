import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import ReportPage from '../../src/pages/ReportPage'
import type { YearlyReport } from '../../src/types/report'
import { complete } from '../../src/types/data-status'

// Mock 报告服务，避免真实网络请求
vi.mock('../../src/services/report-service', () => ({
  loadYearlyReport: vi.fn(),
}))

vi.mock('../../src/api/github-graphql', () => ({
  hasGithubToken: () => false,
}))

// ECharts 在 jsdom 中需要 mock（无 canvas 渲染环境）
vi.mock('echarts/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('echarts/core')>()
  return {
    ...actual,
    init: () => ({
      setOption: vi.fn(),
      resize: vi.fn(),
      dispose: vi.fn(),
    }),
  }
})

const { loadYearlyReport } = await import('../../src/services/report-service')

function makeReport(): YearlyReport {
  return {
    header: {
      username: 'octocat',
      displayName: 'Octo Cat',
      avatarUrl: 'https://example.com/a.png',
      year: 2026,
      startDate: '2026-01-01',
      endDate: '2026-10-16',
      generatedAt: '2026-10-16T00:00:00.000Z',
    },
    user: {
      login: 'octocat',
      displayName: 'Octo Cat',
      avatarUrl: 'https://example.com/a.png',
      bio: null,
      htmlUrl: 'https://github.com/octocat',
      company: null,
      location: null,
      publicRepos: 8,
      followers: 1,
      following: 0,
      createdAt: '2011-01-25T18:44:36Z',
    },
    metrics: {
      totalCommits: complete(120),
      newRepositories: complete(3),
      stars: complete(50),
      starsIsYearly: false,
      forks: complete(10),
      forksIsYearly: false,
      contributionDays: complete(30),
      pullRequests: complete(6),
      issues: complete(3),
      reviews: complete(2),
    },
    heatmap: { days: [], totalContributions: 0 },
    topRepositories: {
      items: [],
      sortNote: '测试数据',
      sortedByCommits: true,
    },
    languages: { stats: [], repoCount: 0, totalBytes: 0, isComplete: true },
    monthlyTrend: [],
    activity: {
      longestStreak: complete({ days: 5, start: '2026-07-01', end: '2026-07-05' }),
      firstContribution: complete('2026-01-03'),
      lastContribution: complete('2026-10-01'),
      activeDays: complete(30),
      activeRepos: complete(3),
      activeRepoRatio: complete(37.5),
      avgMonthlyCommits: complete(12.0),
      prMerged: complete(4),
      avgPrMergeDays: { status: 'unsupported', value: null },
      issueCloseRate: complete(66.7),
    },
    extra: {
      currentPublicRepos: 8,
      currentTotalForks: complete(10),
      currentTotalStars: complete(50),
      yearlyNewRepos: complete(3),
      gists: complete(1),
      yearlyPRs: complete(6),
      yearlyIssues: complete(3),
      yearlyReviews: complete(2),
      comments: complete(5),
      primaryLanguage: complete('TypeScript'),
      lastConfirmedContribution: complete('2026-10-01'),
    },
  }
}

function renderReport(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/report" element={<ReportPage />} />
        <Route path="/report/:username" element={<ReportPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ReportPage 报告页', () => {
  it('加载中显示进度提示', () => {
    vi.mocked(loadYearlyReport).mockReturnValue(new Promise(() => undefined))
    renderReport('/report/octocat?year=2026')
    expect(
      screen.getByText((content) => content.includes('正在获取')),
    ).toBeInTheDocument()
  })

  it('加载成功后展示报告标题与指标卡', async () => {
    vi.mocked(loadYearlyReport).mockResolvedValue(makeReport())
    renderReport('/report/octocat?year=2026')

    await waitFor(() => {
      expect(screen.getByText('GitHub 2026 年度开发者贡献报告')).toBeInTheDocument()
    })
    // 核心指标卡
    expect(screen.getByText('总提交次数')).toBeInTheDocument()
    expect(screen.getByText('年度仓库数')).toBeInTheDocument()
    expect(screen.getByText('贡献天数')).toBeInTheDocument()
    // 数据模式提示（匿名）
    expect(screen.getByText(/匿名数据模式/)).toBeInTheDocument()
  })

  it('加载失败显示错误与重试按钮', async () => {
    vi.mocked(loadYearlyReport).mockRejectedValue(
      new Error('未找到该 GitHub 用户名或资源'),
    )
    renderReport('/report/nobody?year=2026')

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('未找到该 GitHub 用户名或资源')
    })
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '返回首页' })).toBeInTheDocument()
  })

  it('缺少用户名时提示返回首页', () => {
    renderReport('/report/')
    expect(screen.getByText('缺少 GitHub 用户名')).toBeInTheDocument()
  })

  it('URL 年份参数非法时回退当前年份', async () => {
    vi.mocked(loadYearlyReport).mockResolvedValue(makeReport())
    renderReport('/report/octocat?year=9999')
    await waitFor(() => {
      expect(screen.getByText('GitHub 2026 年度开发者贡献报告')).toBeInTheDocument()
    })
  })

  it('复制分享链接按钮存在', async () => {
    vi.mocked(loadYearlyReport).mockResolvedValue(makeReport())
    renderReport('/report/octocat?year=2026')
    await waitFor(() => {
      expect(screen.getByText('GitHub 2026 年度开发者贡献报告')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: '复制分享链接' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '导出 PNG' })).toBeInTheDocument()
  })
})
