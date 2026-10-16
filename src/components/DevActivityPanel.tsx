/**
 * DevActivityPanel：开发活跃度面板（第四行最右列，参照设计图）
 * 上次提交 / 活跃仓库数 / 活跃仓库占比 / PR 合并数量 / 平均 PR 合并时间 / Issue 关闭率
 * + 底部寄语（"愿 {year+1} 你在代码的世界里探索、创造、成长！"）
 */
import type { ActivityPanelData } from '../types/report'
import { formatDateCN, formatNumber } from '../utils/date'

interface Props {
  activity: ActivityPanelData
  year: number
}

function Row({
  label,
  value,
  unavailable,
  note,
}: {
  label: string
  value: string | null
  unavailable?: boolean
  note?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <span className="text-sm text-[#8b949e]" title={note}>
        {label}
      </span>
      {unavailable ? (
        <span className="text-sm text-[#6e7681]">不支持</span>
      ) : (
        <span className="mono-num text-sm font-medium text-[#e6edf3] text-right">
          {value ?? '—'}
        </span>
      )}
    </div>
  )
}

export default function DevActivityPanel({ activity, year }: Props) {
  const last = activity.lastContribution
  const activeRepos = activity.activeRepos
  const ratio = activity.activeRepoRatio
  const merged = activity.prMerged
  const mergeDays = activity.avgPrMergeDays
  const issueRate = activity.issueCloseRate

  return (
    <div className="card p-5 flex flex-col min-w-0">
      <h2 className="text-lg font-semibold text-[#e6edf3] mb-3">
        开发活跃度
      </h2>

      <div className="divide-y divide-[#21262d]">
        <Row
          label="上次提交"
          value={last.value ? formatDateCN(last.value) : null}
          unavailable={!last.value}
          note={last.note}
        />
        <Row
          label="活跃仓库数"
          value={activeRepos.value !== null ? formatNumber(activeRepos.value) : null}
          unavailable={!activeRepos.value}
          note={activeRepos.note}
        />
        <Row
          label="活跃仓库占比"
          value={ratio.value !== null ? `${ratio.value.toFixed(1)}%` : null}
          unavailable={!ratio.value}
          note={ratio.note}
        />
        <Row
          label="PR 合并数量"
          value={merged.value !== null ? formatNumber(merged.value) : null}
          unavailable={!merged.value}
          note={merged.note}
        />
        <Row
          label="平均 PR 合并时间"
          value={mergeDays.value !== null ? `${mergeDays.value.toFixed(1)} 天` : null}
          unavailable={!mergeDays.value}
          note={mergeDays.note}
        />
        <Row
          label="Issue 关闭率"
          value={issueRate.value !== null ? `${issueRate.value.toFixed(0)}%` : null}
          unavailable={!issueRate.value}
          note={issueRate.note}
        />
      </div>

      <p className="mt-auto pt-4 text-[#58a6ff] text-sm text-center leading-relaxed">
        愿 {year + 1} 你在代码的世界里
        <br />
        探索、创造、成长！
      </p>
    </div>
  )
}
