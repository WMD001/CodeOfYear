/**
 * CommitTrend：月度提交趋势（柱状图，参照设计图"提交趋势"面板）
 * - 横轴 1-12 月，纵轴提交数
 * - 当前月份统计截至当日；未来月份显示"未统计"，不填充虚构零值
 * - 悬停查看月份与提交数；突出最高提交月份
 * - 下方统计：月均提交 / 最长连续贡献 / 常用开发语言 Top 3
 */
import { useMemo, useRef } from 'react'
import type { ActivityPanelData, LanguageStat, MonthlyTrendItem } from '../types/report'
import { formatNumber } from '../utils/date'
import { useECharts } from '../utils/echarts'

interface Props {
  trend: MonthlyTrendItem[]
  year: number
  activity: ActivityPanelData
  languages: LanguageStat[]
}

export default function CommitTrend({ trend, year, activity, languages }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const completed = trend.filter((t) => t.isComplete && t.commits !== null)
  const total = completed.reduce((acc, t) => acc + (t.commits ?? 0), 0)
  const avg = completed.length > 0 ? total / completed.length : 0
  const streak = activity.longestStreak.value
  const values = trend.map((t) => (t.isComplete ? t.commits : null))
  const max = Math.max(...values.filter((v): v is number => v !== null), 0)
  const topLangs = languages.slice(0, 3)

  const option = useMemo(() => {
    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1c2128',
        borderColor: '#3d444d',
        textStyle: { color: '#e6edf3', fontSize: 12 },
        axisPointer: { type: 'shadow' },
        formatter: (params: Array<{ axisValue: string; value: number | null }>) => {
          const p = params[0]
          const label = trend.find((t) => t.monthLabel === p.axisValue)?.monthLabel ?? p.axisValue
          if (p.value === null) return `<div style="font-size:12px">${label} · 未统计</div>`
          return `<div style="font-size:12px">${label}<div style="font-weight:600;color:#3fb950">${formatNumber(p.value)} 次提交</div></div>`
        },
      },
      grid: { top: 16, left: 36, right: 12, bottom: 24 },
      xAxis: {
        type: 'category',
        data: trend.map((t) => t.monthLabel),
        axisLine: { lineStyle: { color: '#30363d' } },
        axisTick: { show: false },
        axisLabel: { color: '#8b949e', fontSize: 10, interval: 0 },
      },
      yAxis: {
        type: 'value',
        min: 0,
        splitLine: { lineStyle: { color: '#21262d' } },
        axisLabel: { color: '#6e7681', fontSize: 10 },
      },
      series: [
        {
          type: 'bar',
          data: values,
          barMaxWidth: 18,
          itemStyle: {
            borderRadius: [3, 3, 0, 0],
            color: (p: { dataIndex: number }) =>
              p.dataIndex === trend.findIndex((t) => (t.commits ?? 0) === max && t.isComplete)
                ? '#3fb950'
                : '#2ea043',
            opacity: (p: { value: number | null }) => (p.value === null ? 0.15 : 1),
          },
          label: {
            show: true,
            position: 'top',
            color: '#8b949e',
            fontSize: 10,
            formatter: (p: { value: number | null }) => (p.value === null ? '未统计' : p.value > 0 ? formatNumber(p.value) : ''),
          },
        },
      ],
    }
  }, [trend, max])

  useECharts(containerRef, option)

  return (
    <div className="card p-5 flex flex-col min-w-0">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[#e6edf3]">提交趋势</h2>
        <span className="text-xs text-[#8b949e]">
          {year} 年 · 已完成月份统计
        </span>
      </div>

      {trend.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-[#8b949e]">
          <p>暂无提交数据</p>
          <p className="mt-1 text-xs text-[#6e7681]">未获取到可用的贡献日历</p>
        </div>
      ) : (
        <>
          <div ref={containerRef} className="w-full flex-1" style={{ minHeight: 200 }} />

          <div className="mt-4 grid grid-cols-2 gap-3 text-center">
            <div className="bg-[#0d1117] border border-[#21262d] rounded-lg py-2.5 px-2">
              <p className="text-xs text-[#8b949e]">月均提交</p>
              <p className="mono-num text-lg font-semibold text-[#e6edf3] mt-0.5">
                {avg.toFixed(1)} 次
              </p>
            </div>
            <div className="bg-[#0d1117] border border-[#21262d] rounded-lg py-2.5 px-2">
              <p className="text-xs text-[#8b949e]">最长连续贡献</p>
              <p className="mono-num text-lg font-semibold text-[#e6edf3] mt-0.5">
                {streak ? `${streak.days} 天` : '—'}
              </p>
            </div>
          </div>

          {topLangs.length > 0 && (
            <p className="mt-3 text-[11px] text-[#6e7681] text-center">
              常用开发语言 (Top {topLangs.length}):{' '}
              {topLangs
                .map((l) => `${l.language} ${l.percentage.toFixed(0)}%`)
                .join(' · ')}
            </p>
          )}
        </>
      )}
    </div>
  )
}
