/**
 * ContributionHeatmap：全年贡献热力图（GitHub 风格贡献日历）
 * 使用 CSS Grid 渲染，格子随容器宽度自适应并保持正方形；
 * 悬停显示日期、星期与当日贡献数；未来日期不绘制。
 */
import { useMemo, useRef, useState } from 'react'
import type { HeatmapDay } from '../types/report'
import { dayOfYear, formatNumber } from '../utils/date'

interface Props {
  days: HeatmapDay[]
  totalContributions: number
  endDate: string
  /** 额外统计项（如最长连续、首次提交），显示在顶部统计行 */
  extraStats?: Array<{ label: string; value: string }>
  /** 底部图例右侧的年度寄语 */
  quote?: { text: string; author: string }
}

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const WEEKDAY_LABELS = new Set([0, 2, 4, 6])

const LEVEL_COLORS: Record<string, string> = {
  NONE: '#182029',
  FIRST_QUARTILE: '#0e4429',
  SECOND_QUARTILE: '#006d32',
  THIRD_QUARTILE: '#26a641',
  FOURTH_QUARTILE: '#39d353',
}

const LEGEND = [
  ['#182029', '0'],
  ['#0e4429', '少'],
  ['#006d32', '中'],
  ['#26a641', '较多'],
  ['#39d353', '多'],
] as const

