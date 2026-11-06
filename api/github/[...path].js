/**
 * GitHub API 代理：未登录访客的公开数据请求。
 *
 * 背景：前端不能直接持有 PAT，否则会出现在构建产物里。
 * 服务端在这里附加 GITHUB_PAT_TOKEN，只透传公开数据相关接口。
 *
 * 安全约束：
 * - GITHUB_PAT_TOKEN 必须是“空 scope”的 classic PAT，或仅公开仓库只读的
 *   fine-grained PAT。不要使用带 repo scope 的 Token，否则匿名访客可能
 *   通过 /repos/* 读到该 Token 所有者可访问的私有仓库数据。
 * - 只允许 /users/*、/repos/*、/search/*、/graphql。
 * - 不转发 /user、/gists、/notifications 等认证用户专属路径。
 */

const API_BASE = 'https://api.github.com'
const PREFIX = '/api/github'
const ALLOWED_PREFIXES = ['/users/', '/repos/', '/search/']
const ALLOWED_EXACT = ['/graphql']

function json(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    json(res, 405, { message: 'Method Not Allowed' })
    return
  }

  const rawPath = req.url.startsWith(PREFIX)
    ? req.url.slice(PREFIX.length)
    : req.url

  if (!rawPath.startsWith('/') || rawPath.includes('..')) {
    json(res, 400, { message: 'Invalid path' })
    return
  }

  const pathOnly = rawPath.split('?')[0]
  const allowed =
    ALLOWED_EXACT.includes(pathOnly) ||
    ALLOWED_PREFIXES.some((prefix) => pathOnly.startsWith(prefix))

  if (!allowed) {
    json(res, 403, { message: 'Path not allowed' })
    return
  }

  if (pathOnly === '/graphql' ? req.method !== 'POST' : req.method !== 'GET') {
    json(res, 405, { message: 'Method Not Allowed' })
    return
  }

  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
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
    const upstream = await fetch(`${API_BASE}${rawPath}`, {
      method: req.method,
      headers,
      body,
      signal: AbortSignal.timeout(30_000),
    })
    const buffer = Buffer.from(await upstream.arrayBuffer())

    res.statusCode = upstream.status
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
    })
  }
}