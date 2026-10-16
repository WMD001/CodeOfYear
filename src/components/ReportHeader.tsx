/**
 * ReportHeader：报告头部（第一行）
 * GitHub 标识 + 年度报告标题 + 用户头像/用户名 + 数据统计范围 + 最后更新时间
 */
import type { ReportHeader as Header, UserProfileData } from '../types/report'

interface Props {
  header: Header
  user: UserProfileData
}

function GithubMark({ size = 28 }: { size?: number }) {
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
    <header className="card px-5 py-4 flex flex-col md:flex-row md:items-center gap-4">
      {/* 左：GitHub 标识 + 标题 */}
      <div className="flex items-center gap-3">
        <GithubMark />
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#e6edf3] leading-tight">
            GitHub {header.year} 年度开发者贡献报告
          </h1>
          <p className="text-xs md:text-sm text-[#8b949e] mt-0.5">
            代码记录成长 · 贡献见证坚持
          </p>
        </div>
      </div>

      {/* 右：用户信息 + 统计范围 */}
      <div className="flex flex-1 items-center justify-start md:justify-end gap-4">
        <div className="flex items-center gap-3 text-right">
          <div className="hidden sm:block">
            <p className="font-medium text-[#e6edf3] leading-tight">
              {user.displayName || header.username}
            </p>
            <a
              href={user.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[#58a6ff] hover:underline"
            >
              @{header.username}
            </a>
            {user.bio && (
              <p className="text-xs text-[#8b949e] max-w-[220px] truncate mt-0.5">
                {user.bio}
              </p>
            )}
          </div>
          <img
            src={user.avatarUrl}
            alt={`${header.username} 头像`}
            width={44}
            height={44}
            className="rounded-full border border-[#30363d]"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="hidden lg:block text-xs text-[#8b949e] border-l border-[#30363d] pl-4 leading-relaxed">
          <p className="flex gap-2">
            <span>公开仓库 {user.publicRepos}</span>
            <span>·</span>
            <span>Followers {user.followers}</span>
            <span>·</span>
            <span>Following {user.following}</span>
          </p>
          <p>加入 GitHub：{user.createdAt.slice(0, 10)}</p>
        </div>
        <div className="text-xs text-[#8b949e] border-l border-[#30363d] pl-4 leading-relaxed">
          <p>
            统计范围：{header.startDate} ~ {header.endDate}
          </p>
          <p>
            数据来源：GitHub 公开 API · 最后更新：{updatedAt}
          </p>
        </div>
      </div>
    </header>
  )
}
