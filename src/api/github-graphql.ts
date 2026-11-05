/**
 * GitHub GraphQL API 封装
 * 用于获取贡献日历与贡献分类统计。
 *
 * ⚠️ 注意：GitHub GraphQL API 必须携带认证 Token。
 * - 有 Token：返回完整贡献日历与分类贡献。
 * - 无 Token：抛出 forbidden 错误，由 report-service 捕获并降级
 *   （匿名模式改用 REST commits 近似统计）。
 */
import { getGithubToken } from './http'
import { GithubApiError } from './github-errors'
import { cacheGet, cacheSet, CACHE_TTL } from '../utils/cache'
import type {
  GithubContributionDay,
  GithubContributionsCollection,
} from '../types/github'

const GRAPHQL_URL = 'https://api.github.com/graphql'

const CALENDAR_QUERY = `
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalPullRequestReviewContributions
      totalRepositoryContributions
      contributionCalendar {
        totalContributions
        weeks {
          firstDay
          contributionDays {
            date
            contributionCount
            contributionLevel
          }
        }
      }
      commitContributionsByRepository(maxRepositories: 100) {
        repository {
          name
          owner {
            login
          }
        }
        contributions {
          totalCount
        }
      }
    }
  }
}
`


/** GraphQL 响应结构 */
interface GraphQlResponse<T> {
  data?: T
  errors?: Array<{ message: string; type?: string }>
}

/**
 * 获取用户贡献集合（含贡献日历与年度分类总计）。
 * 无 Token 时抛出 forbidden 错误。
 */
export async function getContributionsCollection(
  username: string,
  from: string, // YYYY-MM-DD
  to: string, // YYYY-MM-DD
): Promise<GithubContributionsCollection> {
  const key = `calendar:${username}:${from}:${to}`
  const cached = cacheGet<GithubContributionsCollection>(key)
  if (cached) return cached

  const token = getGithubToken()
  if (!token) {
    throw new GithubApiError(
      'forbidden',
      '贡献日历需要 GitHub 登录：GraphQL API 必须携带授权令牌。请点击右上角「使用 GitHub 登录」后重试。',
      null,
      GRAPHQL_URL,
    )
  }

  const resp = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: CALENDAR_QUERY,
      // GitHub GraphQL 的 from/to 类型为 DateTime!，必须传完整 ISO 8601 时间戳；
      // 传 "YYYY-MM-DD" 会报 "Variable $from of type DateTime! was provided invalid value"。
      variables: {
        login: username,
        from: `${from}T00:00:00Z`,
        to: `${to}T23:59:59Z`,
      },
    }),
    signal: AbortSignal.timeout(30_000),
  })

  const body = (await resp.json().catch(() => null)) as GraphQlResponse<{
    user: { contributionsCollection: unknown } | null
  }> | null

  if (!resp.ok) {
    if (resp.status === 401 || resp.status === 403) {
      throw new GithubApiError(
        'forbidden',
        'GitHub 授权无效或已过期，请退出后重新登录',
        resp.status,
        GRAPHQL_URL,
      )
    }
    throw new GithubApiError(
      'server',
      `GraphQL 请求失败（${resp.status}）`,
      resp.status,
      GRAPHQL_URL,
    )
  }

  if (!body || !body.data?.user) {
    const msg = body?.errors?.[0]?.message
    throw new GithubApiError(
      msg?.includes('rate limit')
        ? 'rate_limited'
        : msg?.includes('Could not resolve')
          ? 'not_found'
          : 'unknown',
      msg ?? '贡献日历数据不可用',
      resp.status,
      GRAPHQL_URL,
    )
  }

  const collection = mapCollection(
    body.data.user.contributionsCollection as Record<string, unknown>,
  )
  cacheSet(key, collection, CACHE_TTL.CALENDAR)
  return collection
}

/** 将 GraphQL 原始贡献集合映射为业务类型 */
function mapCollection(
  raw: Record<string, unknown>,
): GithubContributionsCollection {
  const calendar =
    (raw.contributionCalendar as Record<string, unknown>) ?? {}
  const weeks = (calendar.weeks as Array<Record<string, unknown>>) ?? []
  const byRepo =
    (raw.commitContributionsByRepository as Array<Record<string, unknown>>) ?? []

  return {
    totalCommitContributions: Number(raw.totalCommitContributions ?? 0),
    totalPullRequestContributions: Number(
      raw.totalPullRequestContributions ?? 0,
    ),
    totalIssueContributions: Number(raw.totalIssueContributions ?? 0),
    totalPullRequestReviewContributions: Number(
      raw.totalPullRequestReviewContributions ?? 0,
    ),
    totalRepositoryContributions: Number(
      raw.totalRepositoryContributions ?? 0,
    ),
    commitsByRepo: byRepo
      .map((entry) => {
        const repo = (entry.repository as Record<string, unknown>) ?? {}
        const owner = (repo.owner as Record<string, unknown>) ?? {}
        const contributions = (entry.contributions as Record<string, unknown>) ?? {}
        return {
          fullName: `${String(owner.login ?? '')}/${String(repo.name ?? '')}`,
          count: Number(contributions.totalCount ?? 0),
        }
      })
      .filter((r) => !r.fullName.startsWith('/') && r.count > 0),
    contributionCalendar: {
      totalContributions: Number(calendar.totalContributions ?? 0),
      weeks: weeks.map((week) => ({
        firstDay: String(week.firstDay ?? ''),
        contributionDays: ((week.contributionDays as Array<Record<string, unknown>>) ?? []).map(
          (day): GithubContributionDay => ({
            date: String(day.date ?? ''),
            contributionCount: Number(day.contributionCount ?? 0),
            contributionLevel: (day.contributionLevel as GithubContributionDay['contributionLevel']) ?? 'NONE',
          }),
        ),
      })),
    },
  }
}
