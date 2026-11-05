/**
 * ContributionHighlights：热力图右侧贡献亮点面板
 * 参照设计图，一个卡片内三段：最长连续贡献 / 本年首次提交 / 寄语。
 */
import type { ActivityPanelData } from '../types/report'
import { dayOfYear } from '../utils/date'

interface Props {
  activity: ActivityPanelData
  displayName: string
  username: string
}

function IconCircle({ children, tone }: { children: React.ReactNode; tone: string }) {
  return (
    <span
      className="w-9 h-9 rounded-full grid place-items-center shrink-0"
      style={{ color: tone, backgroundColor: `${tone}18`, boxShadow: `inset 0 0 0 1px ${tone}30` }}
    >
      {children}
    </span>
  )
}

export default function ContributionHighlights({
  activity,
  displayName,
  username,
}: Props) {
  const streak = activity.longestStreak
  const first = activity.firstContribution

  return (
    <div
      className="card p-3.5 flex flex-col min-w-0 h-full"
      style={{ borderColor: 'rgba(46, 160, 67, 0.32)' }}
    >
      {/* 最长连续贡献 */}
      <div className="flex items-start gap-2.5">
        <IconCircle tone="#3fb950">
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 14c3 0 4.5-1.8 4.5-4.2 0-3.4-3.1-4.6-2.4-8.3C7.4 2.6 6 4.9 6 6.5c-1-.4-1.6-1.2-1.9-2.1C3.3 5.6 3.5 8 3.5 9.8 3.5 12.2 5 14 8 14Z" />
          </svg>
        </IconCircle>
        <div className="min-w-0">
          <p className="text-[11.5px] text-[#9aa7b6]">最长连续贡献</p>
          {streak.value ? (
            <>
              <p className="display-num mt-1 text-[30px] font-bold leading-none text-[#3fb950]">
                {streak.value.days}
                <span className="ml-1 text-[12px] font-normal text-[#8b949e]">天</span>
              </p>
              <p className="mt-1.5 whitespace-nowrap text-[9.5px] text-[#6e7681]">
                {streak.value.start} ~ {streak.value.end}
              </p>
            </>
          ) : (
            <p className="mt-2 text-[12px] text-[#6e7681]">
              {streak.status === 'unsupported' ? '不支持统计' : '暂无连续贡献记录'}
            </p>
          )}
        </div>
      </div>

      <div className="my-3 border-t border-white/[0.06]" />

      {/* 本年首次提交 */}
      <div className="flex items-start gap-2.5">
        <IconCircle tone="#2ea043">
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5c2.2 0 3.7 1 4.8 2.4" />
            <path d="M13.5 2.5v3.2h-3.2" />
            <path d="M8 5.5V8l1.8 1.2" />
          </svg>
        </IconCircle>
        <div className="min-w-0">
          <p className="text-[11.5px] text-[#9aa7b6]">本年首次提交</p>
          {first.value ? (
            <>
              <p className="display-num mt-1 whitespace-nowrap text-[21px] font-semibold leading-none text-[#e6edf3]">
                {first.value}
              </p>
              <p className="mt-1.5 text-[9.5px] text-[#6e7681]">
                第 {dayOfYear(first.value)} 天
              </p>
            </>
          ) : (
            <p className="mt-2 text-[12px] text-[#6e7681]">暂无提交记录</p>
          )}
        </div>
      </div>

      {/* 寄语 */}
      <div className="mt-3 flex-1 rounded-md border-l-2 border-[#2ea043]/45 bg-[#0d141d] px-3 py-2.5 flex flex-col justify-center">
        <p className="text-[11px] italic leading-relaxed text-[#9aa7b6]">
          “代码不只是工作，
          <br />
          更是让想法变成现实的方式。”
        </p>
        <p className="mt-1.5 text-[10px] text-[#6e7681]">
          — {displayName || username}，继续加油！
        </p>
      </div>
    </div>
  )
}
