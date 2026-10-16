/**
 * OtherStatsPanel：年度其他数据面板（热力图右侧，参照设计图）
 * 展示可验证的补充指标（区分年度与当前状态）：
 * 当前公开仓库 / 当前 Star / 当前 Fork / 年度新增公开仓库 / Gists / 年度 PR / 年度 Issue / 主要语言 / 最近贡献。
 * 公开 API 无法可靠还原的项（如私有仓库数）不列出，不做演示占位。
 */
import type { DataState } from '../types/data-status'
import type { ExtraStats as Extra } from '../types/report'
import { formatNumber } from '../utils/date'

interface Props {
  extra: Extra
}

function Row({
  label,
  state,
  current,
  text,
}: {
  label: string
  state?: DataState<number>
  current?: boolean
  text?: string
}) {
  const hasValue = state ? state.value !== null && state.status !== 'error' : text !== undefined
  return (
    <div
      className="flex items-baseline justify-between gap-3 py-1.5"
      title={state?.note}
    >
      <span className="text-sm text-[#8b949e] truncate">
        {label}
        {current && (
          <span className="ml-1 text-[10px] text-[#6e7681]">当前状态</span>
        )}
      </span>
      <span className="mono-num text-sm font-medium text-[#e6edf3] text-right shrink-0">
        {state
          ? hasValue
            ? formatNumber(state.value!)
            : '—'
          : (text ?? '—')}
      </span>
    </div>
  )
}

export default function OtherStatsPanel({ extra }: Props) {
  return (
    <div className="card p-5">
      <h2 className="text-base font-semibold text-[#e6edf3] mb-2">
        年度其他数据
      </h2>

      <div className="divide-y divide-[#21262d]">
        <Row
          label="公开仓库"
          state={{ status: 'complete', value: extra.currentPublicRepos }}
          current
        />
        <Row label="Star 总数" state={extra.currentTotalStars} current />
        <Row label="Fork 总数" state={extra.currentTotalForks} current />
        <Row label="年度新增仓库" state={extra.yearlyNewRepos} />
        <Row label="Gists 数量" state={extra.gists} />
        <Row label="年度 PR 总数" state={extra.yearlyPRs} />
        <Row label="年度 Issue 总数" state={extra.yearlyIssues} />
        <Row
          label="主要开发语言"
          text={extra.primaryLanguage.value ?? '—'}
        />
        <Row
          label="最近一次贡献"
          text={extra.lastConfirmedContribution.value ?? '—'}
        />
      </div>

      <p className="mt-3 text-[11px] text-[#6e7681] leading-relaxed">
        年度指标与当前状态严格区分；公开 API 无法可靠还原的指标（如私有仓库数）不展示。
      </p>
    </div>
  )
}
