/**
 * OAuth 登录辅助
 * - popup 打开 /api/auth/github（Vercel Function 发起 GitHub 授权）
 * - 回调页写完 localStorage 后 postMessage 通知本窗口
 * - popup 被拦截时降级为当前页跳转（回调页会提示"请返回原页面"）
 *
 * token 存储复用 src/api/http.ts 的 gyr_github_token，
 * 登录成功后调用方通过 useReport.reload 重新加载报告即可。
 */

const MSG_SOURCE = 'gyr-oauth'
const LISTENER_TIMEOUT = 10 * 60 * 1000 // 10 分钟兜底清理

/** 登录成功/失败通知（与回调页脚本约定） */
interface OAuthMessage {
  source: typeof MSG_SOURCE
  status: 'success' | 'error'
}

function isOAuthMessage(data: unknown): data is OAuthMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { source?: unknown }).source === MSG_SOURCE &&
    ((data as { status?: unknown }).status === 'success' ||
      (data as { status?: unknown }).status === 'error')
  )
}

export function openGithubLogin(onSuccess: () => void): void {
  let settled = false
  const cleanup = () => {
    window.removeEventListener('message', onMessage)
    window.clearTimeout(timer)
  }
  const onMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin || !isOAuthMessage(event.data)) return
    settled = true
    cleanup()
    if (event.data.status === 'success') onSuccess()
  }
  const timer = window.setTimeout(cleanup, LISTENER_TIMEOUT)
  window.addEventListener('message', onMessage)

  const popup = window.open(
    '/api/auth/github',
    'gyr-oauth',
    'width=680,height=760,menubar=no,toolbar=no,location=no,status=no',
  )
  if (!popup) {
    // popup 被拦截：当前页直接跳转授权，回调页会提示用户返回
    cleanup()
    window.location.assign('/api/auth/github')
    return
  }
  // 用户直接关闭 popup：清理监听器
  const watchClose = window.setInterval(() => {
    if (popup.closed || settled) {
      window.clearInterval(watchClose)
      if (!settled) cleanup()
    }
  }, 500)
}
