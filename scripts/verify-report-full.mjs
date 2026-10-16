/**
 * 验证报告页图1 布局完整渲染（匿名模式，octocat）
 * 检查各区块 DOM 存在性 + 整页截图
 * 用法：node scripts/verify-report-full.mjs
 */
import { launch } from 'puppeteer-core'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const browser = await launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1536, height: 1024 },
})
const page = await browser.newPage()
try {
  await page.goto('http://127.0.0.1:5173/report/octocat?year=2025', {
    waitUntil: 'networkidle0',
    timeout: 30000,
  })
  await page.waitForFunction(
    () =>
      document.body.innerText.includes('年度开发者贡献报告') ||
      document.body.innerText.includes('速率限制') ||
      document.body.innerText.includes('未找到'),
    { timeout: 30000, polling: 500 },
  )
  await new Promise((r) => setTimeout(r, 3500)) // 等 ECharts 渲染

  const bodyText = await page.evaluate(() => document.body.innerText)
  const checks = {
    '主标题': bodyText.includes('年度开发者贡献报告'),
    '副标题': bodyText.includes('代码记录成长 · 贡献见证坚持'),
    'Better Code': bodyText.includes('Better Code · Better Tomorrow'),
    '用户资料条(@octocat)': bodyText.includes('@octocat'),
    '8指标卡(总提交次数)': bodyText.includes('总提交次数'),
    '同比vs去年': bodyText.includes('vs 2024'),
    '热力图': bodyText.includes('全年贡献热力图'),
    '最长连续贡献': bodyText.includes('最长连续贡献'),
    '本年首次提交': bodyText.includes('本年首次提交'),
    '寄语(代码不只是工作)': bodyText.includes('代码不只是工作'),
    '年度其他数据': bodyText.includes('年度其他数据'),
    '热门仓库Top5': bodyText.includes('年度热门仓库') || bodyText.includes('热门公开仓库'),
    '编程语言占比': bodyText.includes('编程语言占比'),
    '语言字节数Top3': bodyText.includes('语言字节数'),
    '提交趋势': bodyText.includes('提交趋势'),
    '常用开发语言Top3': bodyText.includes('常用开发语言'),
    '开发活跃度': bodyText.includes('开发活跃度'),
    '底部寄语(愿2026)': bodyText.includes('愿 2026'),
  }
  console.log('图1 布局区块检查:')
  for (const [k, v] of Object.entries(checks)) console.log(`  ${v ? '✓' : '✗'} ${k}`)

  const scrollH = await page.evaluate(() => document.documentElement.scrollHeight)
  console.log('页面总高度:', scrollH, 'px')

  await page.screenshot({ path: 'shots/report-v2-full.png', fullPage: true })
  console.log('整页截图: shots/report-v2-full.png')
} finally {
  await browser.close()
}
