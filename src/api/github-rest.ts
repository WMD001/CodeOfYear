/**
 * GitHub REST API 封装
 * 各函数返回映射后的业务类型，错误统一为 GithubApiError。
 * 用户资料与仓库列表为高频基础数据，其余接口按统计需要按需调用。
 */
import { githubPaginate, githubRequest } from './http'
import { cacheGet, cacheSet, CACHE_TTL } from '../utils/cache'
import type {
  GithubCommit,
  GithubGist,
  GithubIssue,
  GithubLanguages,
  GithubPullRequest,
  GithubRepository,
  GithubUserProfile,
} from '../types/github'

/** 字段映射辅助 */
const mapUser = (raw: Record<string, unknown>): GithubUserProfile => ({
  login: String(raw.login),
  id: Number(raw.id),
  avatarUrl: String(raw.avatar_url ?? ''),
  htmlUrl: String(raw.html_url ?? ''),
  name: (raw.name as string | null) ?? null,
  company: (raw.company as string | null) ?? null,
  blog: (raw.blog as string | null) ?? null,
  location: (raw.location as string | null) ?? null,
  bio: (raw.bio as string | null) ?? null,
  publicRepos: Number(raw.public_repos ?? 0),
  followers: Number(raw.followers ?? 0),
  following: Number(raw.following ?? 0),
  createdAt: String(raw.created_at ?? ''),
})

const mapRepo = (raw: Record<string, unknown>): GithubRepository => ({
  id: Number(raw.id),
  name: String(raw.name),
  fullName: String(raw.full_name),
  description: (raw.description as string | null) ?? null,
  htmlUrl: String(raw.html_url ?? ''),
  language: (raw.language as string | null) ?? null,
  stargazersCount: Number(raw.stargazers_count ?? 0),
  forksCount: Number(raw.forks_count ?? 0),
  fork: Boolean(raw.fork),
  isPrivate: Boolean(raw.private),
  createdAt: String(raw.created_at ?? ''),
  pushedAt: (raw.pushed_at as string | null) ?? null,
  size: Number(raw.size ?? 0),
})

const mapCommit = (raw: Record<string, unknown>): GithubCommit => {
  const commit = (raw.commit as Record<string, unknown>) ?? {}
  const author = (commit.author as Record<string, unknown>) ?? {}
  const committer = (raw.author as Record<string, unknown>) ?? null
  const commitCommitter = (commit.committer as Record<string, unknown>) ?? null
  return {
    sha: String(raw.sha ?? ''),
    authorLogin: (committer?.login as string | null) ?? null,
    authorName: (author.name as string | null) ?? null,
    date: String(author.date ?? (commitCommitter?.date as string | null) ?? ''),
    message: String(commit.message ?? ''),
  }
}

const mapPull = (raw: Record<string, unknown>): GithubPullRequest => ({
  id: Number(raw.id),
  number: Number(raw.number),
  title: String(raw.title ?? ''),
  state: raw.state === 'open' ? 'open' : 'closed',
  createdAt: String(raw.created_at ?? ''),
  closedAt: (raw.closed_at as string | null) ?? null,
  mergedAt: (raw.merged_at as string | null) ?? null,
  userLogin: String(((raw.user as Record<string, unknown>) ?? {}).login ?? ''),
  isMerged: Boolean(raw.merged_at) || raw.merged === true,
})

const mapIssue = (raw: Record<string, unknown>): GithubIssue | null => {
  // issues 接口会包含 PR，需排除
  if (raw.pull_request) return null
  return {
    id: Number(raw.id),
    number: Number(raw.number),
    title: String(raw.title ?? ''),
    state: raw.state === 'open' ? 'open' : 'closed',
    createdAt: String(raw.created_at ?? ''),
    closedAt: (raw.closed_at as string | null) ?? null,
    userLogin: String(((raw.user as Record<string, unknown>) ?? {}).login ?? ''),
  }
}

const mapGist = (raw: Record<string, unknown>): GithubGist => ({
  id: String(raw.id),
  description: (raw.description as string | null) ?? null,
  htmlUrl: String(raw.html_url ?? ''),
  createdAt: String(raw.created_at ?? ''),
  updatedAt: String(raw.updated_at ?? ''),
})

/** 获取用户公开资料 */
export async function getUserProfile(username: string): Promise<GithubUserProfile> {
  const key = `profile:${username}`
  const cached = cacheGet<GithubUserProfile>(key)
  if (cached) return cached

  const raw = await githubRequest<Record<string, unknown>>(
    `/users/${encodeURIComponent(username)}`,
  )
  const profile = mapUser(raw)
  cacheSet(key, profile, CACHE_TTL.PROFILE)
  return profile
}

