/**
 * LanguageChart：编程语言分布（环形图，参照设计图"编程语言占比"面板）
 * - ECharts 环形图：Top5 语言 + 其他合并
 * - 中心展示统计仓库数
 * - 悬停查看语言名称、字节数与占比
 * - 右侧明细列表（Top5 + 其他）
 * - 下方"语言字节数 (Top 3)"（设计图为"代码行数 Top 3"；语言字节数 ≠ 代码行数，如实标注口径）
 */
import { useMemo, useRef } from 'react'
import type { LanguageStat } from '../types/report'
import { formatNumber } from '../utils/date'
import { useECharts } from '../utils/echarts'

interface Props {
  data: {
    stats: LanguageStat[]
    repoCount: number
    totalBytes: number
    isComplete: boolean
  }
}

/** 字节数可读化（KB/MB/GB） */
function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

/** 语言 → 颜色映射（辅助色系，其余语言用哈希取色） */
const LANGUAGE_COLORS: Record<string, string> = {
  Java: '#b07219',
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
  Markdown: '#083fa1',
  Go: '#00ADD8',
  Rust: '#dea584',
  C: '#555555',
  'C++': '#f34b7d',
  'C#': '#178600',
  PHP: '#4F5D95',
  Ruby: '#701516',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
  Vue: '#41b883',
  SQL: '#e38c00',
}

function languageColor(lang: string): string {
  if (LANGUAGE_COLORS[lang]) return LANGUAGE_COLORS[lang]
  let hash = 0
  for (let i = 0; i < lang.length; i++) {
    hash = (hash * 31 + lang.charCodeAt(i)) >>> 0
  }
  const palette = ['#58a6ff', '#39c5cf', '#a371f7', '#d29922', '#f778ba', '#3fb950']
  return palette[hash % palette.length]
}

export default function LanguageChart({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { stats, repoCount } = data
  const top = stats.slice(0, 5)
  const others = stats.slice(5)
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
        itemStyle: { color: '#3d444d' },
      })
    }

    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: '#1c2128',
        borderColor: '#3d444d',
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
          radius: ['56%', '78%'],
          center: ['50%', '52%'],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: '#161b22', borderWidth: 2, borderRadius: 4 },
          label: { show: false },
          emphasis: {
            label: { show: false },
            itemStyle: { shadowBlur: 12, shadowColor: 'rgba(0,0,0,0.4)' },
          },
          data: pieData,
        },
      ],
      graphic: [
        {
          type: 'text',
          left: 'center',
          top: '41%',
          style: {
            text: `${repoCount}`,
            fill: '#e6edf3',
            fontSize: 24,
            fontWeight: 700,
            fontFamily: 'ui-monospace, monospace',
          },
        },
        {
          type: 'text',
          left: 'center',
          top: '57%',
          style: {
            text: '统计仓库',
            fill: '#8b949e',
            fontSize: 11,
          },
        },
      ],
    }
  }, [top, others, repoCount])

  useECharts(containerRef, option)

  return (
    <div className="card p-5 flex flex-col min-w-0">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[#e6edf3]">编程语言占比</h2>
        <span className="text-xs text-[#8b949e]">
          {data.isComplete ? '当前公开仓库语言分布' : '部分仓库语言分布'}
        </span>
      </div>

      {stats.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-[#8b949e]">
          <p>暂无语言数据</p>
          <p className="mt-1 text-xs text-[#6e7681]">
            未获取到公开仓库的语言字节统计
          </p>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-4 flex-1">
          <div
            ref={containerRef}
            className="w-full sm:w-[46%] shrink-0"
            style={{ height: 230 }}
          />

          <div className="w-full sm:flex-1 min-w-0">
            <ul className="flex flex-col gap-2">
              {top.map((s) => (
                <li key={s.language} className="flex items-center gap-2 text-sm">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: languageColor(s.language) }}
                  />
                  <span className="text-[#e6edf3] truncate flex-1">
                    {s.language}
                  </span>
                  <span className="mono-num text-[#8b949e]">
                    {s.percentage.toFixed(1)}%
                  </span>
                  <span className="mono-num text-xs text-[#6e7681] w-20 text-right">
                    {formatBytes(s.bytes)}
                  </span>
                </li>
              ))}
              {others.length > 0 && (
                <li className="flex items-center gap-2 text-sm">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0 bg-[#3d444d]" />
                  <span className="text-[#8b949e] truncate flex-1">其他</span>
                  <span className="mono-num text-[#8b949e]">
                    {othersPercent.toFixed(1)}%
                  </span>
                </li>
              )}
            </ul>

            {/* 语言字节数 Top 3（设计图"代码行数 Top 3"的如实口径） */}
            {top.length > 0 && (
              <div className="mt-4 pt-3 border-t border-[#21262d]">
                <p className="text-xs text-[#8b949e] mb-2">
                  语言字节数 (Top {Math.min(3, top.length)})
                </p>
                <ul className="flex flex-col gap-1.5">
                  {top.slice(0, 3).map((s) => (
                    <li
                      key={`bytes-${s.language}`}
                      className="flex items-baseline justify-between gap-2 text-xs"
                    >
                      <span className="text-[#8b949e] truncate">
                        {s.language}
                      </span>
                      <span className="mono-num text-[#6e7681] shrink-0">
                        {formatBytes(s.bytes)} · {s.percentage.toFixed(1)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="mt-3 text-[11px] text-[#6e7681] leading-relaxed">
              语言占比 = 该语言字节数 ÷ 全部语言字节数；同一代码存在于多个仓库时可能重复计算；语言字节数 ≠ 代码行数或提交次数。
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
