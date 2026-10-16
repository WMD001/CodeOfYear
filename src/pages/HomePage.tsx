import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

/** GitHub 用户名规则：字母/数字/连字符，不以连字符开头或结尾，长度 1-39 */
const USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/

const CURRENT_YEAR = new Date().getFullYear()
/** 年份选择范围：GitHub 成立于 2008 年 */
const MIN_YEAR = 2008

function HomePage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [year, setYear] = useState(CURRENT_YEAR)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const name = username.trim()
    if (!name) {
      setError('请输入 GitHub 用户名')
      return
    }
    if (!USERNAME_RE.test(name)) {
      setError('用户名格式不正确：仅支持字母、数字与连字符，且不能以连字符开头或结尾')
      return
    }
    setError(null)
    navigate(`/report/${encodeURIComponent(name)}?year=${year}`)
  }

  const yearOptions: number[] = []
  for (let y = CURRENT_YEAR; y >= MIN_YEAR; y--) yearOptions.push(y)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-gradient-to-b from-[#0d1117] via-[#0d1117] to-[#10151c]">
      {/* GitHub 标识 */}
      <div className="mb-6">
        <svg
          viewBox="0 0 16 16"
          width="56"
          height="56"
          fill="#e6edf3"
          aria-hidden="true"
        >
          <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.04-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.27-.82 2.15 0 3.07 1.87 3.75 3.65 3.95-.29.25-.55.73-.64 1.37-.57.26-2 .69-2.88-.82-.52-.88-1.44-.99-1.44-.99-.58.01-1.18.44-.46.86.82.38 1.26 1.5 1.26 1.5.73 2.06 3.71 1.39 3.71 1.39.01 1.23.01 2.02.01 2.33 0 .21-.15.46-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
        </svg>
      </div>

      {/* 产品标题 */}
      <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2 text-[#e6edf3]">
        GitHub Yearly Report
      </h1>
      <p className="text-lg text-[#8b949e] mb-10">
        用数据记录每一年的代码与成长
      </p>

      {/* 查询表单 */}
      <form
        onSubmit={handleSubmit}
        className="card w-full max-w-2xl p-6 md:p-8 flex flex-col gap-4"
        noValidate
      >
        <div className="flex flex-col md:flex-row gap-4">
          <label className="flex-1 flex flex-col gap-1.5">
            <span className="text-sm text-[#8b949e]">GitHub 用户名</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="例如 octocat"
              autoFocus
              aria-label="GitHub 用户名"
              className="bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-2.5 text-[#e6edf3] placeholder-[#484f58] outline-none focus:border-[#2ea043] focus:ring-2 focus:ring-[#2ea043]/30 transition"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-[#8b949e]">统计年份</span>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              aria-label="统计年份"
              className="bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-2.5 text-[#e6edf3] outline-none focus:border-[#2ea043] focus:ring-2 focus:ring-[#2ea043]/30 transition cursor-pointer"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y} 年
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <p className="text-sm text-[#f85149]" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="mt-2 w-full md:w-auto md:self-end bg-[#238636] hover:bg-[#2ea043] active:bg-[#1f6f33] text-white font-medium rounded-lg px-8 py-2.5 transition disabled:opacity-50"
        >
          生成报告
        </button>
      </form>

      {/* 示例报告入口 */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm text-[#8b949e]">
        <span>没有想好查谁？试试：</span>
        <Link
          to={`/report/octocat?year=${CURRENT_YEAR}`}
          className="text-[#58a6ff] hover:text-[#79c0ff] hover:underline"
        >
          octocat 的 {CURRENT_YEAR} 年报告
        </Link>
        <span className="text-[#3d444d]">·</span>
        <button
          type="button"
          onClick={() => navigate(`/report/octocat?year=${CURRENT_YEAR - 1}`)}
          className="text-[#58a6ff] hover:text-[#79c0ff] hover:underline bg-transparent cursor-pointer"
        >
          octocat 的 {CURRENT_YEAR - 1} 年报告
        </button>
      </div>

      {/* 功能简介与数据来源说明 */}
      <div className="mt-10 max-w-2xl w-full text-center">
        <p className="text-sm text-[#8b949e] leading-relaxed">
          基于 GitHub 公开数据，统计你一年内的提交、Pull Request、Issue、代码评审、
          贡献热力图、热门仓库与编程语言分布，生成可交互、可导出的年度开发者贡献报告。
        </p>
        <p className="mt-2 text-xs text-[#6e7681]">
          数据来源：GitHub 公开 API（REST & GraphQL）· 所有统计基于实际获取的数据
          · 当前年份统计截止于今日，不展示未来贡献
        </p>
      </div>
    </div>
  )
}

export default HomePage
