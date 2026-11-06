/**
 * GitHub API 代理：未登录访客的公开数据请求。
 *
 * 路由采用平铺形式：/api/github?path=%2Fusers%2FWMD001
 * 不使用嵌套 catch-all，避免 Vercel 平台路由不匹配导致 404。
 *
 * 安全约束：
 * - GITHUB_PAT_TOKEN 必须是“空 scope”的 classic PAT，或仅公开仓库只读的
 *   fine-grained PAT。不要使用带 repo scope 的 Token，否则匿名访客可能
 *   通过 /repos/* 读到该 Token 所有者可访问的私有仓库数据。
 * - 只允许 /users/*、/repos/*、/search/*、/graphql。
 * - 不转发 /user、/gists、/notifications 等认证用户专属路径。
 */

const API_BASE = 'https://api.github.com'
const ALLOWED_PREFIXES = ['/users/', '/repos/', '/search/']
const ALLOWED_EXACT = ['/graphql']

function json(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

/** 从 query.path 读取完整的 GitHub API 路径（含 query string） */
function resolveTarget(req) {
  const raw = req.query?.path
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== 'string' || !value.startsWith('/')) return null
  if (value.includes('..')) return null
  return value
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    json(res, 405, { message: 'Method Not Allowed' })
    return
  }

  const target = resolveTarget(req)
  if (!target) {
    json(res, 400, { message: 'Invalid path' })
    return
  }

  const pathOnly = target.split('?')[0]
  const allowed =
    ALLOWED_EXACT.includes(pathOnly) ||
    ALLOWED_PREFIXES.some((prefix) => pathOnly.startsWith(prefix))

  if (!allowed) {
    json(res, 403, { message: 'Path not allowed', path: pathOnly })
    return
  }

  if (pathOnly === '/graphql' ? req.method !== 'POST' : req.method !== 'GET') {
    json(res, 405, { message: 'Method Not Allowed' })
    return
  }

  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    // GitHub API 要求请求带 User-Agent；Node fetch 的默认 UA 不保证可用
    'User-Agent': 'GitHub-Yearly-Report',
  }

  // 未配置时自动回退为匿名请求，不阻塞页面
  const pat = process.env.GITHUB_PAT_TOKEN
  if (pat) headers.Authorization = `Bearer ${pat}`
  if (req.method === 'POST') headers['Content-Type'] = 'application/json'

  let body
  if (req.method === 'POST') {
    body =
      typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body ?? {})
  }

  try {
    const upstream = await fetch(`${API_BASE}${target}`, {
      method: req.method,
      headers,
      body,
      signal: AbortSignal.timeout(30_000),
    })
    const buffer = Buffer.from(await upstream.arrayBuffer())

    res.statusCode = upstream.status
    // 便于线上排查实际转发路径；不含 query，避免暴露搜索词
    res.setHeader('x-gyr-proxy-path', pathOnly)
    res.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') ?? 'application/json',
    )
    res.setHeader('Cache-Control', 'no-store')
    res.end(buffer)
  } catch (err) {
    json(res, 502, {
      message: `GitHub 代理请求失败：${
        err instanceof Error ? err.message : '未知错误'
      }`,
      path: pathOnly,
    })
  }
}