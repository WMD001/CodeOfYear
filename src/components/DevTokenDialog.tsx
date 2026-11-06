/**
 * DevTokenDialog：本地开发专用的 GitHub Token 设置弹窗。
 * 仅在 `import.meta.env.DEV` 为 true 时渲染；生产构建中入口会被移除。
 * Token 只写入 localStorage，不会上传或写入代码。
 */
import { useEffect, useState } from 'react'
import { getGithubToken, setGithubToken } from '../api/http'

interface Props {
  /** 保存或清除后回调，调用方据此刷新登录态 / 重新加载报告 */
  onSaved?: () => void
  /** sm：与报告头部小按钮同高；md：与错误页大按钮同高 */
  size?: 'sm' | 'md'
}

function maskToken(token: string): string {
  if (token.length <= 10) return '••••••••'
  return `${token.slice(0, 4)}…${token.slice(-4)}`
}

export default function DevTokenDialog({ onSaved, size = 'sm' }: Props) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [currentToken, setCurrentToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  // 生产构建时 DEV 为 false，入口整体不渲染
  if (!import.meta.env.DEV) return null

  function openDialog() {
    const token = getGithubToken()
    setCurrentToken(token)
    setValue(token ?? '')
    setError(null)
    setOpen(true)
  }

  function save() {
    const token = value.trim()
    if (!token) {
      setError('请输入 Token，或点击「清除 Token」')
      return
    }
    setGithubToken(token)
    setOpen(false)
    onSaved?.()
  }

  function clear() {
    setGithubToken(null)
    setValue('')
    setOpen(false)
    onSaved?.()
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        title="仅本地开发可见，生产构建自动隐藏"
        className={`border border-dashed border-[#d29922]/45 text-[#d29922] hover:border-[#d29922]/80 hover:text-[#e3b341] transition ${
          size === 'md'
            ? 'h-10 text-xs rounded-lg px-5'
            : 'h-7 text-[10.5px] rounded-md px-2.5'
        }`}
      >
        开发 Token
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-[2px] px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dev-token-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div className="card w-full max-w-md p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="dev-token-title"
                  className="text-[15px] font-semibold text-[#e6edf3]"
                >
                  开发环境 Token
                </h2>
                <p className="mt-1 text-[11px] text-[#8b949e]">
                  仅 <code className="font-mono text-[#79c0ff]">npm run dev</code>{' '}
                  时显示，生产构建会自动隐藏。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="关闭"
                className="text-[#6e7681] hover:text-[#e6edf3] text-lg leading-none px-1"
              >
                ×
              </button>
            </div>

            <div className="mt-3 rounded-lg border border-white/[0.06] bg-[#0d141d] px-3 py-2 text-[11px] text-[#9aa7b6]">
              当前状态：
              {currentToken ? (
                <span className="text-[#3fb950]">
                  已配置 <span className="font-mono">{maskToken(currentToken)}</span>
                </span>
              ) : (
                <span className="text-[#d29922]">未配置（匿名额度）</span>
              )}
            </div>

            <label className="mt-3 block">
              <span className="text-[11px] text-[#8b949e]">GitHub Token</span>
              <input
                type="password"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value)
                  setError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') save()
                }}
                placeholder="ghp_... 或 github_pat_..."
                autoFocus
                autoComplete="off"
                className="mt-1.5 w-full bg-[#0d141d] border border-[#30363d] rounded-lg px-3 py-2 text-[12px] text-[#e6edf3] placeholder-[#484f58] outline-none focus:border-[#2ea043] focus:ring-2 focus:ring-[#2ea043]/30 transition"
              />
            </label>

            {error && (
              <p className="mt-2 text-[11px] text-[#f85149]" role="alert">
                {error}
              </p>
            )}

            <p className="mt-2 text-[10.5px] leading-relaxed text-[#6e7681]">
              Token 只保存在当前浏览器的 localStorage，不会上传或写入代码。
              classic PAT 勾选 <span className="text-[#9aa7b6]">repo</span>{' '}
              可读取本人私有仓库；只看公开数据建议用{' '}
              <span className="text-[#9aa7b6]">public_repo</span>。fine-grained PAT
              只给需要的仓库只读权限。
            </p>
            <a
              href="https://github.com/settings/tokens"
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-[10.5px] text-[#58a6ff] hover:underline"
            >
              在 GitHub 创建 Token ↗
            </a>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={save}
                className="h-8 text-[11px] bg-[#238636] hover:bg-[#2ea043] text-white rounded-lg px-3.5 transition"
              >
                保存并刷新
              </button>
              <button
                type="button"
                onClick={clear}
                className="h-8 text-[11px] border border-[#f85149]/35 text-[#f85149] hover:border-[#f85149]/70 rounded-lg px-3.5 transition"
              >
                清除 Token
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-8 text-[11px] text-[#8b949e] hover:text-[#e6edf3] px-2 transition"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}