/**
 * 验证首页「配置 Token」链接点击后弹出模态框
 * 用法：node scripts/verify-token-modal.mjs
 */
import { launch } from 'puppeteer-core'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const browser = await launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1440, height: 900 },
})
const page = await browser.newPage()
try {
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle0' })
  await page.waitForFunction(
    () => document.body.innerText.includes('配置 Token（可选，提升 API 请求额度）'),
    { timeout: 10000 },
  )
  // 点击链接
  const clicked = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    const btn = btns.find((b) => b.innerText.includes('配置 Token'))
    if (!btn) return 'no-button'
    btn.click()
    return 'clicked'
  })
  console.log('click:', clicked)
  await new Promise((r) => setTimeout(r, 500))
  const hasDialog = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]')
    return dlg ? dlg.innerText.slice(0, 200) : null
  })
  console.log('dialog:', hasDialog ? '出现 ✓' : '未出现 ✗')
  if (hasDialog) console.log('dialog text:', hasDialog.replace(/\n+/g, ' | '))
} finally {
  await browser.close()
}
