/**
 * RepositoryRanking：年度热门仓库 Top 5
 * 参照设计图：排名圆标 + 仓库名/描述 + 语言胶囊 + Star/Fork/提交。
 * 排序口径在数据层确定，并在表头 tooltip / 底部小字中说明。
 */
import type { RepositoryRankItem } from '../types/report'
import { formatNumber } from '../utils/date'
import { languageColor, languageTextColor } from '../utils/language-colors'

interface Props {
  data: {
    items: RepositoryRankItem[]
    sortNote: string
    sortedByCommits: boolean
  }
  username: string
}

export default function RepositoryRanking({ data, username }: Props) {
  const { items } = data

  return (
    <div className="card p-4 flex flex-col min-w-0 h-full">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <h2
          className="flex items-center gap-2 text-[16px] font-semibold text-[#e6edf3] min-w-0"
          title={data.sortNote}
        >
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="#58a6ff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 2.5h10v11H3zM3 2.5A1.5 1.5 0 0 0 1.5 4v9.5H3" />
            <path d="M5.5 2.5v5l1.5-1 1.5 1v-5" />
          </svg>
          <span className="truncate">
            {data.sortedByCommits ? '年度热门仓库' : '热门公开仓库'} (Top {items.length || 5})
          </span>
        </h2>
        <a
          href={`https://github.com/${encodeURIComponent(username)}?tab=repositories`}
          target="_blank"
          rel="noreferrer"
          className="text-[10.5px] text-[#58a6ff] hover:text-[#79c0ff] whitespace-nowrap"
        >
          查看全部 →
        </a>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-[#8b949e]">
          <p>暂无仓库数据</p>
          <p className="mt-1 text-xs text-[#6e7681]">{data.sortNote}</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-[10.5px] text-[#6e7681] border-b border-white/[0.07]">
                  <th className="py-1.5 pr-1.5 text-left font-normal w-7 whitespace-nowrap">排名</th>
                  <th className="py-1.5 pr-2 text-left font-normal">仓库名称</th>
                  <th className="py-1.5 pr-2 text-left font-normal whitespace-nowrap">语言</th>
                  <th className="py-1.5 pr-2 text-right font-normal whitespace-nowrap">Star</th>
                  <th className="py-1.5 pr-2 text-right font-normal whitespace-nowrap">Fork</th>
                  <th className="py-1.5 text-right font-normal whitespace-nowrap">提交</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.fullName} className="border-b border-white/[0.04] last:border-0">
                    <td className="py-[7px] pr-1.5">
                      <span className="w-5 h-5 rounded-full grid place-items-center bg-[#1a2332] text-[10px] text-[#9aa7b6] ring-1 ring-inset ring-white/[0.06]">
                        {item.rank}
                      </span>
                    </td>
                    <td className="py-[7px] pr-2 min-w-0">
                      <a
                        href={item.htmlUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#79c0ff] hover:underline font-medium block truncate max-w-[180px]"
                        title={item.fullName}
                      >
                        {item.name}
                      </a>
                      {item.description && (
                        <span className="block text-[10.5px] text-[#7d899a] truncate max-w-[230px]">
                          {item.description}
                        </span>
                      )}
                    </td>
                    <td className="py-[7px] pr-2">
                      {item.language ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[9.5px] font-medium whitespace-nowrap"
                          style={{
                            backgroundColor: languageColor(item.language),
                            color: languageTextColor(item.language),
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                          {item.language}
                        </span>
                      ) : (
                        <span className="text-[#5f6b7a]">—</span>
                      )}
                    </td>
                    <td className="py-[7px] pr-2 text-right mono-num text-[#dbe4ee]">
                      {formatNumber(item.stars)}
                    </td>
                    <td className="py-[7px] pr-2 text-right mono-num text-[#dbe4ee]">
                      {formatNumber(item.forks)}
                    </td>
                    <td className="py-[7px] text-right mono-num text-[#dbe4ee]">
                      {item.yearlyCommits !== null ? formatNumber(item.yearlyCommits) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-auto pt-2 text-[10.5px] text-[#7d899a] leading-snug line-clamp-2">
            {data.sortNote}
          </p>
        </>
      )}
    </div>
  )
}
