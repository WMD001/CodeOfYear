/**
 * LoadingScreen：报告生成过程动画
 * 按 report-service 的真实阶段推进，不伪造进度百分比。
 */
import type { ReportStage } from '../types/report'

interface Props {
  username: string
  year: number
  stage: ReportStage
}

const STAGES: Array<{
  key: Exclude<ReportStage, 'done'>
  label: string
  desc: string
}> = [
  {
    key: 'profile',
    label: '读取用户资料',
    desc: 'GitHub 公开档案与加入时间',
  },
  {
    key: 'repos',
    label: '拉取公开仓库',
    desc: '仓库列表、Star、Fork 与更新时间',
  },
  {
    key: 'contributions',
    label: '获取贡献日历',
    desc: '全年每日贡献与仓库级提交',
  },
  {
    key: 'languages',
    label: '聚合语言与同比',
    desc: '语言占比与去年同口径数据',
  },
  {
    key: 'search',
    label: '统计协作数据',
    desc: 'PR、Issue、Review 与评论',
  },
]

const CURRENT_YEAR = new Date().getFullYear()

export default function LoadingScreen({ username, year, stage }: Props) {
  const currentIndex =
    stage === 'done'
      ? STAGES.length
      : Math.max(
          0,
          STAGES.findIndex((item) => item.key === stage),
        )
  const activeStage = stage === 'done' ? null : STAGES[currentIndex]
  const progress =
    stage === 'done'
      ? 100
      : Math.round(((currentIndex + 1) / (STAGES.length + 1)) * 100)

  return (
    <div className="min-h-screen page-glow flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[560px]">
        <div className="card relative overflow-hidden p-6 md:p-8">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(480px 240px at 8% -10%, rgba(63,185,80,.18), transparent 65%), radial-gradient(420px 220px at 95% -10%, rgba(88,166,255,.14), transparent 65%)',
            }}
          />

          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <span className="mono-num text-[10px] tracking-[0.14em] text-[#8b949e]">
                GENERATING WRAPPED
              </span>
              <span className="mono-num text-[10px] text-[#3fb950]">
                {progress}%
              </span>
            </div>

            <h1 className="mt-4 text-[24px] font-semibold leading-tight text-[#f2f6fa]">
              正在整理{' '}
              <span className="text-[#58a6ff]">@{username}</span> 的 {year} 年
            </h1>
            <p className="mt-2 text-[12px] text-[#8b949e]">
              {stage === 'done'
                ? '报告已就绪，正在打开…'
                : (activeStage?.desc ?? '正在准备数据')}
            </p>

            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#2ea043] via-[#3fb950] to-[#58a6ff] transition-[width] duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mt-5 flex flex-col gap-1">
              {STAGES.map((item, index) => {
                const done = stage === 'done' || index < currentIndex
                const active = stage !== 'done' && index === currentIndex
                return (
                  <div
                    key={item.key}
                    className={`flex items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-300 ${
                      active ? 'bg-white/[0.04]' : ''
                    }`}
                  >
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[10px] transition-colors duration-300 ${
                        done
                          ? 'border-[#2ea043]/30 bg-[#2ea043]/10 text-[#3fb950]'
                          : active
                            ? 'border-[#58a6ff]/30 bg-[#58a6ff]/10 text-[#58a6ff]'
                            : 'border-white/[0.06] bg-white/[0.03] text-[#6e7681]'
                      }`}
                    >
                      {done ? (
                        '✓'
                      ) : (
                        <span
                          className={`h-1.5 w-1.5 rounded-full bg-current ${
                            active ? 'animate-pulse' : ''
                          }`}
                        />
                      )}
                    </span>
                    <span
                      className={`flex-1 text-[11.5px] transition-colors duration-300 ${
                        done
                          ? 'text-[#c7d1dd]'
                          : active
                            ? 'text-[#e6edf3]'
                            : 'text-[#6e7681]'
                      }`}
                    >
                      {item.label}
                    </span>
                    <span className="mono-num text-[9.5px] text-[#5f6b7a]">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                )
              })}
            </div>

            <p className="mt-4 text-[10px] leading-relaxed text-[#6e7681]">
              正在从 GitHub 公开 API 获取数据。匿名模式下请求额度有限，
              可能需要稍等；使用 GitHub 登录或本地 Token 可以更快获取完整贡献日历。
            </p>
          </div>
        </div>

        <p className="mt-4 text-center text-[10px] text-[#5f6b7a]">
          统计区间：{year}-01-01 ~{' '}
          {year === CURRENT_YEAR ? '今日' : `${year}-12-31`}
        </p>
      </div>
    </div>
  )
}