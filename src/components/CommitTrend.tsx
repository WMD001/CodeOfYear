/**
 * CommitTrend：月度贡献趋势
 * 参照设计图：绿色柱状图 + 月均贡献/最长连续贡献小卡 + 常用语言 Top 3。
 * 数据来自贡献日历的每日贡献总数（含提交/PR/Issue/Review），
 * 当前月份统计截至当日，未来月份显示"未统计"，不填充虚构零值。
 */
import { useMemo, useRef } from 'react'
import type { ActivityPanelData, LanguageStat, MonthlyTrendItem } from '../types/report'
import { formatNumber } from '../utils/date'
import { useECharts } from '../utils/echarts'
import { languageColor, languageTextColor } from '../utils/language-colors'

interface Props {
  trend: MonthlyTrendItem[]
  year: number

  activity: ActivityPanelData
  languages: LanguageStat[]
}

export default function CommitTrend({
  trend,
  year,

  activity,
  languages,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const completed = trend.filter((t) => t.isComplete && t.commits !== null)
  const total = completed.reduce((acc, t) => acc + (t.commits ?? 0), 0)
  const avgMonthly = completed.length > 0 ? total / completed.length : 0

  const streak = activity.longestStreak.value
  const max = Math.max(
    ...trend.filter((t) => t.isComplete).map((t) => t.commits ?? 0),
    0,
  )
  const topLangs = languages.slice(0, 3)
  const maxIndex = trend.findIndex((t) => t.isComplete && (t.commits ?? 0) === max)

  const option = useMemo(() => {
    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1a2332',
        borderColor: '#334052',
        textStyle: { color: '#e6edf3', fontSize: 12 },
        axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(63,185,80,0.06)' } },
        formatter: (params: Array<{ axisValue: string; value: number | null }>) => {
          const p = params[0]
          const label = trend.find((t) => t.monthLabel === p.axisValue)?.monthLabel ?? p.axisValue
          if (p.value === null) return `<div style="font-size:12px">${label} · 未统计</div>`
          return `<div style="font-size:12px">${label}<div style="font-weight:600;color:#3fb950">${formatNumber(p.value)} 次贡献</div></div>`
        },
      },
      grid: { top: 10, left: 30, right: 6, bottom: 20 },
      xAxis: {
        type: 'category',
        data: trend.map((t) => t.monthLabel),
        axisLine: { lineStyle: { color: '#232e3c' } },
        axisTick: { show: false },
        axisLabel: { color: '#6e7681', fontSize: 9, interval: 0, margin: 8 },
      },
      yAxis: {
        type: 'value',
        min: 0,
        splitNumber: 3,
        splitLine: { lineStyle: { color: '#1a222d' } },
        axisLabel: { color: '#5f6b7a', fontSize: 9 },
      },
      series: [
        {
          type: 'bar',
          data: trend.map((t) => (t.isComplete ? t.commits : null)),
          barMaxWidth: 16,
          itemStyle: {
            borderRadius: [3, 3, 0, 0],
            color: (p: { dataIndex: number }) =>
              p.dataIndex === maxIndex ? '#56d364' : '#2ea043',
            opacity: (p: { value: number | null }) => (p.value === null ? 0.12 : 1),
          },
        },
      ],
    }
  }, [trend, maxIndex])

  useECharts(containerRef, option)

  return (
    <div className="card p-4 flex flex-col min-w-0 h-full">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[16px] font-semibold text-[#e6edf3]">
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="#3fb950" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
            <path d="M2 13.5h12M2 13.5V2.5" />
            <path d="M4.5 10.5 7 7.5l2.2 2 3.3-4" />
          </svg>
          年度贡献趋势
        </h2>
        <span className="text-[10px] text-[#5f6b7a]">
          {year} 年
        </span>
      </div>

      {trend.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-[#8b949e]">
          <p>暂无提交数据</p>
          <p className="mt-1 text-xs text-[#6e7681]">未获取到可用的贡献日历</p>
        </div>
      ) : (
        <>
          <div ref={containerRef} className="w-full mt-1" style={{ height: 170 }} />

          <div className="mt-auto grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-white/[0.06] bg-[#0d141d] px-2.5 py-2 flex items-center gap-2">
              <span className="w-7 h-7 rounded-full grid place-items-center bg-[#58a6ff]/12 text-[#79c0ff] shrink-0">
                <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
                  <rect x="2.5" y="3" width="11" height="10.5" rx="1.5" />
                  <path d="M2.5 6.5h11M5.5 1.5v3M10.5 1.5v3" />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-[9.5px] text-[#6e7681] leading-none">月均贡献</p>
                <p className="display-num mt-1 text-[17px] font-semibold leading-none text-[#e6edf3]">
                  {avgMonthly.toFixed(1)}
                  <span className="ml-0.5 text-[10px] font-normal text-[#8b949e]">次</span>
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-[#0d141d] px-2.5 py-2 flex items-center gap-2">
              <span className="w-7 h-7 rounded-full grid place-items-center bg-[#2ea043]/12 text-[#3fb950] shrink-0">
                <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M8 14c3 0 4.5-1.8 4.5-4.2 0-3.4-3.1-4.6-2.4-8.3C7.4 2.6 6 4.9 6 6.5c-1-.4-1.6-1.2-1.9-2.1C3.3 5.6 3.5 8 3.5 9.8 3.5 12.2 5 14 8 14Z" />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-[9.5px] text-[#6e7681] leading-none">最长连续贡献</p>
                <p className="display-num mt-1 text-[17px] font-semibold leading-none text-[#e6edf3]">
                  {streak ? streak.days : '—'}
                  <span className="ml-0.5 text-[10px] font-normal text-[#8b949e]">天</span>
                </p>
              </div>
            </div>
          </div>

          {topLangs.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[9.5px] text-[#5f6b7a]">常用开发语言</span>
              {topLangs.map((l) => (
                <span
                  key={l.language}
                  className="inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] text-[9.5px] font-medium"
                  style={{
                    backgroundColor: languageColor(l.language),
                    color: languageTextColor(l.language),
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                  {l.language} {l.percentage.toFixed(0)}%
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
