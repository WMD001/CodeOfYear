/**
 * ContributionHighlights：全年贡献热力图右侧面板（参照设计图）
 * 三块堆叠：
 * 1) 最长连续贡献（大数字 + 起止日期）
 * 2) 本年首次提交（日期 + 第 N 天标注）
 * 3) 寄语（"代码不只是工作，更是让想法变成现实的方式。"）
 */
import type { ActivityPanelData } from '../types/report'
import { dayOfYear, formatDateCN } from '../utils/date'

interface Props {
  activity: ActivityPanelData
  year: number
  displayName: string
  username: string
}

export default function ContributionHighlights({
  activity,
  year,
  displayName,
  username,
}: Props) {
  const streak = activity.longestStreak
  const first = activity.firstContribution

  return (
    <div className="flex flex-col gap-3">
      {/* 最长连续贡献 */}
      <div className="card p-4">
        <p className="text-sm text-[#8b949e]">最长连续贡献</p>
        {streak.value ? (
          <>
            <p className="mono-num text-4xl font-bold text-[#3fb950] mt-2 leading-none">
              {streak.value.days}
              <span className="text-base font-normal text-[#8b949e] ml-1">天</span>
            </p>
            <p className="text-xs text-[#8b949e] mt-2">
              {formatDateCN(streak.value.start)} ~ {formatDateCN(streak.value.end)}
            </p>
          </>
        ) : (
          <p className="text-sm text-[#6e7681] mt-2">
            {streak.status === 'unsupported'
              ? '不支持统计'
              : '暂无连续贡献记录'}
          </p>
        )}
      </div>

      {/* 本年首次提交 */}
      <div className="card p-4">
        <p className="text-sm text-[#8b949e]">本年首次提交</p>
        {first.value ? (
          <>
            <p className="text-xl font-semibold text-[#e6edf3] mt-2 mono-num leading-none">
              {formatDateCN(first.value)}
            </p>
            <p className="text-xs text-[#6e7681] mt-2">
              （{year} 年第 {dayOfYear(first.value)} 天）
            </p>
          </>
        ) : (
          <p className="text-sm text-[#6e7681] mt-2">暂无提交记录</p>
        )}
      </div>

      {/* 寄语 */}
      <div className="card p-4 flex flex-col justify-center">
        <p className="text-[#8b949e] italic text-base leading-relaxed">
          “代码不只是工作，
          <br />
          更是让想法变成现实的方式。”
        </p>
        <p className="mt-3 text-xs text-[#6e7681]">
          — {displayName || username}，继续加油！
        </p>
      </div>
    </div>
  )
}
