import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GithubApiError } from '../../src/api/github-errors'
import { githubPaginate, githubRequest, getGithubToken, setGithubToken } from '../../src/api/http'

/** 简化 fetch mock 工具 */
function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  return vi.stubGlobal('fetch', vi.fn(impl))
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const ORIGINAL_FETCH = globalThis.fetch

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  localStorage.clear()
  globalThis.fetch = ORIGINAL_FETCH
})

beforeEach(() => {
  localStorage.clear()
})

describe('githubRequest 基础行为', () => {
  it('成功请求返回 JSON', async () => {
    mockFetch(async () => jsonResponse({ login: 'octocat' }))
    const data = await githubRequest<{ login: string }>('/users/octocat')
    expect(data.login).toBe('octocat')
  })

  it('携带 Bearer Token（配置后）', async () => {
    setGithubToken('ghp_test123')
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    await githubRequest('/users/octocat')
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.headers).toMatchObject({ Authorization: 'Bearer ghp_test123' })
  })

  it('未配置 Token 时无 Authorization 头', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    await githubRequest('/users/octocat')
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined()
  })
})

describe('错误归一化', () => {
  it('404 → not_found', async () => {
    mockFetch(async () => jsonResponse({ message: 'Not Found' }, 404))
    const err = await githubRequest('/users/nobody-xyz-404').catch((e) => e)
    expect(err).toBeInstanceOf(GithubApiError)
    expect((err as GithubApiError).kind).toBe('not_found')
  })

  it('429 → rate_limited', async () => {
    mockFetch(async () => jsonResponse({ message: 'rate limit' }, 429))
    const err = await githubRequest('/users/octocat').catch((e) => e)
    expect((err as GithubApiError).kind).toBe('rate_limited')
  })

  it('403 + rate limit 文案 → rate_limited', async () => {
    mockFetch(async () =>
      jsonResponse({ message: 'API rate limit exceeded for 1.2.3.4' }, 403),
    )
    const err = await githubRequest('/users/octocat').catch((e) => e)
    expect((err as GithubApiError).kind).toBe('rate_limited')
  })

  it('422 → validation', async () => {
    mockFetch(async () => jsonResponse({ message: 'Validation Failed' }, 422))
    const err = await githubRequest('/search/issues?q=x').catch((e) => e)
    expect((err as GithubApiError).kind).toBe('validation')
  })

  it('500 → server', async () => {
    mockFetch(async () => jsonResponse({}, 500))
    const err = await githubRequest('/users/octocat').catch((e) => e)
    expect((err as GithubApiError).kind).toBe('server')
  })
})

describe('重试行为', () => {
  it('429 首次失败后重试成功', async () => {
    let calls = 0
    mockFetch(async () => {
      calls++
      if (calls === 1) return jsonResponse({}, 429)
      return jsonResponse({ ok: true })
    })
    const data = await githubRequest<{ ok: boolean }>('/users/octocat')
    expect(data.ok).toBe(true)
    expect(calls).toBe(2)
  })

  it('网络失败重试后成功', async () => {
    let calls = 0
    mockFetch(async () => {
      calls++
      if (calls === 1) throw new TypeError('Failed to fetch')
      return jsonResponse({ ok: true })
    })
    const data = await githubRequest<{ ok: boolean }>('/users/octocat')
    expect(data.ok).toBe(true)
    expect(calls).toBe(2)
  })

  it('404 不重试（直接抛出）', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, 404))
    vi.stubGlobal('fetch', fetchMock)
    await githubRequest('/users/nope').catch(() => undefined)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('分页', () => {
  it('不足一页时停止翻页', async () => {
    mockFetch(async (url: string) => {
      const page = Number(url.match(/[?&]page=(\d+)/)?.[1] ?? '1')
      if (page === 1) return jsonResponse([{ id: 1 }])
      throw new Error('不应请求第 2 页')
    })
    const items = await githubPaginate<{ id: number }>('/users/octocat/repos')
    expect(items).toHaveLength(1)
  })

  it('满页时继续翻页直到取完', async () => {
    const pageItems = Array.from({ length: 100 }, (_, i) => ({ id: i }))
    mockFetch(async (url: string) => {
      const page = Number(url.match(/[?&]page=(\d+)/)?.[1] ?? '1')
      if (page === 1) return jsonResponse(pageItems)
      if (page === 2) return jsonResponse([{ id: 100 }])
      throw new Error('不应请求第 3 页')
    })
    const items = await githubPaginate<{ id: number }>('/users/octocat/repos')
    expect(items).toHaveLength(101)
  })
})

describe('Token 读写', () => {
  it('setGithubToken 后 getGithubToken 返回', () => {
    expect(getGithubToken()).toBeNull()
    setGithubToken('ghp_abc')
    expect(getGithubToken()).toBe('ghp_abc')
    setGithubToken(null)
    expect(getGithubToken()).toBeNull()
  })
})
