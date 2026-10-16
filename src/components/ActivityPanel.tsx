/**
 * ActivityPanel：年度活跃度面板（第三行侧栏 / 第五行）
 * 最长连续贡献、首次/最后贡献、活跃仓库、月均提交、PR 合并、Issue 关闭率等。
 * 无法可靠计算的指标隐藏或显示为不可用（DataStatus 处理）。
 */
import type { ActivityPanelData } from '../types/report'
import { formatNumber, formatDateCN } from '../utils/date'

interface Props {
  activity: ActivityPanelData
  year: number
}

interface RowProps {
  label: string
  value: string | null
  unavailable?: boolean
  note?: string
}

function Row({ label, value, unavailable, note }: RowProps) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-sm text-[#8b949e]" title={note}>
        {label}
      </span>
      {unavailable ? (
        <span className="text-sm text-[#6e7681]">不可用</span>
      ) : (
        <span className="mono-num text-sm font-medium text-[#e6edf3] text-right">
          {value ?? '—'}
        </span>
      )}
    </div>
  )
}

export default function ActivityPanel({ activity, year }: Props) {
  const streak = activity.longestStreak
  const avg = activity.avgMonthlyCommits
  const activeRatio = activity.activeRepoRatio
  const prMerged = activity.prMerged
  const avgMerge = activity.avgPrMergeDays
  const issueRate = activity.issueCloseRate

  return (
    <div className="card p-5">
      <h2 className="text-lg font-semibold text-[#e6edf3] mb-3">
        {year} 年度活跃度
      </h2>

      {/* 最长连续贡献突出展示 */}
      <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4 mb-3">
        <p className="text-xs text-[#8b949e]">最长连续贡献</p>
        {streak.value ? (
          <>
            <p className="mono-num text-3xl font-bold text-[#3fb950] mt-1">
              {streak.value.days}
              <span className="text-sm font-normal text-[#8b949e] ml-1">天</span>
            </p>
            <p className="text-xs text-[#8b949e] mt-1">
              {formatDateCN(streak.value.start)} ~ {formatDateCN(streak.value.end)}
            </p>
          </>
        ) : (
          <p className="text-sm text-[#6e7681] mt-1">
            {streak.status === 'unsupported' ? '不支持统计' : '暂无连续贡献记录'}
          </p>
        )}
      </div>

      <div className="divide-y divide-[#21262d]">
        <Row
          label="本年首次贡献"
          value={activity.firstContribution.value ? formatDateCN(activity.firstContribution.value) : null}
          unavailable={!activity.firstContribution.value}
          note={activity.firstContribution.note}
        />
        <Row
          label="本年最后贡献"
          value={activity.lastContribution.value ? formatDateCN(activity.lastContribution.value) : null}
          unavailable={!activity.lastContribution.value}
          note={activity.lastContribution.note}
        />
        <Row
          label="有贡献的天数"
          value={activity.activeDays.value !== null ? formatNumber(activity.activeDays.value) : null}
          unavailable={!activity.activeDays.value}
        />
        <Row
          label="活跃仓库数"
          value={activity.activeRepos.value !== null ? formatNumber(activity.activeRepos.value) : null}
          unavailable={!activity.activeRepos.value}
        />
        <Row
          label="活跃仓库占比"
          value={activeRatio.value !== null ? `${activeRatio.value.toFixed(1)}%` : null}
          unavailable={!activeRatio.value}
          note={activeRatio.note}
        />
        <Row
          label="平均每月提交"
          value={avg.value !== null ? `${avg.value.toFixed(1)} 次` : null}
          unavailable={!avg.value}
        />
        <Row
          label="PR 合并数量"
          value={prMerged.value !== null ? formatNumber(prMerged.value) : null}
          unavailable={!prMerged.value}
        />
        <Row
          label="平均 PR 合并时间"
          value={avgMerge.value !== null ? `${avgMerge.value.toFixed(1)} 天` : null}
          unavailable={!avgMerge.value}
          note={avgMerge.note}
        />
        <Row
          label="Issue 关闭率"
          value={issueRate.value !== null ? `${issueRate.value.toFixed(0)}%` : null}
          unavailable={!issueRate.value}
          note={issueRate.note}
        />
      </div>
    </div>
  )
}
