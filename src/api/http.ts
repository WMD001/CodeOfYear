/**
 * GitHub API 基础请求层
 * - 可选 Token：来自 OAuth 登录（见 api/auth/github.js + src/api/oauth.ts），
 *   仅存浏览器 localStorage，匿名请求自动降级
 * - 指数退避重试（429 / 5xx）
 * - 错误归一化
 */

import {
  GithubApiError,
  errorFromNetwork,
  errorFromResponse,
} from './github-errors'

const API_BASE = 'https://api.github.com'

/** 获取用户可选填写的 GitHub Token（仅存浏览器本地） */
export function getGithubToken(): string | null {
  try {
    return localStorage.getItem('gyr_github_token')?.trim() || null
  } catch {
    return null
  }
}

/** 保存用户 Token 到 localStorage */
export function setGithubToken(token: string | null): void {
  try {
    if (token) localStorage.setItem('gyr_github_token', token)
    else localStorage.removeItem('gyr_github_token')
  } catch {
    /* noop */
  }
}

/** 是否已通过 OAuth 登录（存在 Token） */
export function hasGithubToken(): boolean {
  return getGithubToken() !== null
}

interface RequestOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  /** 需要认证（GraphQL 必需；REST 匿名也可用） */
  auth?: boolean
  /** 自定义重试次数（默认 2 次退避重试） */
  retries?: number
}

/** 指数退避等待 */
function backoff(attempt: number): Promise<void> {
  const ms = Math.min(1000 * 2 ** attempt, 8000)
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 发起 GitHub API 请求。
 * 返回解析后的 JSON。错误统一抛出 GithubApiError。
 */
export async function githubRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const token = getGithubToken()
  const retries = options.retries ?? 2
  const endpoint = API_BASE + path

  let lastError: GithubApiError | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }
    if (token) headers.Authorization = `Bearer ${token}`
    if (options.body !== undefined) headers['Content-Type'] = 'application/json'

    try {
      const resp = await fetch(endpoint, {
        method: options.method ?? 'GET',
        headers,
        body:
          options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(20_000),
      })

      if (!resp.ok) {
        const bodyText = await resp.text().catch(() => '')
        lastError = errorFromResponse(resp.status, endpoint, bodyText)
        // 429 / 5xx 可重试；404 等不可重试
        const retryable =
          resp.status === 429 ||
          resp.status === 403 ||
          resp.status >= 500
        if (retryable && attempt < retries) {
          await backoff(attempt)
          continue
        }
        throw lastError
      }

      if (resp.status === 204) return undefined as T
      return (await resp.json()) as T
    } catch (err) {
      if (err instanceof GithubApiError) throw err
      // 网络层错误：可重试
      lastError = errorFromNetwork(err, endpoint)
      if (attempt < retries) {
        await backoff(attempt)
        continue
      }
      throw lastError
    }
  }

  throw lastError ?? new GithubApiError('unknown', '请求失败', null, endpoint)
}

/**
 * 分页拉取 REST 列表资源。
 * 每页 per_page=100，翻页直到返回条数不足一页或达到 maxPages。
 */
export async function githubPaginate<T>(
  path: string,
  options: { maxPages?: number } = {},
): Promise<T[]> {
  const perPage = 100
  const maxPages = options.maxPages ?? 10
  const items: T[] = []

  for (let page = 1; page <= maxPages; page++) {
    const sep = path.includes('?') ? '&' : '?'
    const batch = await githubRequest<T[]>(
      `${path}${sep}per_page=${perPage}&page=${page}`,
    )
    items.push(...batch)
    if (batch.length < perPage) break
  }

  return items
}
