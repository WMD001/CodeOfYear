/**
 * MetricCards：年度核心指标卡片（8 张）
 * 参照设计图：彩色圆形图标 + 指标名 + 大号数字 + 同比行。
 * 同比仅在去年同口径数据可获取时展示（禁止估算，缺省显示不可比说明）。
 */
import type { DataState } from '../types/data-status'
import type { LastYearSnapshot, MetricCards as Metrics } from '../types/report'
import { formatNumber } from '../utils/date'

interface Props {
  metrics: Metrics
  year: number
  lastYear?: LastYearSnapshot
}

type MetricKey = {
  [K in keyof Metrics]: Metrics[K] extends DataState<number> ? K : never
}[keyof Metrics]

interface CardDef {
  key: MetricKey
  label: string
  hint: string
  color: string
  icon: React.ReactNode
}

function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

const CARDS: CardDef[] = [
  {
    key: 'totalCommits',
    label: '总提交次数',
    hint: '年度内可可靠归因到该用户的提交次数（优先 GitHub 贡献统计口径）',
    color: '#2ea043',
    icon: (
      <Glyph>
        <path d="M5.5 4 2.5 8l3 4M10.5 4l3 4-3 4" />
      </Glyph>
    ),
  },
  {
    key: 'newRepositories',
    label: '年度仓库数',
    hint: '所选年度内创建、且当前仍可查询到的公开仓库数量',
    color: '#3b82f6',
    icon: (
      <Glyph>
        <path d="M2.5 13.5V3A1.5 1.5 0 0 1 4 1.5h8A1.5 1.5 0 0 1 13.5 3v10.5" />
        <path d="M2.5 13.5A1.5 1.5 0 0 0 4 15h10" />
        <path d="M6 4.5h4M6 7.5h4M6 10.5h2" />
      </Glyph>
    ),
  },
  {
    key: 'stars',
    label: '获得的 Star 数',
    hint: '所选年度内可确认的新增 Star 数；若无法还原年度增量则降级为当前总数',
    color: '#e3b341',
    icon: (
      <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true">
        <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
      </svg>
    ),
  },
  {
    key: 'forks',
    label: 'Fork 次数',
    hint: '所选年度内可确认的 Fork 增量；若无法还原则降级为当前 Fork 总数',
    color: '#a371f7',
    icon: (
      <Glyph>
        <circle cx="5" cy="3.5" r="1.8" />
        <circle cx="5" cy="12.5" r="1.8" />
        <circle cx="11" cy="6.5" r="1.8" />
        <path d="M5 5.3v5.4M5 7h3.5a1.8 1.8 0 0 0 1.8-1.8v-.3" />
      </Glyph>
    ),
  },
  {
    key: 'contributionDays',
    label: '贡献天数',
    hint: '年度内至少存在一项 GitHub 贡献的日期数量（每日期只计一次）',
    color: '#22d3ee',
    icon: (
      <Glyph>
        <circle cx="8" cy="8" r="6" />
        <path d="M8 4.5V8l2.4 1.6" />
      </Glyph>
    ),
  },
  {
    key: 'pullRequests',
    label: '参与的 PR 数',
    hint: '年度内创建的 Pull Request 数量（不含仅参与的 PR）',
    color: '#58a6ff',
    icon: (
      <Glyph>
        <circle cx="4.2" cy="4" r="1.8" />
        <circle cx="4.2" cy="12" r="1.8" />
        <circle cx="11.8" cy="6.2" r="1.8" />
        <path d="M4.2 5.8v4.4M4.2 10h4.6a2 2 0 0 0 2-2v-.2" />
      </Glyph>
    ),
  },
  {
    key: 'issues',
    label: '创建的 Issues 数',
    hint: '年度内创建的 Issue 数量（不含其他人创建的 Issue）',
    color: '#f85149',
    icon: (
      <Glyph>
        <circle cx="8" cy="8" r="6" />
        <path d="M8 5v3.8M8 11.2v.1" />
      </Glyph>
    ),
  },
  {
    key: 'reviews',
    label: '代码评审数',
    hint: '年度内参与的 Pull Request Review 次数',
    color: '#f778ba',
    icon: (
      <Glyph>
        <path d="M2 3.5h12v7.2H7.2L4.2 13v-2.3H2z" />
        <path d="M5 6.2h6M5 8.4h4" />
      </Glyph>
    ),
  },
]


