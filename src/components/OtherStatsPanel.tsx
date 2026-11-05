/**
 * OtherStatsPanel：年度其他数据面板（热力图右侧）
 * 仅展示可验证的补充指标，区分年度数据与当前状态；不可可靠还原的指标不展示。
 */
import type { ReactNode } from 'react'
import type { DataState } from '../types/data-status'
import type { ExtraStats as Extra } from '../types/report'
import { formatNumber } from '../utils/date'

interface Props {
  extra: Extra
}

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
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
  repos: (
    <Glyph>
      <path d="M2.5 13V3A1.5 1.5 0 0 1 4 1.5h8A1.5 1.5 0 0 1 13.5 3v10" />
      <path d="M2.5 13A1.5 1.5 0 0 0 4 14.5h9" />
    </Glyph>
  ),
  star: (
    <Glyph>
      <path d="M8 2.2l1.7 3.4 3.8.6-2.7 2.7.6 3.8L8 11l-3.4 1.7.6-3.8-2.7-2.7 3.8-.6z" />
    </Glyph>
  ),
  fork: (
    <Glyph>
      <circle cx="5" cy="3.5" r="1.6" />
      <circle cx="5" cy="12.5" r="1.6" />
      <circle cx="11" cy="6.5" r="1.6" />
      <path d="M5 5.1v5.8M5 7h3.6a1.8 1.8 0 0 0 1.8-1.8v-.1" />
    </Glyph>
  ),
  plus: (
    <Glyph>
      <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
      <path d="M8 5.5v5M5.5 8h5" />
    </Glyph>
  ),
  gist: (
    <Glyph>
      <path d="M4 2.5h8v11H4z" />
      <path d="M6 5.5h4M6 8h4M6 10.5h2" />
    </Glyph>
  ),
  code: (
    <Glyph>
      <path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5" />
    </Glyph>
  ),
  clock: (
    <Glyph>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v3l2 1.3" />
    </Glyph>
  ),
}

function Row({
  icon,
  label,
  state,
  text,
}: {
  icon: ReactNode
  label: string
  state?: DataState<number>
  text?: string
}) {
  const hasValue = state ? state.value !== null && state.status !== 'error' : text !== undefined
  return (
    <div
      className="flex items-center gap-2.5 py-[8px]"
      title={state?.note}
    >
      <span className="text-[#5f6b7a] shrink-0">{icon}</span>
      <span className="text-[12px] text-[#9aa7b6] truncate flex-1">{label}</span>
      <span className="mono-num text-[12.5px] font-medium text-[#e6edf3] text-right shrink-0">
        {state ? (hasValue ? formatNumber(state.value!) : '—') : (text ?? '—')}
      </span>
    </div>
  )
}

export default function OtherStatsPanel({ extra }: Props) {
  return (
    <div className="card p-4 flex flex-col min-w-0 h-full">
      <h2 className="flex items-center gap-2 text-[16px] font-semibold text-[#e6edf3]">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="#58a6ff" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
          <path d="M2.5 13.5h11M4 13.5V7M8 13.5V3M12 13.5V9" />
        </svg>
        年度其他数据
      </h2>

      <div className="mt-2">
        <Row icon={ICONS.repos} label="公开仓库" state={{ status: 'complete', value: extra.currentPublicRepos }} />
        <Row icon={ICONS.star} label="Star 总数" state={extra.currentTotalStars} />
        <Row icon={ICONS.fork} label="Fork 总数" state={extra.currentTotalForks} />
        <Row icon={ICONS.plus} label="年度新增仓库" state={extra.yearlyNewRepos} />
        <Row icon={ICONS.gist} label="Gists 数量" state={extra.gists} />
        <Row icon={ICONS.code} label="主要开发语言" text={extra.primaryLanguage.value ?? '—'} />
        <Row
          icon={ICONS.clock}
          label="最近一次贡献"
          text={extra.lastConfirmedContribution.value ?? '—'}
        />
      </div>

      <p className="mt-auto pt-2 text-[10.5px] leading-relaxed text-[#7d899a]">
        年度指标与当前状态严格区分，公开 API 无法可靠还原的指标不展示。
      </p>
    </div>
  )
}
