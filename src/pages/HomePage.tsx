import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { hasGithubToken, setGithubToken } from '../api/http'
import { openGithubLogin } from '../api/oauth'
import DevTokenDialog from '../components/DevTokenDialog'

/** GitHub 用户名规则：字母/数字/连字符，不以连字符开头或结尾，长度 1-39 */
const USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/

const CURRENT_YEAR = new Date().getFullYear()
/** 年份选择范围：GitHub 成立于 2008 年 */
const MIN_YEAR = 2008

const EXAMPLES = [
  {
    login: 'octocat',
    name: 'The Octocat',
    desc: 'GitHub 吉祥物',
    initial: 'O',
    color: 'from-[#1f6feb] to-[#8957e5]',
  },
  {
    login: 'torvalds',
    name: 'Linus Torvalds',
    desc: 'Linux 内核作者',
    initial: 'L',
    color: 'from-[#d29922] to-[#f0883e]',
  },
  {
    login: 'gaearon',
    name: 'Dan Abramov',
    desc: 'React 核心开发者',
    initial: 'D',
    color: 'from-[#2ea043] to-[#39c5cf]',
  },
]

const HEAT_COLORS = ['#182029', '#0e4429', '#006d32', '#26a641', '#39d353']

/** 首页预览热力图的确定性分布（不参与正式统计，仅作视觉示意） */
function previewLevel(index: number): string {
  const x = Math.sin(index * 12.9898) * 43758.5453
  const r = x - Math.floor(x)
  if (r > 0.94) return HEAT_COLORS[4]
  if (r > 0.86) return HEAT_COLORS[3]
  if (r > 0.72) return HEAT_COLORS[2]
  if (r > 0.52) return HEAT_COLORS[1]
  return HEAT_COLORS[0]
}

const PREVIEW_CELLS = Array.from({ length: 371 }, (_, index) =>
  previewLevel(index),
)

function GithubMark({ size = 20 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.04-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.27-.82 2.15 0 3.07 1.87 3.75 3.65 3.95-.29.25-.55.73-.64 1.37-.57.26-2 .69-2.88-.82-.52-.88-1.44-.99-1.44-.99-.58.01-1.18.44-.46.86.82.38 1.26 1.5 1.26 1.5.73 2.06 3.71 1.39 3.71 1.39.01 1.23.01 2.02.01 2.33 0 .21-.15.46-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
    </svg>
  )
}

