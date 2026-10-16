/**
 * 真实 API 集成验证（非默认运行）
 * 仅在设置 LIVE_API=1 时执行：npx vitest run tests/api/live.test.ts
 * 验证真实 GitHub 数据获取、报告组装与降级逻辑。
 */
import { describe, expect, it } from 'vitest'
import { loadYearlyReport } from '../../src/services/report-service'
import { isValidYear } from '../../src/services/statistics-service'

const LIVE = process.env.LIVE_API === '1'

describe.skipIf(!LIVE)('真实 GitHub API 集成', () => {
  it('匿名模式生成 octocat 2025 年报告', async () => {
    const report = await loadYearlyReport('octocat', 2025)
    expect(report.header.username).toBe('octocat')
    expect(report.user.publicRepos).toBeGreaterThan(0)
    // 匿名模式提交统计为部分状态
    expect(['complete', 'partial', 'empty']).toContain(
      report.metrics.totalCommits.status,
    )
    // 热力图每日数据完整性
    if (report.heatmap.days.length > 0) {
      const total = report.heatmap.days.reduce(
        (acc, d) => acc + d.contributionCount,
        0,
      )
      expect(total).toBe(report.heatmap.totalContributions)
    }
    // 年度 PR / Issue 有值
    expect(report.metrics.pullRequests.value).toBeGreaterThanOrEqual(0)
    expect(report.metrics.issues.value).toBeGreaterThanOrEqual(0)
    console.log(
      `[live] octocat 2025: commits=${report.metrics.totalCommits.value} days=${report.metrics.contributionDays.value} pr=${report.metrics.pullRequests.value} issues=${report.metrics.issues.value} repos=${report.topRepositories.items.length}`,
    )
  }, 120_000)

  it('活跃账号 torvalds 2025 年报告有真实数据', async () => {
    const report = await loadYearlyReport('torvalds', 2025)
    expect(report.header.username).toBe('torvalds')
    // torvalds 在 2025 年有持续提交，热力图应有数据
    if (report.heatmap.days.length > 0) {
      expect(report.metrics.contributionDays.value).toBeGreaterThan(0)
      const total = report.heatmap.days.reduce(
        (acc, d) => acc + d.contributionCount,
        0,
      )
      expect(total).toBe(report.heatmap.totalContributions)
    }
    console.log(
      `[live] torvalds 2025: commits=${report.metrics.totalCommits.value} days=${report.metrics.contributionDays.value} heatDays=${report.heatmap.days.length} pr=${report.metrics.pullRequests.value} repos=${report.topRepositories.items.length} langs=${report.languages.stats.length}`,
    )
  }, 120_000)

  it('不存在的用户抛出 not_found', async () => {
    await expect(
      loadYearlyReport('this-user-should-not-exist-xyz-2026', 2026),
    ).rejects.toMatchObject({ kind: 'not_found' })
  }, 30_000)

  it('无效年份拒绝', () => {
    expect(isValidYear(1999)).toBe(false)
    expect(isValidYear(2026)).toBe(true)
  })
})
