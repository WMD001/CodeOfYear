/**
 * ExtraStats：其他统计面板（第五行）
 * 区分年度数据与当前状态数据；Gists、年度 PR/Issue/Review、评论等。
 */
import type { DataState } from '../types/data-status'
import type { ExtraStats as Extra } from '../types/report'
import { formatNumber } from '../utils/date'

interface Props {
  extra: Extra
}

interface RowProps {
  label: string
  state: DataState<number>
  /** 标注"当前状态"（区别于年度数据） */
  current?: boolean
}

function NumRow({ label, state, current }: RowProps) {
  const hasValue = state.value !== null && state.status !== 'error'
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-sm text-[#8b949e]" title={state.note}>
        {label}
        {current && (
          <span className="ml-1 text-[10px] text-[#6e7681]">当前状态</span>
        )}
      </span>
      <span className="mono-num text-sm font-medium text-[#e6edf3]">
        {hasValue ? formatNumber(state.value!) : '—'}
      </span>
    </div>
  )
}

export default function ExtraStats({ extra }: Props) {
  return (
    <div className="card p-5">
      <h2 className="text-lg font-semibold text-[#e6edf3] mb-3">
        其他统计数据
      </h2>

      <div className="grid grid-cols-2 gap-x-6">
        <div className="divide-y divide-[#21262d]">
          <p className="text-xs text-[#6e7681] py-1">仓库与关注</p>
          <NumRow label="公开仓库总数" state={{ status: 'complete', value: extra.currentPublicRepos }} current />
          <NumRow label="年度新增公开仓库" state={extra.yearlyNewRepos} />
          <NumRow label="Fork 总数" state={extra.currentTotalForks} current />
          <NumRow label="Star 总数" state={extra.currentTotalStars} current />
          <NumRow label="Gists 数量" state={extra.gists} />
        </div>
        <div className="divide-y divide-[#21262d]">
          <p className="text-xs text-[#6e7681] py-1">年度活动</p>
          <NumRow label="年度 PR 总数" state={extra.yearlyPRs} />
          <NumRow label="年度 Issue 总数" state={extra.yearlyIssues} />
          <NumRow label="Review 数量" state={extra.yearlyReviews} />
          <NumRow label="评论数量" state={extra.comments} />
          <div className="flex items-baseline justify-between gap-3 py-1.5">
            <span className="text-sm text-[#8b949e]">主要开发语言</span>
            <span className="text-sm font-medium text-[#e6edf3]">
              {extra.primaryLanguage.value ?? '—'}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-[#6e7681]">
        年度指标与当前状态严格区分：当前仓库/关注者数量不代表年度新增数量。
      </p>
    </div>
  )
}
