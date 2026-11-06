/**
 * OAuth 回调：GET /api/auth/github/callback?code=...&state=...
 * GitHub 授权后回跳到这里。流程：
 * 1. 校验 state 与 Cookie（防 CSRF），用后即焚
 * 2. 用 code + client_secret 向 GitHub 换取 access_token（服务端完成，secret 不出网）
 * 3. 返回内联 HTML：token 写入 localStorage（gyr_github_token，与全站读取通道一致）
 *    → postMessage 通知 opener → 关闭 popup
 *
 * 本页面是用户可见的 popup 页面，所有失败路径都返回可读的错误提示。
 */

const STATE_COOKIE = 'gyr_oauth_state'

function renderPage(ok, title, detail, tokenLiteral = 'null', loginLiteral = 'null') {
  const color = ok ? '#3fb950' : '#f85149'
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0d1117;color:#e6edf3;font-family:system-ui,sans-serif">
<div style="text-align:center;padding:24px;max-width:420px">
<svg viewBox="0 0 16 16" width="40" height="40" fill="#e6edf3" style="margin-bottom:16px" aria-hidden="true"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.04-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.27-.82 2.15 0 3.07 1.87 3.75 3.65 3.95-.29.25-.55.73-.64 1.37-.57.26-2 .69-2.88-.82-.52-.88-1.44-.99-1.44-.99-.58.01-1.18.44-.46.86.82.38 1.26 1.5 1.26 1.5.73 2.06 3.71 1.39 3.71 1.39.01 1.23.01 2.02.01 2.33 0 .21-.15.46-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>
<p style="font-size:17px;font-weight:600;margin:0 0 6px;color:${color}">${title}</p>
<p style="font-size:13px;color:#8b949e;margin:0 0 20px;line-height:1.6">${detail}</p>
<p id="hint" style="font-size:12px;color:#6e7681;margin:0">此窗口将自动关闭…</p>
</div>
<script>
(function () {
  try { document.cookie = '${STATE_COOKIE}=; Path=/; Max-Age=0; Secure; SameSite=Lax'; } catch (e) {}
  var ok = ${ok ? 'true' : 'false'};
  if (ok) {
    try { localStorage.setItem('gyr_github_token', ${tokenLiteral}); } catch (e) {}
    try { localStorage.setItem('gyr_github_login', ${loginLiteral}); } catch (e) {}
  }
  var notified = false;
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ source: 'gyr-oauth', status: ok ? 'success' : 'error' }, window.location.origin);
      notified = true;
    }
  } catch (e) {}
  if (ok) {
    setTimeout(function () { window.close(); }, 600);
    setTimeout(function () {
      document.getElementById('hint').textContent = notified
        ? '若窗口未自动关闭，可直接关闭后回到报告页。'
        : '授权已完成，请返回原页面刷新查看。';
    }, 1200);
  } else {
    document.getElementById('hint').textContent = '请关闭此窗口，回到页面后重试。';
  }
})();
</script></body></html>`
}

function htmlResponse(res, status, ok, title, detail, token, login) {
  // token / login 以 JSON 字面量安全嵌入脚本；失败路径传 null
  res.statusCode = status
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(
    renderPage(
      ok,
      title,
      detail,
      token === undefined ? 'null' : JSON.stringify(token),
      login === undefined ? 'null' : JSON.stringify(login),
    ),
  )
}

function readStateCookie(cookieHeader) {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === STATE_COOKIE) return v.join('=')
  }
  return null
}

export default async function handler(req, res) {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    htmlResponse(res, 500, false, 'GitHub 登录暂未配置', '服务端缺少 OAuth 环境变量，请参考 README 完成 OAuth App 配置。')
    return
  }

  const url = new URL(req.url, `https://${req.headers.host ?? 'localhost'}`)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  const cookieState = readStateCookie(req.headers.cookie)

  if (error) {
    const desc = url.searchParams.get('error_description') ?? '用户取消了授权'
    htmlResponse(res, 200, false, '授权未完成', desc)
    return
  }
  if (!code || !state) {
    htmlResponse(res, 400, false, '回调参数缺失', '缺少 code 或 state 参数，请重新发起登录。')
    return
  }
  if (!cookieState || cookieState !== state) {
    htmlResponse(res, 400, false, 'state 校验失败', '登录会话已过期或不合法，请关闭窗口后重新登录。')
    return
  }

  try {
    const resp = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
      signal: AbortSignal.timeout(15_000),
    })
    const data = await resp.json()
    if (!resp.ok || !data.access_token) {
      const detail = data.error_description ?? `GitHub 返回 ${resp.status}，请稍后重试。`
      htmlResponse(res, 200, false, '换取令牌失败', detail)
      return
    }

    // 记录 token 对应的登录用户，供前端判断“本人 / 他人”数据范围。
    // 查询他人时 GitHub 本身只返回公开数据，前端还会强制 is:public。
    let login = ''
    try {
      const userResp = await fetch('https://api.github.com/user', {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${data.access_token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
        signal: AbortSignal.timeout(10_000),
      })
      if (userResp.ok) {
        const user = await userResp.json()
        if (typeof user.login === 'string') login = user.login
      }
    } catch {
      /* 获取 login 失败不阻塞登录，前端会按公开数据兜底 */
    }

    htmlResponse(
      res,
      200,
      true,
      '登录成功',
      '完整贡献数据已解锁，正在返回报告页…',
      data.access_token,
      login,
    )
  } catch (err) {
    htmlResponse(res, 200, false, '网络异常', `连接 GitHub 失败：${err instanceof Error ? err.message : '未知错误'}`)
  }
}
