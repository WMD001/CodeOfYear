/**
 * LanguageChart：编程语言分布
 * 参照设计图：左侧环形图 + 中心总量，右侧语言占比列表，下方语言字节数 Top 3 条形。
 */
import { useMemo, useRef } from 'react'
import type { LanguageStat } from '../types/report'
import { formatNumber } from '../utils/date'
import { useECharts } from '../utils/echarts'
import { languageColor } from '../utils/language-colors'

interface Props {
  data: {
    stats: LanguageStat[]
    repoCount: number
    totalBytes: number
    isComplete: boolean
  }
  /** 全年贡献总数（环形图中心展示，与设计图一致） */
  totalContributions: number
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

export default function LanguageChart({ data, totalContributions }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { stats, repoCount } = data
  // 稳定引用，避免每次渲染生成新数组导致 ECharts option 的 memo 失效
  const top = useMemo(() => stats.slice(0, 5), [stats])
  const others = useMemo(() => stats.slice(5), [stats])
  const othersPercent = others.reduce((acc, s) => acc + s.percentage, 0)

  const option = useMemo(() => {
    const pieData = top.map((s) => ({
      name: s.language,
      value: s.bytes,
      itemStyle: { color: languageColor(s.language) },
    }))
    if (others.length > 0) {
      pieData.push({
        name: '其他',
        value: others.reduce((acc, s) => acc + s.bytes, 0),
        itemStyle: { color: '#3d4a5c' },
      })
    }

    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: '#1a2332',
        borderColor: '#334052',
        textStyle: { color: '#e6edf3', fontSize: 12 },
        formatter: (p: { name: string; value: number; percent: number }) =>
          `<div style="font-size:12px">
            <div style="font-weight:600">${p.name}</div>
            <div>${formatNumber(p.value)} 字节 · ${p.percent.toFixed(1)}%</div>
          </div>`,
      },
      series: [
        {
          type: 'pie',
          radius: ['57%', '92%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: '#131a26', borderWidth: 2, borderRadius: 3 },
          label: { show: false },
          emphasis: {
            label: { show: false },
            itemStyle: { shadowBlur: 12, shadowColor: 'rgba(0,0,0,0.45)' },
          },
          data: pieData,
        },
      ],
    }
  }, [top, others])

  useECharts(containerRef, option)

  return (
    <div className="card p-4 flex flex-col min-w-0 h-full">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[16px] font-semibold text-[#e6edf3]">
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="#a371f7" strokeWidth="1.4" aria-hidden="true">
            <path d="M8 1.8a6.2 6.2 0 1 0 0 12.4A6.2 6.2 0 0 0 8 1.8Z" />
            <path d="M8 1.8v6.2l4.4 3.1" />
          </svg>
          编程语言占比
        </h2>
        <span className="text-[10px] text-[#5f6b7a]">
          {data.isComplete ? '当前公开仓库' : '部分仓库'} · {repoCount} 个
        </span>
      </div>

      {stats.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-[#8b949e]">
          <p>暂无语言数据</p>
          <p className="mt-1 text-xs text-[#6e7681]">未获取到公开仓库的语言字节统计</p>
        </div>
      ) : (
        <>
          <div className="mt-2 flex items-center gap-2">
            <div className="relative w-[50%] max-w-[180px] shrink-0" style={{ height: 170 }}>
              <div ref={containerRef} className="w-full h-full" />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="display-num text-[24px] font-bold leading-none text-[#f2f6fa]">
                  {formatNumber(totalContributions)}
                </span>
                <span className="mt-1 text-[10px] text-[#8b949e]">次贡献</span>
              </div>
            </div>

            <ul className="flex-1 min-w-0 flex flex-col gap-[7px]">
              {top.map((s) => (
                <li key={s.language} className="flex items-center gap-1.5 text-[11px]">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: languageColor(s.language) }}
                  />
                  <span className="text-[#c9d4e0] truncate flex-1">{s.language}</span>
                  <span className="mono-num text-[#9aa7b6] w-9 text-right">
                    {s.percentage.toFixed(1)}%
                  </span>
                </li>
              ))}
              {others.length > 0 && (
                <li className="flex items-center gap-1.5 text-[11px]">
                  <span className="w-2 h-2 rounded-full shrink-0 bg-[#3d4a5c]" />
                  <span className="text-[#9aa7b6] truncate flex-1">其他</span>
                  <span className="mono-num text-[#9aa7b6] w-9 text-right">
                    {othersPercent.toFixed(1)}%
                  </span>
                </li>
              )}
            </ul>
          </div>

          <div className="mt-auto pt-3">
            <p className="text-[10px] text-[#8b949e] mb-2">
              语言字节数 (Top {Math.min(3, top.length)})
            </p>
            <ul className="flex flex-col gap-2">
              {top.slice(0, 3).map((s) => (
                <li key={`bytes-${s.language}`} className="flex items-center gap-2">
                  <span className="text-[10px] text-[#9aa7b6] w-[52px] truncate shrink-0">
                    {s.language}
                  </span>
                  <span className="flex-1 h-1.5 rounded-full bg-[#1a222d] overflow-hidden">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${top[0].percentage > 0 ? (s.percentage / top[0].percentage) * 100 : 0}%`,
                        backgroundColor: languageColor(s.language),
                      }}
                    />
                  </span>
                  <span className="mono-num text-[9.5px] text-[#5f6b7a] w-[62px] text-right shrink-0">
                    {formatBytes(s.bytes)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
