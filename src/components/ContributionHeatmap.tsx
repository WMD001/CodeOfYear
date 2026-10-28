/**
 * ContributionHeatmap：全年贡献热力图（GitHub 风格贡献日历）
 * ECharts 热力图：
 * - x 轴 = 周（以当年 1 月 1 日所在周的周一为起点）
 * - y 轴 = 星期（周一~周日）
 * - 颜色按当日贡献数动态分档（贡献少 → 贡献多）
 * - 悬停显示日期与当日贡献总数
 * - 未来日期不绘制；月份标签按月份首日位置显示
 */
import { useMemo, useRef } from 'react'
import type { HeatmapDay } from '../types/report'
import { dayOfYear, formatNumber } from '../utils/date'
import { useECharts } from '../utils/echarts'

interface Props {
  days: HeatmapDay[]
  totalContributions: number
  endDate: string
}

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const CELL = 14
const CELL_GAP = 3
/** 图表容器固定高度：7 行格子（17px 行距）+ 月份标签，保持 GitHub 正方形格子比例，禁止 flex 拉伸 */
const CHART_HEIGHT = 168

/** 星期序号（周一=0） */
function weekdayIndex(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00Z`).getUTCDay()
  return (d + 6) % 7
}

export default function ContributionHeatmap({
  days,
  totalContributions,
  endDate,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const activeDays = days.filter((d) => d.contributionCount > 0).length
  const year = Number(endDate.slice(0, 4))

  // 网格映射：weekday 行 × week 列
  const grid = useMemo(() => {
    const offset = weekdayIndex(`${year}-01-01`) // 1 月 1 日距其所在周周一的偏移
    const daysInYear = year % 4 === 0 ? 366 : 365
    const totalWeeks = Math.ceil((daysInYear + offset) / 7)

    const countByKey = new Map<string, number>()
    for (const d of days) {
      const pos = dayOfYear(d.date) - 1 + offset
      const week = Math.floor(pos / 7)
      const wd = pos % 7
      countByKey.set(`${week}:${wd}`, d.contributionCount)
    }

    // 月份标签：每月 1 日所在周
    const monthLabelByWeek = new Map<number, string>()
    for (let m = 1; m <= 12; m++) {
      const first = `${year}-${String(m).padStart(2, '0')}-01`
      const pos = dayOfYear(first) - 1 + offset
      monthLabelByWeek.set(Math.floor(pos / 7), `${m}月`)
    }

    const data: [number, number, number][] = []
    let max = 0
    for (let week = 0; week < totalWeeks; week++) {
      for (let wd = 0; wd < 7; wd++) {
        const count = countByKey.get(`${week}:${wd}`) ?? 0
        data.push([week, wd, count])
        if (count > max) max = count
      }
    }

    return { data, totalWeeks, monthLabelByWeek, max }
  }, [days, year])

  // 动态分档颜色（基于当年最大贡献数）
  const pieces = useMemo(() => {
    const max = Math.max(grid.max, 1)
    const mk = (min: number, max: number, color: string, label: string) => ({
      min,
      max,
      color,
      label,
    })
    return [
      mk(0, 0, '#161b22', '0'),
      mk(0.0001, max * 0.25, '#0e4429', '少'),
      mk(max * 0.25 + 0.0001, max * 0.5, '#006d32', '中'),
      mk(max * 0.5 + 0.0001, max * 0.75, '#26a641', '较多'),
      mk(max * 0.75 + 0.0001, max, '#39d353', '多'),
    ]
  }, [grid.max])

  const option = useMemo(() => {
    return {
      tooltip: {
        position: 'top',
        backgroundColor: '#1c2128',
        borderColor: '#3d444d',
        textStyle: { color: '#e6edf3', fontSize: 12 },
        formatter: (p: { value: [number, number, number] }) => {
          const week = p.value[0]
          const wd = p.value[1]
          const count = p.value[2]
          // 反推日期
          const offset = weekdayIndex(`${year}-01-01`)
          const doy = week * 7 + wd - offset + 1
          const d = new Date(`${year}-01-01T00:00:00Z`)
          d.setUTCDate(d.getUTCDate() + doy - 1)
          const dateStr = d.toISOString().slice(0, 10)
          if (dateStr > endDate) return ''
          return `<div style="font-size:12px">
            <div>${dateStr}（${WEEKDAYS[wd]}）</div>
            <div style="font-weight:600;color:#3fb950">${formatNumber(count)} 次贡献</div>
          </div>`
        },
      },
      grid: {
        top: 4,
        left: 34,
        right: 8,
        bottom: 10,
        containLabel: false,
      },
      xAxis: {
        type: 'category',
        data: Array.from({ length: grid.totalWeeks }, (_, i) => i),
        splitArea: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          fontSize: 10,
          color: '#8b949e',
          interval: 0,
          formatter: (_v: string, i: number) => grid.monthLabelByWeek.get(i) ?? '',
          margin: 6,
        },
      },
      yAxis: {
        type: 'category',
        data: WEEKDAYS,
        splitArea: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          fontSize: 10,
          color: '#8b949e',
          formatter: (v: string) => (v === '周一' || v === '周三' || v === '周五' || v === '周日' ? v : ''),
        },
      },
      visualMap: {
        type: 'piecewise',
        show: false,
        pieces,
        seriesIndex: 0,
        dimension: 2,
      },
      series: [
        {
          type: 'heatmap',
          data: grid.data,
          itemStyle: {
            borderColor: '#0d1117',
            borderWidth: 2,
            borderRadius: 2,
          },
          emphasis: {
            itemStyle: { borderColor: '#e6edf3', borderWidth: 1.5 },
          },
          progressive: 0,
        },
      ],
    }
  }, [grid, pieces, year, endDate])

  useECharts(containerRef, option)

  const chartWidth = grid.totalWeeks * (CELL + CELL_GAP) + 46

  return (
    <div className="card p-5 flex flex-col min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-lg font-semibold text-[#e6edf3]">全年贡献热力图</h2>
        <div className="flex items-center gap-3 text-xs text-[#8b949e]">
          <span>
            共 {formatNumber(totalContributions)} 次贡献 · {activeDays} 天有贡献
          </span>
          <span className="text-[#6e7681]">截止 {endDate}</span>
        </div>
      </div>

      {days.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center min-h-[200px] text-[#8b949e]">
          <p>暂无贡献数据</p>
          <p className="mt-1 text-xs text-[#6e7681]">
            所选年度内未获取到可验证的贡献日历数据
          </p>
        </div>
      ) : (
        <>
          {/* 图表区：固定高度保持格子比例；外层 flex-1 让图表在卡片剩余空间垂直居中（与右侧面板等高时不留难看空白） */}
          <div className="w-full flex-1 overflow-x-auto pb-1 flex flex-col items-center justify-center">
            <div
              ref={containerRef}
              style={{ width: chartWidth, height: CHART_HEIGHT }}
              className="shrink-0"
            />
          </div>
          {/* 颜色图例：贡献少 → 贡献多 */}
          <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-[#6e7681]">
            <span>贡献少</span>
            {pieces.map((p) => (
              <span
                key={p.label}
                className="w-3 h-3 rounded-[3px] inline-block border border-[#21262d]"
                style={{ backgroundColor: p.color }}
                title={`${p.label}（${p.min?.toFixed(2) ?? 0} ~ ${p.max?.toFixed(2) ?? ''}）`}
              />
            ))}
            <span>贡献多</span>
          </div>
        </>
      )}
    </div>
  )
}
