/**
 * 年度报告统一数据模型
 * report-service 负责将 API 数据组装为 YearlyReport，
 * 各 UI 组件只消费该模型，保证统计口径一致。
 */
import type { DataState } from './data-status'
import type { GithubContributionDay } from './github'

/** 报告头部 */
export interface ReportHeader {
  username: string
  /** 显示名称（无则回退 login） */
  displayName: string
  avatarUrl: string
  /** 统计年份 */
  year: number
  /** 统计开始日期 YYYY-MM-DD */
  startDate: string
  /** 统计截止日期 YYYY-MM-DD（当前年份 = 当日） */
  endDate: string
  /** 报告生成/最后更新时间 ISO */
  generatedAt: string
}

/** 用户资料区（当前状态，区别于年度增量） */
export interface UserProfileData {
  login: string
  displayName: string | null
  avatarUrl: string
  bio: string | null
  htmlUrl: string
  company: string | null
  location: string | null
  /** 当前公开仓库总数 */
  publicRepos: number
  /** 当前 Followers */
  followers: number
  /** 当前 Following */
  following: number
  /** 账号创建时间 ISO */
  createdAt: string
}

/** 核心指标卡片（8 项，每项带数据状态与口径说明） */
export interface MetricCards {
  totalCommits: DataState<number>
  newRepositories: DataState<number>
  stars: DataState<number>
  /** star 指标是否为年度增量（false 表示降级为当前总数） */
  starsIsYearly: boolean
  forks: DataState<number>
  /** fork 指标是否为年度增量（false 表示降级为当前总数） */
  forksIsYearly: boolean
  contributionDays: DataState<number>
  pullRequests: DataState<number>
  issues: DataState<number>
  reviews: DataState<number>
}

/** 热力图每日数据（已归一化） */
export interface HeatmapDay extends GithubContributionDay {
  /** 全年累计天数序号（1 起） */
  dayOfYear: number
  /** 所属月份 1-12 */
  month: number
}

/** 热门仓库排行项 */
export interface RepositoryRankItem {
  rank: number
  name: string
  fullName: string
  description: string | null
  language: string | null
  stars: number
  forks: number
  /** 年度提交数（可可靠获取时） */
  yearlyCommits: number | null
  createdAt: string
  htmlUrl: string
}

/** 编程语言分布项 */
export interface LanguageStat {
  language: string
  bytes: number
  percentage: number
}

/** 月度提交趋势项 */
export interface MonthlyTrendItem {
  month: number // 1-12
  monthLabel: string // "1月"
  commits: number | null // null = 未来月份未统计
  /** 是否已完成统计的月份 */
  isComplete: boolean
}

/** 活跃度面板 */
export interface ActivityPanelData {
  longestStreak: DataState<{ days: number; start: string; end: string }>
  firstContribution: DataState<string>
  lastContribution: DataState<string>
  activeDays: DataState<number>
  activeRepos: DataState<number>
  /** 活跃仓库占比（分母 = 当前可访问公开仓库数） */
  activeRepoRatio: DataState<number>
  avgMonthlyCommits: DataState<number>
  prMerged: DataState<number>
  /** 平均 PR 合并时间（天，仅统计有创建+合并时间的已合并 PR） */
  avgPrMergeDays: DataState<number>
  issueCloseRate: DataState<number>
}

/** 其他统计面板（区分年度与当前状态） */
export interface ExtraStats {
  currentPublicRepos: number
  currentTotalForks: DataState<number>
  currentTotalStars: DataState<number>
  yearlyNewRepos: DataState<number>
  gists: DataState<number>
  yearlyPRs: DataState<number>
  yearlyIssues: DataState<number>
  yearlyReviews: DataState<number>
  comments: DataState<number>
  primaryLanguage: DataState<string>
  lastConfirmedContribution: DataState<string>
}

/** 上一年度同口径数据（用于指标卡同比；无法可靠获取的字段缺省，不展示估算值） */
export interface LastYearSnapshot {
  totalCommits?: number
  contributionDays?: number
  pullRequests?: number
  issues?: number
  reviews?: number
  newRepositories?: number
}

/** 报告加载阶段（用于加载动画，按实际请求顺序推进） */
export type ReportStage =
  | 'profile'
  | 'repos'
  | 'contributions'
  | 'languages'
  | 'search'
  | 'done'

/** 完整年度报告 */
export interface YearlyReport {
  header: ReportHeader
  user: UserProfileData
  metrics: MetricCards
  /** 贡献日历数据模式：graphql = 完整贡献口径；rest = 提交近似降级 */
  dataMode: 'graphql' | 'rest'
  /** 是否包含登录用户本人的私有仓库数据（仅本人 + repo scope 时为 true） */
  includesPrivate: boolean
  /** 已配置 Token 但 GraphQL 贡献日历获取失败时的原因（用于提示用户排查） */
  graphqlError?: string
  /** 上一年度同口径数据（同比展示用，缺省字段表示不可获取） */
  lastYear?: LastYearSnapshot
  heatmap: {
    days: HeatmapDay[]
    totalContributions: number
  }
  topRepositories: {
    items: RepositoryRankItem[]
    /** 排序口径说明 */
    sortNote: string
    /** 是否按年度提交数排序 */
    sortedByCommits: boolean
  }
  languages: {
    stats: LanguageStat[]
    repoCount: number
    totalBytes: number
    /** 是否为完整语言统计（false = 部分） */
    isComplete: boolean
  }
  monthlyTrend: MonthlyTrendItem[]
  activity: ActivityPanelData
  extra: ExtraStats
}
