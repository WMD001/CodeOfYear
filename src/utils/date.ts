/**
 * 日期与时间工具
 * 统一规则：GitHub 数据日期按 UTC 处理，界面展示使用本地时区。
 * 所有年度统计使用 YYYY-MM-DD 字符串比较，避免跨日问题。
 */

/** 年份起始日期（UTC） */
export function yearStartDate(year: number): string {
  return `${year}-01-01`
}

/**
 * 年份统计截止日期：
 * - 过去年份：当年 12-31
 * - 当前年份：今天（不展示未来贡献）
 * - 未来年份：当年 12-31（第一版不用于统计，函数保持语义正确）
 */
export function yearEndDate(year: number, now: Date = new Date()): string {
  const currentYear = now.getUTCFullYear()
  if (year !== currentYear) return `${year}-12-31`
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 月份标签数组：["1月", ..., "12月"] */
export function monthLabels(): string[] {
  return Array.from({ length: 12 }, (_, i) => `${i + 1}月`)
}

/** 格式化 ISO 时间为 YYYY-MM-DD（UTC 视图，用于日期比较与展示） */
export function toDateString(iso: string): string {
  return iso.slice(0, 10)
}

/** 判断 date 是否在 [start, end] 闭区间内（YYYY-MM-DD 字符串比较） */
export function isWithinRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end
}

/** 计算两个日期字符串之间的天数差（end - start，含当日=1） */
export function daysBetween(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00Z`).getTime()
  const e = new Date(`${end}T00:00:00Z`).getTime()
  return Math.round((e - s) / 86_400_000) + 1
}

/**
 * 计算最长连续贡献区间。
 * 输入：按日期升序排列的贡献日数组（只含"有贡献"的日期，YYYY-MM-DD）。
 * 输出：最长连续天数、起止日期；无贡献日返回 null。
 */
export function longestStreak(activeDates: string[]): {
  days: number
  start: string
  end: string
} | null {
  if (activeDates.length === 0) return null
  const sorted = [...activeDates].sort()
  let best: { days: number; start: string; end: string } = {
    days: 1,
    start: sorted[0],
    end: sorted[0],
  }
  let current = { days: 1, start: sorted[0], end: sorted[0] }

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const cur = sorted[i]
    // 相邻（相差 1 天）则延续
    const prevTime = new Date(`${prev}T00:00:00Z`).getTime()
    const curTime = new Date(`${cur}T00:00:00Z`).getTime()
    if (curTime - prevTime === 86_400_000) {
      current.days += 1
      current.end = cur
    } else {
      if (current.days > best.days) best = { ...current }
      current = { days: 1, start: cur, end: cur }
    }
  }
  if (current.days > best.days) best = { ...current }
  return best
}

/** 计算某日是一年中的第几天（1 起） */
export function dayOfYear(dateStr: string): number {
  const year = Number(dateStr.slice(0, 4))
  const start = new Date(`${year}-01-01T00:00:00Z`).getTime()
  const cur = new Date(`${dateStr}T00:00:00Z`).getTime()
  return Math.round((cur - start) / 86_400_000) + 1
}

/** 格式化数字为千分位字符串，如 1248 -> "1,248" */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

/** 格式化日期为中文展示，如 "2026-01-03" -> "2026年1月3日" */
export function formatDateCN(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${y}年${m}月${d}日`
}