function PreviewCard({ year }: { year: number }) {
  return (
    <div className="card relative overflow-hidden p-5 md:p-6">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(420px 220px at 8% -10%, rgba(63,185,80,.18), transparent 65%), radial-gradient(380px 200px at 95% -10%, rgba(88,166,255,.14), transparent 65%)',
        }}
      />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <span className="mono-num text-[10px] tracking-[0.12em] text-[#8b949e]">
            WRAPPED PREVIEW
          </span>
          <span className="text-[10px] text-[#3fb950]">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current align-middle" />
            完整数据模式
          </span>
        </div>

        <div className="mt-5">
          <div className="mono-num text-[42px] font-bold leading-none tracking-[-0.05em] text-[#f2f6fa]">
            1,248
          </div>
          <div className="mt-1.5 text-[11px] text-[#8b949e]">
            {year} 年度贡献 · 示例预览
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            ['986', '提交'],
            ['183', '贡献天数'],
            ['38', '最长连续'],
          ].map(([value, label]) => (
            <div
              key={label}
              className="rounded-lg border border-white/[0.04] bg-white/[0.025] p-2"
            >
              <div className="mono-num text-[16px] font-bold leading-none text-[#dbe4ee]">
                {value}
              </div>
              <div className="mt-1.5 text-[9px] text-[#8b949e]">{label}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-flow-col grid-rows-7 gap-[2px]">
          {PREVIEW_CELLS.map((color, index) => (
            <span
              key={index}
              className="aspect-square rounded-[1px]"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          <span className="rounded-full border border-[#e3b341]/25 bg-[#e3b341]/[0.07] px-2 py-1 text-[9.5px] text-[#e3b341]">
            Java 41.3%
          </span>
          <span className="rounded-full border border-[#3fb950]/25 bg-[#3fb950]/[0.07] px-2 py-1 text-[9.5px] text-[#3fb950]">
            38 天连续
          </span>
          <span className="rounded-full border border-[#58a6ff]/25 bg-[#58a6ff]/[0.07] px-2 py-1 text-[9.5px] text-[#58a6ff]">
            7 月最忙
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
          <span className="text-[9.5px] text-[#6e7681]">
            示例数据，仅用于展示结构
          </span>
          <span className="mono-num text-[10px] text-[#8b949e]">{year}</span>
        </div>
      </div>
    </div>
  )
}

function HomePage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [year, setYear] = useState(CURRENT_YEAR)
  const [error, setError] = useState<string | null>(null)
  // hasGithubToken 只在挂载时读取一次；登录跳转回本页时会重新挂载
  const [loggedIn, setLoggedIn] = useState(() => hasGithubToken())

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
    <div className="min-h-screen page-glow">
      <header className="mx-auto flex max-w-[1180px] items-center justify-between gap-3 px-4 py-5 md:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/15 text-[#e6edf3]">
            <GithubMark size={18} />
          </span>
          <span className="mono-num truncate text-[13px] font-semibold text-[#e6edf3]">
            GitHub Yearly <span className="text-[#3fb950]">/ Wrapped</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {import.meta.env.DEV && (
            <DevTokenDialog onSaved={() => setLoggedIn(hasGithubToken())} />
          )}
          {loggedIn ? (
            <button
              type="button"
              onClick={() => {
                setGithubToken(null)
                setLoggedIn(false)
              }}
              className="text-xs border border-[#30363d] hover:border-[#3d444d] text-[#8b949e] hover:text-[#e6edf3] rounded-lg px-3 py-1.5 transition"
            >
              退出登录
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openGithubLogin(() => navigate(0))}
              className="inline-flex items-center gap-1.5 text-xs bg-[#238636] hover:bg-[#2ea043] text-white rounded-lg px-3 py-1.5 transition"
            >
              <GithubMark size={13} />
              使用 GitHub 登录
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-4 pb-16 md:px-6">
        {/* Hero：价值主张 + 查询表单 + 预览卡 */}
        <section className="grid grid-cols-1 items-center gap-8 pt-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 lg:pt-14">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#2ea043]/30 bg-[#2ea043]/10 px-3 py-1 text-[10px] text-[#3fb950]">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              GitHub 年度贡献报告
            </span>

            <h1 className="display mt-4 text-[40px] font-bold leading-[1.05] tracking-tight text-[#f2f6fa] md:text-[58px]">
              用数据回顾
              <br />
              <span className="text-[#3fb950]">你的代码这一年</span>
            </h1>
            <p className="mt-4 max-w-[540px] text-[14px] leading-relaxed text-[#8b949e]">
              输入 GitHub 用户名，生成一屏可分享的年度摘要；
              想看细节，再展开完整仪表盘。提交、贡献、热力图、仓库、语言与活跃度，全部来自真实公开数据。
            </p>

            <form
              onSubmit={handleSubmit}
              className="card mt-7 flex w-full max-w-[560px] flex-col gap-3 p-4 md:p-5"
              noValidate
            >
              <div className="flex flex-col gap-3 sm:flex-row">
                <label className="flex flex-1 flex-col gap-1.5">
                  <span className="text-[11px] text-[#8b949e]">GitHub 用户名</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="例如 octocat"
                    autoFocus
                    aria-label="GitHub 用户名"
                    className="bg-[#0d141d] border border-[#30363d] rounded-lg px-3.5 py-2.5 text-[13px] text-[#e6edf3] placeholder-[#484f58] outline-none focus:border-[#2ea043] focus:ring-2 focus:ring-[#2ea043]/30 transition"
                  />
                </label>
                <label className="flex flex-col gap-1.5 sm:w-[112px]">
                  <span className="text-[11px] text-[#8b949e]">统计年份</span>
                  <select
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    aria-label="统计年份"
                    className="bg-[#0d141d] border border-[#30363d] rounded-lg px-3 py-2.5 text-[13px] text-[#e6edf3] outline-none focus:border-[#2ea043] focus:ring-2 focus:ring-[#2ea043]/30 transition cursor-pointer"
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
                <p className="text-[11px] text-[#f85149]" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="mt-1 w-full bg-[#238636] hover:bg-[#2ea043] active:bg-[#1f6f33] text-white font-medium rounded-lg px-6 py-2.5 text-[13px] transition"
              >
                生成我的年度报告
              </button>

              <p className="text-[10px] leading-relaxed text-[#6e7681]">
                匿名可直接查看；使用 GitHub 登录或本地设置 Token 后可获取完整贡献日历。
                当前年份统计截止于今日。
              </p>
            </form>
          </div>

          <div className="mx-auto w-full max-w-[430px] lg:ml-auto">
            <PreviewCard year={year} />
          </div>
        </section>

        {/* 示例用户 */}
        <section className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-[18px] font-semibold text-[#e6edf3]">先看几个示例</h2>
              <p className="mt-1 text-[11px] text-[#8b949e]">
                点击任意用户，直接生成 {year} 年报告
              </p>
            </div>
            <span className="mono-num text-[10px] text-[#6e7681]">
              无需输入用户名
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {EXAMPLES.map((item) => (
              <button
                key={item.login}
                type="button"
                onClick={() => navigate(`/report/${item.login}?year=${year}`)}
                className="card group p-4 text-left transition hover:border-white/20 hover:bg-white/[0.02]"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br ${item.color} mono-num text-[14px] font-bold text-white`}
                  >
                    {item.initial}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-[#e6edf3]">
                      {item.name}
                    </div>
                    <div className="mono-num truncate text-[10px] text-[#58a6ff]">
                      @{item.login}
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-[10.5px] text-[#8b949e]">{item.desc}</p>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.05] pt-2.5 text-[10px]">
                  <span className="text-[#6e7681]">查看 {year} 年度报告</span>
                  <span className="text-[#3fb950] transition group-hover:translate-x-0.5">
                    →
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* 能力说明 */}
        <section className="mt-12 grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            {
              icon: '▦',
              color: '#3fb950',
              title: '完整贡献日历',
              desc: '登录后可获取 GraphQL 完整贡献数据；匿名模式自动降级，并明确标注数据状态。',
            },
            {
              icon: '◔',
              color: '#58a6ff',
              title: '年度深度分析',
              desc: '8 项核心指标、全年热力图、热门仓库、语言分布与月度活跃趋势。',
            },
            {
              icon: '↓',
              color: '#e3b341',
              title: '可分享的摘要卡',
              desc: '默认一屏年度摘要，支持导出 PNG；想看细节再展开完整仪表盘。',
            },
          ].map((item) => (
            <div key={item.title} className="card p-4">
              <span
                className="grid h-8 w-8 place-items-center rounded-lg text-[14px]"
                style={{
                  color: item.color,
                  backgroundColor: `${item.color}18`,
                  boxShadow: `inset 0 0 0 1px ${item.color}2e`,
                }}
              >
                {item.icon}
              </span>
              <h3 className="mt-3 text-[13px] font-semibold text-[#e6edf3]">
                {item.title}
              </h3>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-[#8b949e]">
                {item.desc}
              </p>
            </div>
          ))}
        </section>

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-4 text-[10px] text-[#5f6b7a]">
          <span>数据来源：GitHub 公开 API（REST & GraphQL）· 所有统计基于实际获取的数据</span>
          <span className="mono-num">GitHub Yearly Report</span>
        </footer>
      </main>
    </div>
  )
}

export default HomePage