/**
 * ReportHeader：报告头部
 * 参照设计图：GitHub 标识 + 大标题/副标题，右侧数据来源与统计区间；
 * 下方以无边框细条整合用户资料（头像/用户名/简介/仓库/关注/加入时间/更新时间）
 * 与数据模式、分享/导出/Token 操作，避免额外工具条破坏设计稿的紧凑节奏。
 */
import type { ReactNode } from 'react'
import type { ReportHeader as Header, UserProfileData } from '../types/report'

interface Props {
  header: Header
  user: UserProfileData
  modeLabel: string
  modeTone: 'complete' | 'partial'
  actions: ReactNode
}

function GithubMark({ size = 44 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="#e6edf3"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.04-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.27-.82 2.15 0 3.07 1.87 3.75 3.65 3.95-.29.25-.55.73-.64 1.37-.57.26-2 .69-2.88-.82-.52-.88-1.44-.99-1.44-.99-.58.01-1.18.44-.46.86.82.38 1.26 1.5 1.26 1.5.73 2.06 3.71 1.39 3.71 1.39.01 1.23.01 2.02.01 2.33 0 .21-.15.46-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
    </svg>
  )
}

export default function ReportHeader({
  header,
  user,
  modeLabel,
  modeTone,
  actions,
}: Props) {
  const updatedAt = new Date(header.generatedAt).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
  })

  return (
    <header className="pb-4 border-b border-white/[0.06]">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
        <div className="flex items-center gap-4 min-w-0">
          <span className="grid place-items-center rounded-full border border-white/15 p-2.5 shrink-0">
            <GithubMark size={36} />
          </span>
          <div className="min-w-0">
            <h1 className="display text-[28px] md:text-[36px] font-bold leading-[1.05] tracking-tight text-[#f0f4f8]">
              GitHub <span className="text-[#3fb950]">{header.year}</span> 年度开发者贡献报告
            </h1>
            <p className="mt-1.5 text-[13px] text-[#8b949e] tracking-wide">
              代码记录成长 · 贡献见证坚持
            </p>
          </div>
        </div>
        <div className="text-right shrink-0 pt-1">
          <p className="text-[11px] text-[#8b949e]">
            数据来源: GitHub 公开 API
            <span className="mx-2 text-[#3d4a5c]">|</span>
            统计时间: {header.startDate} ~ {header.endDate}
          </p>
          <p className="display mt-2 text-[11px] italic tracking-[0.16em] text-[#7c8899]">
            Better Code · Better Tomorrow
          </p>
        </div>
      </div>

      {/* 用户资料 + 数据模式 + 操作 */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src={user.avatarUrl}
            alt={`${header.username} 头像`}
            width={34}
            height={34}
            className="rounded-full ring-1 ring-white/15 shrink-0 object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="min-w-0 leading-tight">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-[13px] text-[#e6edf3]">
                {user.displayName || header.username}
              </span>
              <a
                href={user.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-[#58a6ff] hover:underline"
              >
                @{header.username}
              </a>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-[1px] text-[10px] ${
                  modeTone === 'complete'
                    ? 'border-[#2ea043]/30 bg-[#2ea043]/10 text-[#3fb950]'
                    : 'border-[#d29922]/30 bg-[#d29922]/10 text-[#d29922]'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {modeLabel}
              </span>
            </div>
            {user.bio && (
              <p className="mt-0.5 text-[11px] text-[#6e7681] truncate max-w-[320px]">
                {user.bio}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#8b949e]">
          <span>
            公开仓库 <span className="mono-num text-[#dbe4ee]">{user.publicRepos}</span>
          </span>
          <span className="text-[#334052]">·</span>
          <span>
            Followers <span className="mono-num text-[#dbe4ee]">{user.followers}</span>
          </span>
          <span className="text-[#334052]">·</span>
          <span>
            Following <span className="mono-num text-[#dbe4ee]">{user.following}</span>
          </span>
          <span className="text-[#334052]">·</span>
          <span>加入于 {user.createdAt.slice(0, 10)}</span>
          <span className="text-[#334052]">·</span>
          <span className="text-[#5f6b7a]">更新于 {updatedAt}</span>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2" data-export-ignore="true">
          {actions}
        </div>
      </div>
    </header>
  )
}
