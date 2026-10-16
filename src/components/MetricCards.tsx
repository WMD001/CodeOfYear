/**
 * MetricCards：年度核心指标卡片（第二行，8 张）
 * 每卡含：图标、指标名、统计数值、说明、口径提示、数据状态。
 * 同比仅在口径一致的场景展示（第一版不做估算，默认隐藏）。
 */
import type { DataState } from '../types/data-status'
import type { MetricCards as Metrics } from '../types/report'
import { DataStatusBadge } from './DataStatus'
import { formatNumber } from '../utils/date'

interface Props {
  metrics: Metrics
  year: number
}

/** 限定卡片 key 为数值型指标字段（排除 starsIsYearly / forksIsYearly） */
type MetricKey = {
  [K in keyof Metrics]: Metrics[K] extends DataState<number> ? K : never
}[keyof Metrics]

interface CardDef {
  key: MetricKey
  label: string
  hint: string
  icon: React.ReactNode
}

const ICON_STROKE = 'currentColor'

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <span className="w-9 h-9 rounded-lg flex items-center justify-center text-[#2ea043] bg-[#2ea043]/10 border border-[#2ea043]/25">
      {children}
    </span>
  )
}

const CARDS: CardDef[] = [
  {
    key: 'totalCommits',
    label: '总提交次数',
    hint: '年度内可可靠归因到该用户的提交次数（优先 GitHub 贡献统计口径）',
    icon: (
      <Icon>
        <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke={ICON_STROKE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 1v4" />
          <path d="M4 3l2.4 3.6a2 2 0 0 0 3.2 0L12 3" />
          <path d="M1 7c0-2 1.5-3 3-3M15 7c0-2-1.5-3-3-3" />
          <path d="M8 10v5" />
        </svg>
      </Icon>
    ),
  },
  {
    key: 'newRepositories',
    label: '年度仓库数',
    hint: '所选年度内创建、且当前仍可查询到的公开仓库数量',
    icon: (
      <Icon>
        <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke={ICON_STROKE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 13.5V2.5A1.5 1.5 0 0 1 3.5 1h9A1.5 1.5 0 0 1 14 2.5v11" />
          <path d="M2 13.5A1.5 1.5 0 0 0 3.5 15h10.5" />
          <path d="M6 4h4M6 7h4M6 10h2" />
        </svg>
      </Icon>
    ),
  },
  {
    key: 'stars',
    label: '获得的 Star 数',
    hint: '所选年度内可确认的新增 Star 数；若无法还原年度增量则降级为当前总数',
    icon: (
      <Icon>
        <svg viewBox="0 0 16 16" width="18" height="18" fill={ICON_STROKE}>
          <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
        </svg>
      </Icon>
    ),
  },
  {
    key: 'forks',
    label: 'Fork 次数',
    hint: '所选年度内可确认的 Fork 增量；若无法还原则降级为当前 Fork 总数',
    icon: (
      <Icon>
        <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke={ICON_STROKE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="5" cy="3.5" r="2" />
          <circle cx="5" cy="12.5" r="2" />
          <circle cx="11" cy="6.5" r="2" />
          <path d="M5 5.5v5M5 7h3.5a2 2 0 0 0 2-2v-.5" />
        </svg>
      </Icon>
    ),
  },
  {
    key: 'contributionDays',
    label: '贡献天数',
    hint: '年度内至少存在一项 GitHub 贡献的日期数量（每日期只计一次）',
    icon: (
      <Icon>
        <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke={ICON_STROKE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1.5" y="3" width="13" height="11.5" rx="1.5" />
          <path d="M1.5 6.5h13" />
          <path d="M5 1v3M11 1v3" />
          <path d="M4.5 10l1.2-1.2 1.3 1.3 2.5-2.6 1.5 1.5" />
        </svg>
      </Icon>
    ),
  },
  {
    key: 'pullRequests',
    label: '参与的 PR 数',
    hint: '年度内创建的 Pull Request 数量（不含仅参与的 PR）',
    icon: (
      <Icon>
        <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke={ICON_STROKE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="4" cy="4" r="2" />
          <circle cx="4" cy="12" r="2" />
          <circle cx="12" cy="6" r="2" />
          <path d="M4 6v4M4 10h5a3 3 0 0 0 3-3" />
        </svg>
      </Icon>
    ),
  },
  {
    key: 'issues',
    label: '创建的 Issues 数',
    hint: '年度内创建的 Issue 数量（不含其他人创建的 Issue）',
    icon: (
      <Icon>
        <svg viewBox="0 0 16 16" width="18" height="18" fill={ICON_STROKE}>
          <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm9-3a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-.25 3.75a.75.75 0 0 0-1.5 0v3a.75.75 0 0 0 1.5 0Z" />
        </svg>
      </Icon>
    ),
  },
  {
    key: 'reviews',
    label: '代码评审数',
    hint: '年度内参与的 Pull Request Review 次数',
    icon: (
      <Icon>
        <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke={ICON_STROKE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1.5 2.5h13v9h-13z" />
          <path d="M5 2v13M8 2v13M11 2v13M1.5 6h13M1.5 10h13" />
        </svg>
      </Icon>
    ),
  },
]

function MetricCard({
  def,
  state,
  labelOverride,
}: {
  def: CardDef
  state: DataState<number>
  labelOverride?: string
}) {
  const value = state.value
  const hasValue = value !== null && state.status !== 'error'
  const label = labelOverride ?? def.label

  return (
    <div
      className="card p-4 flex flex-col gap-2.5 min-w-0"
      title={`${def.hint}${state.note ? ` · ${state.note}` : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#8b949e] truncate" title={label}>
          {label}
        </span>
        {def.icon}
      </div>

      <div className="mono-num text-3xl font-bold text-[#e6edf3] leading-none">
        {hasValue ? formatNumber(value) : '—'}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <DataStatusBadge status={state.status} />
        {def.key === 'stars' && hasValue && (
          <span className="text-[11px] text-[#8b949e] whitespace-nowrap">
            年度增量口径
          </span>
        )}
      </div>

      <p className="text-[11px] text-[#6e7681] leading-snug line-clamp-2">
        {state.note || def.hint}
      </p>
    </div>
  )
}

export default function MetricCards({ metrics, year }: Props) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-[#e6edf3] mb-3">
        {year} 年度核心指标
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
        {CARDS.map((def) => {
          const state = metrics[def.key]
          const labelOverride =
            def.key === 'stars' && !metrics.starsIsYearly
              ? '当前仓库 Star 总数'
              : def.key === 'forks' && !metrics.forksIsYearly
                ? '当前仓库 Fork 总数'
                : undefined
          return (
            <MetricCard
              key={def.key}
              def={def}
              state={state}
              labelOverride={labelOverride}
            />
          )
        })}
      </div>
    </div>
  )
}