/**
 * 获取仓库列表（分页，最多 10 页 = 1000 个仓库）。
 * - includePrivate=false：/users/{username}/repos，任何情况下都只返回公开仓库。
 * - includePrivate=true：/user/repos?visibility=all，仅用于“登录用户本人”的报告，
 *   需要 OAuth token 具备 repo scope；查询他人时不要传 true。
 */
export async function getUserRepositories(
  username: string,
  includePrivate = false,
): Promise<GithubRepository[]> {
  const scope = includePrivate ? 'all' : 'public'
  const key = `repos:${username}:${scope}`
  const cached = cacheGet<GithubRepository[]>(key)
  if (cached) return cached

  const path = includePrivate
    ? '/user/repos?affiliation=owner&visibility=all&sort=created&direction=asc'
    : `/users/${encodeURIComponent(username)}/repos?sort=created&direction=asc`
  const raw = await githubPaginate<Record<string, unknown>>(path)
  const repos = raw.map(mapRepo)
  cacheSet(key, repos, CACHE_TTL.REPOS)
  return repos
}

/** 获取仓库语言字节数 */
export async function getRepositoryLanguages(
  owner: string,
  repo: string,
): Promise<GithubLanguages> {
  const key = `langs:${owner}/${repo}`
  const cached = cacheGet<GithubLanguages>(key)
  if (cached) return cached

  const langs = await githubRequest<GithubLanguages>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/languages`,
  )
  cacheSet(key, langs, CACHE_TTL.LANGUAGES)
  return langs
}

/**
 * 获取仓库提交记录（时间范围过滤，分页）。
 * 注意：该接口返回的是仓库提交记录，包含可能的多作者提交，
 * 是否计入个人贡献需在统计层做作者归属判断。
 */
export async function getRepositoryCommits(
  owner: string,
  repo: string,
  since: string,
  until: string,
): Promise<GithubCommit[]> {
  const key = `commits:${owner}/${repo}:${since}:${until}`
  const cached = cacheGet<GithubCommit[]>(key)
  if (cached) return cached

  const raw = await githubPaginate<Record<string, unknown>>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?since=${since}&until=${until}`,
    { maxPages: 10 },
  )
  const commits = raw.map(mapCommit)
  cacheSet(key, commits, CACHE_TTL.COMMITS)
  return commits
}

/**
 * 获取仓库 PR 列表（分页，state=all）。
 * 时间过滤由调用方在统计层处理（基于 createdAt）。
 */
export async function getPullRequests(
  owner: string,
  repo: string,
): Promise<GithubPullRequest[]> {
  const key = `pulls:${owner}/${repo}`
  const cached = cacheGet<GithubPullRequest[]>(key)
  if (cached) return cached

  const raw = await githubPaginate<Record<string, unknown>>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=all`,
    { maxPages: 10 },
  )
  const pulls = raw.map(mapPull)
  cacheSet(key, pulls, CACHE_TTL.PULLS)
  return pulls
}

/**
 * 获取仓库 Issue 列表（分页，state=all）。
 * 自动排除 PR 条目；只保留目标用户创建的 Issue 由统计层过滤。
 */
export async function getIssues(
  owner: string,
  repo: string,
): Promise<GithubIssue[]> {
  const key = `issues:${owner}/${repo}`
  const cached = cacheGet<GithubIssue[]>(key)
  if (cached) return cached

  const raw = await githubPaginate<Record<string, unknown>>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=all`,
    { maxPages: 10 },
  )
  const issues = raw
    .map(mapIssue)
    .filter((i): i is GithubIssue => i !== null)
  cacheSet(key, issues, CACHE_TTL.ISSUES)
  return issues
}

/** 获取用户 Gists 数量（分页计数） */
export async function getGists(username: string): Promise<GithubGist[]> {
  const key = `gists:${username}`
  const cached = cacheGet<GithubGist[]>(key)
  if (cached) return cached

  const raw = await githubPaginate<Record<string, unknown>>(
    `/users/${encodeURIComponent(username)}/gists`,
  )
  const gists = raw.map(mapGist)
  cacheSet(key, gists, CACHE_TTL.GISTS)
  return gists
}

/* ============================================================
   Search API：高效统计年度 PR / Issue / Review / 评论
   匿名限流约 10 次/分钟（独立于 REST 60 次/小时）
   ============================================================ */