/** 星期序号（周一=0） */
function weekdayIndex(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00Z`).getUTCDay()
  return (d + 6) % 7
}

interface HoverTip {
  date: string
  weekday: string
  count: number
  x: number
  y: number
}

export default function ContributionHeatmap({
  days,
  totalContributions,
  endDate,
  extraStats,
  quote,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<HoverTip | null>(null)
  const year = Number(endDate.slice(0, 4))
  const activeDays = days.filter((d) => d.contributionCount > 0).length

  const { cells, totalWeeks, monthLabels } = useMemo(() => {
    const offset = weekdayIndex(`${year}-01-01`)
    const daysInYear = year % 4 === 0 ? 366 : 365
    const totalWeeks = Math.ceil((daysInYear + offset) / 7)
    const byDate = new Map(days.map((d) => [d.date, d]))

    const cells = Array.from({ length: daysInYear }, (_, i) => {
      const d = new Date(`${year}-01-01T00:00:00Z`)
      d.setUTCDate(d.getUTCDate() + i)
      const date = d.toISOString().slice(0, 10)
      const pos = i + offset
      return {
        date,
        week: Math.floor(pos / 7),
        weekday: pos % 7,
        day: byDate.get(date),
        future: date > endDate,
      }
    })

    const monthLabels: Array<{ month: number; week: number }> = []
    for (let m = 1; m <= 12; m++) {
      const first = `${year}-${String(m).padStart(2, '0')}-01`
      monthLabels.push({
        month: m,
        week: Math.floor((dayOfYear(first) - 1 + offset) / 7),
      })
    }

    return { cells, totalWeeks, monthLabels }
  }, [days, endDate, year])

  const columns = `28px repeat(${totalWeeks}, minmax(0, 1fr))`
  const cutoff = endDate !== `${year}-12-31` ? `截止 ${endDate}` : null

  function showTip(e: React.MouseEvent<HTMLDivElement>, date: string, count: number) {
    const host = cardRef.current
    if (!host) return
    const hostRect = host.getBoundingClientRect()
    const cellRect = e.currentTarget.getBoundingClientRect()
    setTip({
      date,
      weekday: WEEKDAYS[weekdayIndex(date)],
      count,
      x: cellRect.left - hostRect.left + cellRect.width / 2,
      y: cellRect.top - hostRect.top,
    })
  }

  return (
    <div ref={cardRef} className="card relative p-5 flex flex-col min-w-0 h-full">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[16px] font-semibold text-[#e6edf3]">
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="#3fb950" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
            <rect x="2" y="3" width="12" height="11" rx="2" />
            <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
          </svg>
          全年贡献热力图
        </h2>
        <p className="text-[11px] text-[#8b949e]">
          共 <span className="text-[#dbe4ee] font-medium">{formatNumber(totalContributions)}</span> 次贡献
          <span className="mx-1.5 text-[#334052]">·</span>
          <span className="text-[#3fb950] font-medium">{activeDays}</span> 天有贡献
          {extraStats?.map((stat) => (
            <span key={stat.label}>
              <span className="mx-1.5 text-[#334052]">·</span>
              {stat.label}{' '}
              <span className="text-[#dbe4ee] font-medium">{stat.value}</span>
            </span>
          ))}
          {cutoff && (
            <>
              <span className="mx-1.5 text-[#334052]">·</span>
              <span className="text-[#5f6b7a]">{cutoff}</span>
            </>
          )}
        </p>
      </div>

      {days.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center min-h-[180px] text-[#8b949e]">
          <p>暂无贡献数据</p>
          <p className="mt-1 text-xs text-[#6e7681]">
            所选年度内未获取到可验证的贡献日历数据
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-center mt-3">
          <div className="overflow-x-auto pb-1">
            <div className="min-w-[600px]">
              {/* 月份标签 */}
              <div
                className="grid gap-x-[2px] mb-1.5"
                style={{ gridTemplateColumns: columns }}
              >
                {monthLabels.map(({ month, week }) => (
                  <span
                    key={month}
                    className="text-[10px] text-[#8b949e] whitespace-nowrap justify-self-start"
                    style={{ gridColumn: week + 2, gridRow: 1 }}
                  >
                    {month}月
                  </span>
                ))}
              </div>

              {/* 星期 × 周格子 */}
              <div
                className="grid gap-x-[2px] gap-y-[2px]"
                style={{ gridTemplateColumns: columns }}
              >
                {WEEKDAYS.map((label, i) =>
                  WEEKDAY_LABELS.has(i) ? (
                    <span
                      key={label}
                      className="text-[10px] text-[#6e7681] flex items-center justify-end pr-1 whitespace-nowrap"
                      style={{ gridColumn: 1, gridRow: i + 1 }}
                    >
                      {label}
                    </span>
                  ) : null,
                )}

                {cells.map(({ date, week, weekday, day, future }) => {
                  if (future) return null
                  const count = day?.contributionCount ?? 0
                  const level = day?.contributionLevel ?? 'NONE'
                  return (
                    <div
                      key={date}
                      role="img"
                      aria-label={`${date} ${count} 次贡献`}
                      title={`${date}（${WEEKDAYS[weekday]}）${count} 次贡献`}
                      className="w-full aspect-square rounded-[2.5px] cursor-pointer transition-[outline] duration-100 hover:outline hover:outline-1 hover:outline-[#e6edf3]/70"
                      style={{
                        gridColumn: week + 2,
                        gridRow: weekday + 1,
                        backgroundColor: LEVEL_COLORS[level] ?? LEVEL_COLORS.NONE,
                        outlineOffset: '1px',
                      }}
                      onMouseEnter={(e) => showTip(e, date, count)}
                      onMouseLeave={() => setTip(null)}
                    />
                  )
                })}
              </div>
            </div>
          </div>

          {/* 颜色图例 + 年度寄语 */}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
            <div className="flex items-center gap-1.5 text-[10px] text-[#6e7681]">
              <span className="mr-0.5">贡献少</span>
              {LEGEND.map(([color, label]) => (
                <span
                  key={label}
                  className="w-3 h-3 rounded-[2.5px] inline-block border border-white/[0.04]"
                  style={{ backgroundColor: color }}
                  title={label}
                />
              ))}
              <span className="ml-0.5">贡献多</span>
            </div>
            {quote && (
              <p className="text-[10px] italic leading-relaxed text-[#9aa7b6]">
                “{quote.text}”
                <span className="ml-1 not-italic text-[#6e7681]">— {quote.author}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {tip && (
        <div
          className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-full rounded-md border border-[#334052] bg-[#1a2332] px-2.5 py-1.5 text-[11px] shadow-xl"
          style={{ left: tip.x, top: tip.y - 6 }}
        >
          <div className="text-[#9aa7b6]">
            {tip.date}（{tip.weekday}）
          </div>
          <div className="mt-0.5 font-medium text-[#3fb950]">
            {tip.count > 0 ? `${formatNumber(tip.count)} 次贡献` : '无贡献'}
          </div>
        </div>
      )}
    </div>
  )
}
