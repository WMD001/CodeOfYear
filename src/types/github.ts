/**
 * GitHub 公开数据模型（源自 GitHub REST / GraphQL API）
 * 与 UI 组件解耦，API 层负责将原始响应映射为这些类型。
 */

/** 用户公开资料（GET /users/{username}） */
export interface GithubUserProfile {
  login: string
  id: number
  avatarUrl: string
  htmlUrl: string
  name: string | null
  company: string | null
  blog: string | null
  location: string | null
  bio: string | null
  publicRepos: number
  followers: number
  following: number
  createdAt: string // ISO 时间
}

/** 公开仓库（GET /users/{username}/repos） */
export interface GithubRepository {
  id: number
  name: string
  fullName: string
  description: string | null
  htmlUrl: string
  language: string | null
  stargazersCount: number
  forksCount: number
  fork: boolean
  createdAt: string // ISO 时间
  pushedAt: string | null
  size: number
}

/** 仓库语言（GET /repos/{owner}/{repo}/languages） */
export type GithubLanguages = Record<string, number>

/** 单日贡献（GraphQL contributionCalendar.contributionDays） */
export interface GithubContributionDay {
  date: string // YYYY-MM-DD
  contributionCount: number
  contributionLevel:
    | 'NONE'
    | 'FIRST_QUARTILE'
    | 'SECOND_QUARTILE'
    | 'THIRD_QUARTILE'
    | 'FOURTH_QUARTILE'
  // 分类贡献（GraphQL 提供时使用）
  commitCount?: number
  pullRequestCount?: number
  issueCount?: number
  reviewCount?: number
}

/** 贡献周（contributionCalendar.weeks） */
export interface GithubContributionWeek {
  contributionDays: GithubContributionDay[]
  firstDay: string
}

/** 贡献日历（contributionCalendar） */
export interface GithubContributionCalendar {
  totalContributions: number
  weeks: GithubContributionWeek[]
}

/** 仓库级年度提交（contributionsCollection.commitContributionsByRepository） */
export interface GithubRepoCommitContributions {
  /** 仓库全名 owner/name */
  fullName: string
  /** 年度内可归因的提交数（精确口径） */
  count: number
}

/** 贡献集合（contributionsCollection） */
export interface GithubContributionsCollection {
  totalCommitContributions: number
  totalPullRequestContributions: number
  totalIssueContributions: number
  totalPullRequestReviewContributions: number
  totalRepositoryContributions: number
  contributionCalendar: GithubContributionCalendar
  /** 各仓库年度提交数（commitContributionsByRepository，最多 100 个仓库） */
  commitsByRepo: GithubRepoCommitContributions[]
  // 其他可选统计
  totalPullRequestsOpened?: number
  totalPullRequestsMerged?: number
  totalIssuesOpened?: number
  totalIssuesClosed?: number
}

/** 分页响应包裹（REST API 分页） */
export interface GithubPage<T> {
  items: T[]
  /** 是否还有下一页 */
  hasNext: boolean
  /** 下一页页码，无则 null */
  nextPage: number | null
}

/** 提交记录（GET /repos/{owner}/{repo}/commits 的简化映射） */
export interface GithubCommit {
  sha: string
  authorLogin: string | null
  authorName: string | null
  date: string // 提交时间 ISO
  message: string
}

/** PR 记录（GET /repos/{owner}/{repo}/pulls 简化映射） */
export interface GithubPullRequest {
  id: number
  number: number
  title: string
  state: 'open' | 'closed'
  createdAt: string
  closedAt: string | null
  mergedAt: string | null
  userLogin: string
  isMerged: boolean
}

/** Issue 记录（GET /repos/{owner}/{repo}/issues 简化映射，需排除 PR） */
export interface GithubIssue {
  id: number
  number: number
  title: string
  state: 'open' | 'closed'
  createdAt: string
  closedAt: string | null
  userLogin: string
}

/** Gist（GET /users/{username}/gists） */
export interface GithubGist {
  id: string
  description: string | null
  htmlUrl: string
  createdAt: string
  updatedAt: string
}