interface SearchResult {
  total_count: number
}

/**
 * 搜索议题/PR 并返回 total_count（不翻页拉取明细）。
 * q 由调用方构造，此处负责 URL 编码与错误归一化。
 */
async function searchCount(query: string): Promise<number> {
  const key = `search:${query}`
  const cached = cacheGet<number>(key)
  // 0 是合法结果（确实没有匹配项），不能用 truthy 判断，否则会反复请求并浪费额度
  if (cached !== null) return cached

  const raw = await githubRequest<SearchResult>(
    `/search/issues?q=${encodeURIComponent(query)}&per_page=1`,
  )
  const total = Number(raw.total_count ?? 0)
  cacheSet(key, total, 10 * 60 * 1000)
  return total
}

/** 年度内创建的 PR 数量与状态分解；publicOnly=true 时强制只统计公开仓库 */
export async function searchPullRequestStats(
  username: string,
  from: string,
  to: string,
  publicOnly = false,
): Promise<{
  total: number
  merged: number
  open: number
  closedUnmerged: number
}> {
  const visibility = publicOnly ? ' is:public' : ''
  const base = `author:${username} type:pr created:${from}..${to}${visibility}`
  const [total, merged, open] = await Promise.all([
    searchCount(base),
    searchCount(`${base} is:merged`),
    searchCount(`${base} is:open`),
  ])
  return { total, merged, open, closedUnmerged: Math.max(0, total - merged - open) }
}

/** 年度内创建的 Issue 数量与状态分解；publicOnly=true 时强制只统计公开仓库 */
export async function searchIssueStats(
  username: string,
  from: string,
  to: string,
  publicOnly = false,
): Promise<{ total: number; open: number; closed: number }> {
  const visibility = publicOnly ? ' is:public' : ''
  const base = `author:${username} type:issue created:${from}..${to}${visibility}`
  const [total, open] = await Promise.all([
    searchCount(base),
    searchCount(`${base} is:open`),
  ])
  return { total, open, closed: Math.max(0, total - open) }
}

/**
 * 参与评审的 PR 数量（近似口径：reviewed-by 搜索结果）
 * 不等于 Review 次数，标记为部分统计。
 */
export async function searchReviewedPrCount(
  username: string,
  from: string,
  to: string,
  publicOnly = false,
): Promise<number> {
  const visibility = publicOnly ? ' is:public' : ''
  return searchCount(
    `reviewed-by:${username} type:pr created:${from}..${to}${visibility}`,
  )
}

/** 发表过评论的议题/PR 数量（近似口径，不等于评论条数） */
export async function searchCommenterCount(
  username: string,
  from: string,
  to: string,
  publicOnly = false,
): Promise<number> {
  const visibility = publicOnly ? ' is:public' : ''
  return searchCount(`commenter:${username} created:${from}..${to}${visibility}`)
}

/**
 * 已合并 PR 的平均合并时长（创建 → 合并，天）。
 * 拉取最近创建的 100 条明细计算；超过 100 条时为抽样口径，
 * 调用方据 total > sampled 标记"部分"。
 */
export async function searchMergedPrDurations(
  username: string,
  from: string,
  to: string,
  publicOnly = false,
): Promise<{ total: number; sampled: number; avgDays: number | null }> {
  const visibility = publicOnly ? ' is:public' : ''
  const base = `author:${username} type:pr is:merged created:${from}..${to}${visibility}`
  const key = `search-pr-durations:${base}`
  const cached = cacheGet<{ total: number; sampled: number; avgDays: number | null }>(key)
  if (cached) return cached

  const raw = await githubRequest<{
    total_count: number
    items?: Array<Record<string, unknown>>
  }>(
    `/search/issues?q=${encodeURIComponent(base)}&per_page=100&sort=created&order=desc`,
  )

  const items = raw.items ?? []
  let sum = 0
  let n = 0
  for (const item of items) {
    const created = String(item.created_at ?? '')
    const closed = String(item.closed_at ?? '')
    if (!created || !closed) continue
    const days = (Date.parse(closed) - Date.parse(created)) / 86_400_000
    if (Number.isFinite(days) && days >= 0) {
      sum += days
      n++
    }
  }
  const result = {
    total: Number(raw.total_count ?? 0),
    sampled: n,
    avgDays: n > 0 ? sum / n : null,
  }
  cacheSet(key, result, 10 * 60 * 1000)
  return result
}
