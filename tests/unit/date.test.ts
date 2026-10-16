import { describe, expect, it } from 'vitest'
import {
  dayOfYear,
  daysBetween,
  formatDateCN,
  formatNumber,
  isWithinRange,
  longestStreak,
  monthLabels,
  yearEndDate,
  yearStartDate,
} from '../../src/utils/date'

describe('年度日期范围计算', () => {
  it('过去年份的截止日期为当年 12-31', () => {
    expect(yearStartDate(2025)).toBe('2025-01-01')
    expect(yearEndDate(2025, new Date('2026-10-16T00:00:00Z'))).toBe('2025-12-31')
  })

  it('当前年份的截止日期为今日，不包含未来', () => {
    const now = new Date('2026-10-16T08:00:00Z')
    expect(yearEndDate(2026, now)).toBe('2026-10-16')
  })

  it('未来年份的截止日期仍为当年 12-31（不用于统计）', () => {
    expect(yearEndDate(2027, new Date('2026-10-16T00:00:00Z'))).toBe('2027-12-31')
  })

  it('isWithinRange 使用闭区间字符串比较', () => {
    expect(isWithinRange('2026-06-01', '2026-01-01', '2026-12-31')).toBe(true)
    expect(isWithinRange('2026-01-01', '2026-01-01', '2026-12-31')).toBe(true)
    expect(isWithinRange('2025-12-31', '2026-01-01', '2026-12-31')).toBe(false)
  })

  it('daysBetween 计算区间天数（含首尾）', () => {
    expect(daysBetween('2026-01-01', '2026-01-01')).toBe(1)
    expect(daysBetween('2026-01-01', '2026-01-31')).toBe(31)
  })

  it('dayOfYear 计算一年中的第几天', () => {
    expect(dayOfYear('2026-01-01')).toBe(1)
    expect(dayOfYear('2026-02-01')).toBe(32)
    expect(dayOfYear('2026-12-31')).toBe(365)
  })
})

describe('格式工具', () => {
  it('formatNumber 千分位', () => {
    expect(formatNumber(1248)).toBe('1,248')
    expect(formatNumber(0)).toBe('0')
  })

  it('formatDateCN 中文日期', () => {
    expect(formatDateCN('2026-01-03')).toBe('2026年1月3日')
  })

  it('monthLabels 返回 1-12 月标签', () => {
    expect(monthLabels()).toHaveLength(12)
    expect(monthLabels()[0]).toBe('1月')
    expect(monthLabels()[11]).toBe('12月')
  })
})

describe('连续贡献天数计算', () => {
  it('空输入返回 null', () => {
    expect(longestStreak([])).toBeNull()
  })

  it('连续 3 天计算正确', () => {
    const r = longestStreak(['2026-07-12', '2026-07-13', '2026-07-14'])
    expect(r).toEqual({ days: 3, start: '2026-07-12', end: '2026-07-14' })
  })

  it('跨月连续与中断', () => {
    // 7-30, 7-31, 8-1 连续；8-3 中断
    const r = longestStreak([
      '2026-07-30',
      '2026-07-31',
      '2026-08-01',
      '2026-08-03',
    ])
    expect(r).toEqual({ days: 3, start: '2026-07-30', end: '2026-08-01' })
  })

  it('乱序输入同样正确', () => {
    const r = longestStreak(['2026-08-03', '2026-07-13', '2026-07-12', '2026-07-14'])
    expect(r).toEqual({ days: 3, start: '2026-07-12', end: '2026-07-14' })
  })

  it('跨年相邻日期正确判定为连续', () => {
    // 2025-12-31 与 2026-01-01 相差 1 天，属于连续贡献
    const r = longestStreak(['2025-12-31', '2026-01-01'])
    expect(r).toEqual({ days: 2, start: '2025-12-31', end: '2026-01-01' })
  })
})
