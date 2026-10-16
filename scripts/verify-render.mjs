/**
 * 无头渲染验证脚本（开发期工具）
 * 连接系统 Chrome 渲染首页与报告页，输出截图与页面文本摘要。
 * 用法：node scripts/verify-render.mjs
 */
import { launch } from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = 'http://127.0.0.1:5173'
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'shots')

mkdirSync(outDir, { recursive: true })

const browser = await launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1440, height: 900 },
})

async function capture(url, name, waitForText, timeoutMs = 25000) {
  const page = await browser.newPage()
  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 })
    // 等待目标文本出现（数据加载或错误提示）
    await page.waitForFunction(
      (text) => document.body.innerText.includes(text),
      { timeout: timeoutMs, polling: 500 },
      waitForText,
    )
  } catch (e) {
    console.log(`[${name}] wait text "${waitForText}" 未出现: ${e.message.split('\n')[0]}`)
  }
  await new Promise((r) => setTimeout(r, 1200))
  const shot = join(outDir, `${name}.png`)
  await page.screenshot({ path: shot, fullPage: false })
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 800))
  console.log(`--- ${name} (${url}) ---`)
  console.log(bodyText.replace(/\n{3,}/g, '\n\n'))
  console.log(`截图: ${shot}`)
  await page.close()
}

try {
  await capture(`${BASE}/`, 'home', 'GitHub Yearly Report')
  await capture(`${BASE}/report/torvalds?year=2025`, 'report', '年度开发者贡献报告', 30000)
} finally {
  await browser.close()
}