function yearOverYear(current: number | null, last?: number): number | null {
  if (current === null || last === undefined || last <= 0) return null
  return ((current - last) / last) * 100
}

const LAST_YEAR_KEY: Partial<Record<MetricKey, keyof LastYearSnapshot>> = {
  totalCommits: 'totalCommits',
  newRepositories: 'newRepositories',
  contributionDays: 'contributionDays',
  pullRequests: 'pullRequests',
  issues: 'issues',
  reviews: 'reviews',
}

function MetricCard({
  def,
  state,
  labelOverride,
  yoy,
  lastValue,
  lastYearLabel,
  compareNote,
}: {
  def: CardDef
  state: DataState<number>
  labelOverride?: string
  yoy: number | null
  lastValue?: number
  lastYearLabel: string
  compareNote?: string
}) {
  const value = state.value
  const hasValue = value !== null && state.status !== 'error'
  const label = labelOverride ?? def.label
  const tip = `${def.hint}${state.note ? `\n口径：${state.note}` : ''}\n状态：${state.status}`

  return (
    <div className="card relative px-3.5 pt-3.5 pb-3 min-h-[132px] min-w-0" title={tip}>
      <div className="flex items-center gap-2">
        <span
          className="w-[40px] h-[40px] rounded-[10px] grid place-items-center shrink-0"
          style={{
            color: def.color,
            backgroundColor: `${def.color}1f`,
            boxShadow: `inset 0 0 0 1px ${def.color}30`,
          }}
        >
          {def.icon}
        </span>
        <span className="text-[13px] text-[#aab6c4] leading-tight whitespace-nowrap">
          {label}
        </span>
      </div>

      <div className="mt-2.5 pl-[48px]">
        <div className="display-num text-[32px] font-bold leading-none text-[#f2f6fa]">
          {hasValue ? formatNumber(value) : '—'}
        </div>
        <div className="mt-2 min-h-[26px] flex flex-col justify-end leading-none">
          {yoy !== null ? (
            <>
              <div
                className={`inline-flex items-center gap-1 text-[12.5px] font-semibold ${
                  yoy >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]'
                }`}
              >
                <span className="text-[11px]">{yoy >= 0 ? '↑' : '↓'}</span>
                {Math.abs(Math.round(yoy))}%
              </div>
              <div className="mt-1 text-[9.5px] text-[#5f6b7a]">
                vs {lastYearLabel} ({lastValue !== undefined ? formatNumber(lastValue) : '—'})
              </div>
            </>
          ) : (
            <div className="text-[9.5px] leading-tight text-[#5f6b7a]">
              {compareNote ?? '无可比数据'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MetricCards({ metrics, year, lastYear }: Props) {
  const lastYearLabel = String(year - 1)
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-8 gap-3">
      {CARDS.map((def) => {
        const state = metrics[def.key]
        const labelOverride =
          def.key === 'stars' && !metrics.starsIsYearly
            ? '当前 Star 总数'
            : def.key === 'forks' && !metrics.forksIsYearly
              ? '当前 Fork 总数'
              : undefined
        const lastKey = LAST_YEAR_KEY[def.key]
        const lastValue = lastKey ? lastYear?.[lastKey] : undefined
        const yoy =
          def.key === 'stars' || def.key === 'forks'
            ? null
            : yearOverYear(state.value, lastValue)
        const compareNote =
          def.key === 'stars' || def.key === 'forks'
            ? '年度增量不可还原'
            : undefined
        return (
          <MetricCard
            key={def.key}
            def={def}
            state={state}
            labelOverride={labelOverride}
            yoy={yoy}
            lastValue={lastValue}
            lastYearLabel={lastYearLabel}
            compareNote={compareNote}
          />
        )
      })}
    </div>
  )
}
