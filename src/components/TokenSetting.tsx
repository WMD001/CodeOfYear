/**
 * TokenSetting：可选 GitHub Personal Access Token 配置（模态框）
 * 背景：贡献热力图的完整数据来自 GitHub GraphQL API，而 GraphQL 必须携带 Token。
 * 匿名模式下贡献日历降级为 REST 提交近似统计。
 * 用户可在此自愿填入 Token（仅存浏览器 localStorage，不进分享链接）以启用完整口径。
 */
import { useState } from 'react'
import { getGithubToken, setGithubToken } from '../api/http'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export default function TokenSetting({ open, onClose, onSaved }: Props) {
  const [token, setToken] = useState<string>(() => getGithubToken() ?? '')
  const [saved, setSaved] = useState(false)

  if (!open) return null

  function handleSave() {
    const t = token.trim()
    if (t && !/^ghp_|^github_pat_/.test(t)) {
      // 非强校验，仅提示格式可能不正确
      setSaved(false)
    }
    setGithubToken(t || null)
    setSaved(true)
    onSaved()
    setTimeout(onClose, 400)
  }

  function handleClear() {
    setGithubToken(null)
    setToken('')
    setSaved(true)
    onSaved()
    setTimeout(onClose, 400)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="GitHub Token 配置"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-[#e6edf3] mb-1">
          配置 GitHub Token（可选）
        </h2>
        <p className="text-xs text-[#8b949e] mb-4 leading-relaxed">
          完整贡献日历（全年热力图、贡献分类）来自 GitHub GraphQL API，
          需要个人访问令牌认证。未配置 Token 时，贡献数据将降级为
          基于公开仓库提交记录的近似统计。
        </p>

        <label className="flex flex-col gap-1.5 mb-4">
          <span className="text-sm text-[#8b949e]">
            Personal Access Token
          </span>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ghp_… 或 github_pat_…"
            className="bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] outline-none focus:border-[#2ea043] transition mono-num"
          />
        </label>

        <ol className="text-[11px] text-[#6e7681] list-decimal list-inside mb-4 leading-relaxed">
          <li>GitHub → Settings → Developer settings → Personal access tokens</li>
          <li>创建 Token（classic 需勾选 repo 或 public_repo 读取权限）</li>
          <li>粘贴到上方输入框并保存。Token 仅保存在本机浏览器，不会进入分享链接</li>
        </ol>

        {saved && (
          <p className="text-xs text-[#3fb950] mb-3" role="status">
            ✓ 已保存
          </p>
        )}

        <div className="flex justify-end gap-2">
          {token && (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-[#f85149] hover:underline px-3 py-2"
            >
              清除 Token
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="border border-[#30363d] hover:border-[#3d444d] text-[#e6edf3] text-sm rounded-lg px-4 py-2 transition"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="bg-[#238636] hover:bg-[#2ea043] text-white text-sm rounded-lg px-4 py-2 transition"
          >
            保存并重新加载
          </button>
        </div>
      </div>
    </div>
  )
}
