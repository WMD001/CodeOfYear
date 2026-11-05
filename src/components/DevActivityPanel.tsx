/**
 * DevActivityPanel：开发活跃度面板
 * 参照设计图：图标行 + 百分比进度条 + 底部寄语。
 * 无法可靠计算的指标显示"不支持"，不使用估算值。
 */
import type { ReactNode } from 'react'
import type { ActivityPanelData } from '../types/report'
import { formatDateCN, formatNumber } from '../utils/date'

interface Props {
  activity: ActivityPanelData
  year: number
}

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

const ICONS = {
  clock: (
    <Glyph>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v3.2l2 1.2" />
    </Glyph>
  ),
  repo: (
    <Glyph>
      <path d="M2.5 13V3A1.5 1.5 0 0 1 4 1.5h8A1.5 1.5 0 0 1 13.5 3v10" />
      <path d="M2.5 13A1.5 1.5 0 0 0 4 14.5h9" />
    </Glyph>
  ),
  pull: (
    <Glyph>
      <circle cx="4" cy="4" r="1.6" />
      <circle cx="4" cy="12" r="1.6" />
      <circle cx="12" cy="6" r="1.6" />
      <path d="M4 5.6v4.8M4 10h5a3 3 0 0 0 3-3" />
    </Glyph>
  ),
  timer: (
    <Glyph>
      <circle cx="8" cy="8.5" r="5" />
      <path d="M8 5.8v2.7l1.8 1.1M6 1.5h4" />
    </Glyph>
  ),
  issue: (
    <Glyph>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v3.6M8 11v.1" />
    </Glyph>
  ),
}

function Row({
  icon,
  label,
  value,
  note,
  unavailable,
  bar,
}: {
  icon: ReactNode
  label: string
  value: string | null
  note?: string
  unavailable?: boolean
  bar?: number | null
}) {
  return (
    <div className="py-[8px]" title={note}>
      <div className="flex items-center gap-2">
        <span className="text-[#5f6b7a] shrink-0">{icon}</span>
        <span className="text-[12px] text-[#9aa7b6] flex-1 truncate">{label}</span>
        {unavailable ? (
          <span className="text-[10.5px] text-[#5f6b7a]">不支持</span>
        ) : (
          <span className="mono-num text-[12px] font-medium text-[#e6edf3]">
            {value ?? '—'}
          </span>
        )}
      </div>
      {bar !== null && bar !== undefined && (
        <div className="mt-1.5 ml-[21px] h-1 rounded-full bg-[#1a222d] overflow-hidden">
          <span
            className="block h-full rounded-full bg-gradient-to-r from-[#238636] to-[#3fb950]"
            style={{ width: `${Math.max(0, Math.min(100, bar))}%` }}
          />
        </div>
      )}
    </div>
  )
}

export default function DevActivityPanel({ activity, year }: Props) {
  const last = activity.lastContribution
  const ratio = activity.activeRepoRatio
  const merged = activity.prMerged
  const mergeDays = activity.avgPrMergeDays
  const issueRate = activity.issueCloseRate
  const activeRepos = activity.activeRepos

  return (
    <div className="card p-4 flex flex-col min-w-0 h-full">
      <h2 className="flex items-center gap-2 text-[16px] font-semibold text-[#e6edf3]">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="#e3b341" strokeWidth="1.4" strokeLinejoin="round" aria-hidden="true">
          <path d="M8 2.2l1.7 3.4 3.8.6-2.7 2.7.6 3.8L8 11l-3.4 1.7.6-3.8-2.7-2.7 3.8-.6z" />
        </svg>
        开发活跃度
      </h2>

      <div className="mt-1.5">
        <Row
          icon={ICONS.clock}
          label="上次提交"
          value={last.value ? formatDateCN(last.value) : null}
          unavailable={!last.value}
          note={last.note}
        />
        <Row
          icon={ICONS.repo}
          label="活跃仓库占比"
          value={ratio.value !== null ? `${ratio.value.toFixed(1)}%` : null}
          unavailable={ratio.value === null}
          note={ratio.note}
          bar={ratio.value}
        />
        <Row
          icon={ICONS.pull}
          label="PR 合并数量"
          value={merged.value !== null ? formatNumber(merged.value) : null}
          unavailable={merged.value === null}
          note={merged.note}
        />
        <Row
          icon={ICONS.timer}
          label="平均 PR 合并时间"
          value={mergeDays.value !== null ? `${mergeDays.value.toFixed(1)} 天` : null}
          unavailable={mergeDays.value === null}
          note={mergeDays.note}
        />
        <Row
          icon={ICONS.issue}
          label="Issue 处理率"
          value={issueRate.value !== null ? `${issueRate.value.toFixed(0)}%` : null}
          unavailable={issueRate.value === null}
          note={issueRate.note}
          bar={issueRate.value}
        />
      </div>

      <p className="mt-1 text-[10.5px] text-[#7d899a]">
        活跃仓库 {formatNumber(activeRepos.value ?? 0)} 个
        {activeRepos.note ? ` · ${activeRepos.note}` : ''}
      </p>

      <div className="mt-auto pt-3 flex items-center gap-2 text-[10px] leading-relaxed text-[#6e7681]">
        <svg viewBox="0 0 16 16" width="20" height="20" fill="#8b949e" aria-hidden="true">
          <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.04-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.27-.82 2.15 0 3.07 1.87 3.75 3.65 3.95-.29.25-.55.73-.64 1.37-.57.26-2 .69-2.88-.82-.52-.88-1.44-.99-1.44-.99-.58.01-1.18.44-.46.86.82.38 1.26 1.5 1.26 1.5.73 2.06 3.71 1.39 3.71 1.39.01 1.23.01 2.02.01 2.33 0 .21-.15.46-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
        </svg>
        <p>
          愿 {year + 1} 你在代码的世界里
          <br />
          <span className="text-[#3fb950]">探索、创造、成长！</span>
        </p>
        <svg viewBox="0 0 16 16" width="18" height="18" fill="#2ea043" className="ml-auto shrink-0" aria-hidden="true">
          <path d="M13.8 2.2C9.4 2.6 5.2 4.6 3.4 8.2c-1 2-.8 3.8-.4 4.9.9-2.4 2.6-4.3 4.8-5.6-1.7 1.5-2.9 3.3-3.4 5.3 1.2.4 2.8.5 4.4-.2 3.5-1.6 4.6-5.9 5-10.4Z" />
        </svg>
      </div>
    </div>
  )
}
