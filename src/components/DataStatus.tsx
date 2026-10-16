/**
 * DataStatus：指标数据状态徽章（需求文档第十一节）
 * 完整 / 部分 / 暂无数据 / 不支持统计 / 获取失败
 */
import type { DataStatus as Status } from '../types/data-status'

const STATUS_META: Record<Status, { label: string; className: string }> = {
  complete: {
    label: '完整',
    className: 'bg-[#238636]/15 text-[#3fb950] border-[#238636]/40',
  },
  partial: {
    label: '部分',
    className: 'bg-[#d29922]/15 text-[#d29922] border-[#d29922]/40',
  },
  empty: {
    label: '暂无数据',
    className: 'bg-[#6e7681]/15 text-[#8b949e] border-[#3d444d]',
  },
  unsupported: {
    label: '不支持统计',
    className: 'bg-[#6e7681]/15 text-[#8b949e] border-[#3d444d]',
  },
  error: {
    label: '获取失败',
    className: 'bg-[#f85149]/15 text-[#f85149] border-[#f85149]/40',
  },
}

export function DataStatusBadge({ status }: { status: Status }) {
  const meta = STATUS_META[status]
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] leading-none font-medium ${meta.className}`}
      title={statusNote(status)}
    >
      {meta.label}
    </span>
  )
}

function statusNote(status: Status): string {
  switch (status) {
    case 'complete':
      return '数据已按预定口径完整获取'
    case 'partial':
      return '数据受接口时间范围、分页或可用性限制，仅部分统计'
    case 'empty':
      return '当前没有可展示的数据'
    case 'unsupported':
      return '公开 API 无法可靠还原该指标'
    case 'error':
      return '数据请求失败'
  }
}

/** 数据状态说明文本（用于卡片口径提示） */
export function statusNoteText(status: Status): string {
  return statusNote(status)
}
