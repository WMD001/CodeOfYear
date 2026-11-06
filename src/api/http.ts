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
const TOKEN_KEY = 'gyr_github_token'
const LOGIN_KEY = 'gyr_github_login'

/** 获取用户可选填写的 GitHub Token（仅存浏览器本地） */
export function getGithubToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)?.trim() || null
  } catch {
    return null
  }
}

/** 保存用户 Token 到 localStorage；清除时同步清除登录用户名 */
export function setGithubToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
      // Token 变了，旧 login 可能不属于新 Token；报告加载时会通过 /user 重新识别
      setGithubLogin(null)
    } else {
      localStorage.removeItem(TOKEN_KEY)
      setGithubLogin(null)
    }
  } catch {
    /* noop */
  }
}

/** 当前 OAuth 登录用户的 login（匿名 / 旧 Token 时可能为空） */
export function getGithubLogin(): string | null {
  try {
    return localStorage.getItem(LOGIN_KEY)?.trim() || null
  } catch {
    return null
  }
}

/** 保存 OAuth 登录用户名 */
export function setGithubLogin(login: string | null): void {
  try {
    if (login) localStorage.setItem(LOGIN_KEY, login)
    else localStorage.removeItem(LOGIN_KEY)
  } catch {
    /* noop */
  }
}

/**
 * 确保拿到当前 Token 对应的 login。
 * 兼容旧版本已经存了 Token、但没有存 login 的会话；
 * 请求失败时返回 null，调用方按“非本人 / 公开数据”处理。
 */
export async function fetchViewerLogin(): Promise<string | null> {
  const token = getGithubToken()
  if (!token) return null
  const cached = getGithubLogin()
  if (cached) return cached

  try {
    const resp = await fetch(`${API_BASE}/user`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(10_000),
    })
    if (!resp.ok) return null
    const data = (await resp.json()) as { login?: unknown }
    const login = typeof data.login === 'string' ? data.login : null
    if (login) setGithubLogin(login)
    return login
  } catch {
    return null
  }
}

/** 是否已通过 OAuth 登录（存在 Token） */
export function hasGithubToken(): boolean {
  return getGithubToken() !== null
}

/**
 * 未登录的生产环境：REST 请求走 /api/github 代理，
 * 由服务端附加 GITHUB_PAT_TOKEN，避免 PAT 暴露到浏览器。
 * 本地 npm run dev 没有 /api 目录，继续直连匿名接口。
 */
export function usesGithubProxy(): boolean {
  return (
    !hasGithubToken() &&
    (import.meta.env.PROD || import.meta.env.VITE_GITHUB_PROXY === '1')
  )
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
  // 登录用户直连 GitHub；未登录的生产环境走服务端代理，由代理附加应用级 PAT
  const base = token
    ? API_BASE
    : import.meta.env.PROD
      ? '/api/github'
      : API_BASE
  const endpoint = base + path

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
