/**
 * RepositoryRanking：年度热门仓库 Top 5（第四行左侧）
 * 表格布局：排名 / 仓库名称(含描述) / 语言 / Star / Fork / 年度提交数
 * 排序口径在数据层确定并随数据展示（sortNote）。
 */
import type { RepositoryRankItem } from '../types/report'
import { formatNumber } from '../utils/date'

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
    <div className="card p-5 flex flex-col min-w-0">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[#e6edf3]">
          {data.sortedByCommits ? '年度热门仓库' : '热门公开仓库'} (Top {items.length || 5})
        </h2>
        <a
          href={`https://github.com/${encodeURIComponent(username)}?tab=repositories`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-[#58a6ff] hover:underline whitespace-nowrap"
        >
          查看全部 →
        </a>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-[#8b949e]">
          <p>暂无仓库数据</p>
          <p className="mt-1 text-xs text-[#6e7681]">{data.sortNote}</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-[#8b949e] border-b border-[#30363d]">
                  <th className="py-2 pr-2 text-left font-normal w-8">排名</th>
                  <th className="py-2 pr-3 text-left font-normal">仓库名称</th>
                  <th className="py-2 pr-3 text-left font-normal">语言</th>
                  <th className="py-2 pr-3 text-right font-normal">Star</th>
                  <th className="py-2 pr-3 text-right font-normal">Fork</th>
                  <th className="py-2 text-right font-normal">提交</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.fullName} className="border-b border-[#21262d] last:border-0">
                    <td className="py-2.5 pr-2 mono-num text-[#8b949e]">{item.rank}</td>
                    <td className="py-2.5 pr-3 min-w-0">
                      <a
                        href={item.htmlUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#58a6ff] hover:underline font-medium block truncate max-w-[200px]"
                        title={item.fullName}
                      >
                        {item.name}
                      </a>
                      {item.description && (
                        <span className="block text-xs text-[#6e7681] truncate max-w-[220px]">
                          {item.description}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-[#8b949e]">
                      {item.language || '—'}
                    </td>
                    <td className="py-2.5 pr-3 text-right mono-num text-[#e6edf3]">
                      {formatNumber(item.stars)}
                    </td>
                    <td className="py-2.5 pr-3 text-right mono-num text-[#e6edf3]">
                      {formatNumber(item.forks)}
                    </td>
                    <td className="py-2.5 text-right mono-num text-[#e6edf3]">
                      {item.yearlyCommits !== null ? formatNumber(item.yearlyCommits) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-[#6e7681]">{data.sortNote}</p>
        </>
      )}
    </div>
  )
}
