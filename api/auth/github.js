/**
 * OAuth 登录入口：GET /api/auth/github
 * 302 重定向到 GitHub 授权页。
 * - 申请 repo scope：登录后可读取本人私有仓库与私有贡献；
 *   查询他人时 GitHub 仍只返回公开数据，后端也会强制公开口径。
 * - state 写入 HttpOnly Cookie（10 分钟），回调端校验防 CSRF。
 * - 不传 redirect_uri：GitHub 回跳到 OAuth App 注册的回调地址，
 *   避免本地 / 预览域名与注册地址不一致的问题。
 *
 * 环境变量（Vercel 项目设置，勿用 VITE_ 前缀暴露到浏览器）：
 *   GITHUB_OAUTH_CLIENT_ID
 *   GITHUB_OAUTH_CLIENT_SECRET
 */

import { randomUUID } from 'node:crypto'

const STATE_COOKIE = 'gyr_oauth_state'
const STATE_MAX_AGE = 600 // 10 分钟

function htmlResponse(res, status, title, detail) {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(`<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0d1117;color:#e6edf3;font-family:system-ui,sans-serif">
<div style="text-align:center;padding:24px">
<p style="font-size:16px;margin:0 0 8px">${title}</p>
<p style="font-size:13px;color:#8b949e;margin:0">${detail}</p>
</div></body></html>`)
}

export default async function handler(req, res) {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID
  if (!clientId || !process.env.GITHUB_OAUTH_CLIENT_SECRET) {
    htmlResponse(
      res,
      500,
      'GitHub 登录暂未配置',
      '服务端缺少 GITHUB_OAUTH_CLIENT_ID / GITHUB_OAUTH_CLIENT_SECRET 环境变量，请参考 README 完成 OAuth App 配置。',
    )
    return
  }

  const state = randomUUID()
  const params = new URLSearchParams({
    client_id: clientId,
    state,
    // repo scope：仅用于读取“登录用户本人”的私有仓库与私有贡献；
    // 查询其他用户时 GitHub 只返回公开数据，前端也会强制公开口径。
    scope: 'repo',
  })

  res.statusCode = 302
  res.setHeader('Set-Cookie', [
    `${STATE_COOKIE}=${state}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${STATE_MAX_AGE}`,
  ].join('; '))
  res.setHeader('Location', `https://github.com/login/oauth/authorize?${params}`)
  res.end()
}
