/**
 * ReportHeader：报告头部（第一行）
 * 严格参照设计图《GitHub 2026年度开发者贡献报告》：
 * - 标题行：左 = GitHub 标识 + 主标题 + 副标题；右 = 数据来源/统计时间 + Better Code·Better Tomorrow
 * - 用户资料条：头像、用户名、简介、公开仓库/Followers/Following、加入时间、最后更新
 *   （用户资料区为开发说明§2 的硬性要求，以紧凑横条呈现，不破坏标题行布局）
 */
import type { ReportHeader as Header, UserProfileData } from '../types/report'

interface Props {
  header: Header
  user: UserProfileData
}

function GithubMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="#e6edf3"
      aria-hidden="true"
    >
      <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.04-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.27-.82 2.15 0 3.07 1.87 3.75 3.65 3.95-.29.25-.55.73-.64 1.37-.57.26-2 .69-2.88-.82-.52-.88-1.44-.99-1.44-.99-.58.01-1.18.44-.46.86.82.38 1.26 1.5 1.26 1.5.73 2.06 3.71 1.39 3.71 1.39.01 1.23.01 2.02.01 2.33 0 .21-.15.46-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
    </svg>
  )
}

export default function ReportHeader({ header, user }: Props) {
  const updatedAt = new Date(header.generatedAt).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
  })

  return (
    <header>
      {/* 标题行（参照设计图） */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <GithubMark />
          <div>
            <h1 className="text-2xl md:text-[28px] font-bold text-[#e6edf3] leading-tight">
              GitHub {header.year} 年度开发者贡献报告
            </h1>
            <p className="text-sm text-[#8b949e] mt-1">
              代码记录成长 · 贡献见证坚持
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#8b949e]">
            数据来源: GitHub 公开 API&nbsp;|&nbsp;统计时间:{' '}
            {header.startDate} ~ {header.endDate}
          </p>
          <p className="text-xs text-[#6e7681] mt-1 tracking-wide">
            Better Code · Better Tomorrow
          </p>
        </div>
      </div>

      {/* 用户资料条（开发说明§2：头像/用户名/简介/仓库/关注/加入时间/最后更新） */}
      <div className="card px-5 py-3 mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={user.avatarUrl}
            alt={`${header.username} 头像`}
            width={40}
            height={40}
            className="rounded-full border border-[#30363d] shrink-0"
            referrerPolicy="no-referrer"
          />
          <div className="min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-semibold text-[#e6edf3] text-sm">
                {user.displayName || header.username}
              </span>
              <a
                href={user.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[#58a6ff] hover:underline"
              >
                @{header.username}
              </a>
            </div>
            {user.bio && (
              <p className="text-xs text-[#8b949e] truncate max-w-[320px]">
                {user.bio}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#8b949e] ml-auto">
          <span>
            公开仓库 <span className="mono-num text-[#e6edf3]">{user.publicRepos}</span>
          </span>
          <span className="text-[#3d444d]">·</span>
          <span>
            Followers <span className="mono-num text-[#e6edf3]">{user.followers}</span>
          </span>
          <span className="text-[#3d444d]">·</span>
          <span>
            Following <span className="mono-num text-[#e6edf3]">{user.following}</span>
          </span>
          <span className="text-[#3d444d]">·</span>
          <span>加入 GitHub: {user.createdAt.slice(0, 10)}</span>
          <span className="text-[#3d444d]">·</span>
          <span className="text-[#6e7681]">最后更新: {updatedAt}</span>
        </div>
      </div>
    </header>
  )
}
