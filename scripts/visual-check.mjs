/**
 * 视觉比对脚本（开发期工具，不进入生产代码）
 * 拦截 api.github.com，返回固定 fixture，绕过匿名限流渲染报告页并整页截图。
 * 用法：node scripts/visual-check.mjs [year] [outName]
 */
import { launch } from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const CHROME =
  process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = process.env.DEV_BASE ?? 'http://127.0.0.1:5173'
const year = Number(process.argv[2] ?? 2025)
const outName = process.argv[3] ?? `current-${year}-full`
const viewportWidth = Number(process.argv[4] ?? 1536)
const viewportHeight = Number(process.argv[5] ?? 1024)
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'shots')
mkdirSync(outDir, { recursive: true })

const ACTIVE_DAYS = 183
const TOTAL_CONTRIBUTIONS = 1248

const TOP_REPOS = [
  ['ai-project-platform', 'AI 智能体项目管理平台', 'Java', 48, 12, 412],
  ['backend-service', '后端服务框架', 'Java', 36, 8, 298],
  ['vue-admin', '后台管理系统', 'TypeScript', 24, 6, 186],
  ['learning-notes', '学习笔记与总结', 'Markdown', 18, 4, 132],
  ['tools', '开发工具集', 'Python', 12, 3, 86],
]
const OTHER_REPOS = [
  'design-tokens', 'data-pipeline', 'mini-redis', 'blog-engine', 'cli-kit',
  'k8s-manifests', 'tiny-compiler', 'webgl-playground', 'algo-notes', 'dotfiles',
  'api-gateway', 'chat-server', 'image-tools', 'mock-server', 'pdf-reader',
  'scheduler', 'sql-labs', 'state-machine', 'tracing-demo', 'wasm-lab',
  'yaml-lint', 'zig-samples', 'rust-cli',
]

function isoDate(d) {
  return d.toISOString().slice(0, 10)
}

function contributionLevel(count, max) {
  if (count <= 0) return 'NONE'
  const r = count / Math.max(max, 1)
  if (r > 0.66) return 'FOURTH_QUARTILE'
  if (r > 0.33) return 'THIRD_QUARTILE'
  return 'SECOND_QUARTILE'
}

function makeCalendar(targetYear, activeTarget, totalTarget) {
  const start = new Date(Date.UTC(targetYear, 0, 1))
  const end = new Date(Date.UTC(targetYear, 11, 31))
  const allDates = []
  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    allDates.push(isoDate(d))
  }
  const active = new Set()
  // 保证一段 38 天的连续贡献
  const streakStart = new Date(Date.UTC(targetYear, 6, 12))
  for (let i = 0; i < 38; i++) {
    const d = new Date(streakStart)
    d.setUTCDate(d.getUTCDate() + i)
    active.add(isoDate(d))
  }
  const streakGuard = new Set()
  for (let k = -1; k <= 38; k++) {
    const d = new Date(streakStart)
    d.setUTCDate(d.getUTCDate() + k)
    streakGuard.add(isoDate(d))
  }
  let seed = 20260101
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 2 ** 32
  }
  while (active.size < Math.min(activeTarget, allDates.length)) {
    const candidate = allDates[Math.floor(rand() * allDates.length)]
    if (!streakGuard.has(candidate)) active.add(candidate)
  }
  const activeList = [...active].sort()
  const counts = new Map(activeList.map((d) => [d, 1]))
  let remaining = Math.max(0, totalTarget - activeList.length)
  let idx = 0
  while (remaining > 0) {
    const d = activeList[idx % activeList.length]
    const add = Math.min(remaining, (idx % 7) + 1)
    counts.set(d, counts.get(d) + add)
    remaining -= add
    idx++
  }
  const max = Math.max(...counts.values())
  const days = allDates.map((date) => {
    const count = counts.get(date) ?? 0
    return { date, contributionCount: count, contributionLevel: contributionLevel(count, max) }
  })
  const weeks = []
  for (let k = 0; k < days.length; k += 7) {
    weeks.push({ firstDay: days[k].date, contributionDays: days.slice(k, k + 7) })
  }
  const sum = days.reduce((acc, d) => acc + d.contributionCount, 0)
  return { totalContributions: sum, weeks }
}

const AVATAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">
<rect width="120" height="120" rx="60" fill="#1f6feb"/>
<text x="60" y="76" font-family="Arial" font-size="46" font-weight="700" fill="#fff" text-anchor="middle">OC</text>
</svg>`

const LANGS = {
  'ai-project-platform': { Java: 920000, TypeScript: 60000, JavaScript: 30000, CSS: 20000 },
  'backend-service': { Java: 760000, Python: 40000, Shell: 12000 },
  'vue-admin': { TypeScript: 520000, Vue: 42000, JavaScript: 22000, CSS: 18000 },
  'learning-notes': { Markdown: 210000, Java: 24000 },
  tools: { Python: 168000, Shell: 22000, Go: 12000 },
  'design-tokens': { TypeScript: 62000, CSS: 24000 },
  'data-pipeline': { Python: 88000, SQL: 14000 },
  'mini-redis': { Go: 72000 },
  'blog-engine': { TypeScript: 68000, JavaScript: 21000 },
  'cli-kit': { Rust: 58000 },
  'k8s-manifests': { Shell: 12000, YAML: 8000 },
  'webgl-playground': { JavaScript: 66000, GLSL: 15000 },
  'algo-notes': { Python: 54000, Markdown: 26000 },
  'api-gateway': { Go: 61000 },
  'chat-server': { TypeScript: 58000 },
}

function buildRepos() {
  const repos = []
  let id = 1
  const push = (name, description, language, stars, forks, month) => {
    repos.push({
      id: id++,
      name,
      full_name: `octocat/${name}`,
      description,
      html_url: `https://github.com/octocat/${name}`,
      language,
      stargazers_count: stars,
      forks_count: forks,
      fork: false,
      created_at: `${year}-${String(month).padStart(2, '0')}-${String((id * 3) % 27 + 1).padStart(2, '0')}T08:00:00Z`,
      pushed_at: `${year}-12-${String((id * 5) % 27 + 1).padStart(2, '0')}T10:00:00Z`,
      size: 1200 + id * 37,
    })
  }
  TOP_REPOS.forEach(([name, desc, lang, stars, forks], i) => push(name, desc, lang, stars, forks, i + 1))
  const otherStars = [8, 5, 3, 2, 0]
  const otherForks = [3, 2, 2, 2, 0]
  OTHER_REPOS.forEach((name, i) => {
    const lang = ['TypeScript', 'Python', 'JavaScript', 'Markdown', 'Go'][i % 5]
    push(name, `octocat 的 ${name} 项目`, lang, otherStars[i] ?? 0, otherForks[i] ?? 0, ((i + 5) % 12) + 1)
  })
  return repos
}

const REPOS = buildRepos()

function commitsFor(repoName) {
  const top = TOP_REPOS.find(([name]) => name === repoName)
  const count = top ? top[5] : 0
  const out = []
  const start = new Date(Date.UTC(year, 0, 2))
  for (let i = 0; i < count; i++) {
    const d = new Date(start)
    d.setUTCDate(d.getUTCDate() + ((i * 3) % 360))
    out.push({
      sha: `${repoName}-${i}-${'0'.repeat(8)}`.slice(0, 40),
      commit: {
        author: { name: 'The Octocat', date: `${isoDate(d)}T12:${String(i % 60).padStart(2, '0')}:00Z` },
        committer: { date: `${isoDate(d)}T12:${String(i % 60).padStart(2, '0')}:00Z` },
        message: `feat: ${repoName} update #${i + 1}`,
      },
      author: { login: 'octocat' },
    })
  }
  return out
}

const COMMITS = new Map(REPOS.map((r) => [r.name, commitsFor(r.name)]))

function searchCount(q) {
  const y2024 = q.includes('created:2024')
  const isPr = q.includes('type:pr')
  if (q.includes('reviewed-by:')) return y2024 ? 229 : 324
  if (q.includes('commenter:')) return y2024 ? 180 : 324
  if (q.includes('type:issue')) {
    if (q.includes('is:open')) return y2024 ? 12 : 18
    return y2024 ? 43 : 52
  }
  if (isPr) {
    if (q.includes('is:merged')) return y2024 ? 48 : 64
    if (q.includes('is:open')) return y2024 ? 6 : 10
    return y2024 ? 64 : 86
  }
  return 0
}

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': '*',
}

function jsonResponse(req, body, status = 200) {
  return req.respond({
    status,
    contentType: 'application/json; charset=utf-8',
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  })
}

async function main() {
  const browser = await launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-gpu',
      '--disable-crash-reporter',
      '--disable-breakpad',
      '--no-first-run',
      '--no-default-browser-check',
    ],
    defaultViewport: { width: viewportWidth, height: viewportHeight, deviceScaleFactor: 1 },
  })
  const page = await browser.newPage()
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') console.log(`[console.${msg.type()}]`, msg.text())
  })
  page.on('pageerror', (err) => console.log('[pageerror]', err.message))
  page.on('requestfailed', (req) => console.log('[requestfailed]', req.url(), req.failure()?.errorText))
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('gyr_github_token', 'mock-token-for-visual-check')
    sessionStorage.clear()
  })

  await page.setRequestInterception(true)
  page.on('request', (req) => {
    const url = req.url()
    try {
      if (url.startsWith('https://api.github.com/') && req.method() === 'OPTIONS') {
        return req.respond({ status: 204, headers: CORS_HEADERS })
      }
      if (url.startsWith('https://avatars.githubusercontent.com/')) {
        return req.respond({ status: 200, contentType: 'image/svg+xml', body: AVATAR_SVG })
      }
      if (url === 'https://api.github.com/graphql') {
        const payload = JSON.parse(req.postData() ?? '{}')
        const from = payload.variables?.from ?? ''
        const to = payload.variables?.to ?? ''
        const calendarYear = Number(from.slice(0, 4))
        const last = calendarYear < year
        const cal = last
          ? makeCalendar(calendarYear, 169, 943)
          : makeCalendar(calendarYear, ACTIVE_DAYS, TOTAL_CONTRIBUTIONS)
        return jsonResponse(req, {
          data: {
            user: {
              contributionsCollection: {
                totalCommitContributions: last ? 943 : 1248,
                totalPullRequestContributions: last ? 64 : 86,
                totalIssueContributions: last ? 43 : 52,
                totalPullRequestReviewContributions: last ? 229 : 324,
                totalRepositoryContributions: last ? 22 : 28,
                contributionCalendar: cal,
              },
            },
          },
        })
      }
      if (url.startsWith('https://api.github.com/search/issues')) {
        const q = decodeURIComponent(new URL(url).searchParams.get('q') ?? '')
        return jsonResponse(req, { total_count: searchCount(q), incomplete_results: false, items: [] })
      }
      if (url.startsWith('https://api.github.com/users/octocat/gists')) {
        const items = Array.from({ length: 6 }, (_, i) => ({
          id: `gist-${i}`,
          description: `gist ${i}`,
          html_url: `https://gist.github.com/octocat/${i}`,
          created_at: `${year}-03-0${i + 1}T00:00:00Z`,
          updated_at: `${year}-03-0${i + 1}T00:00:00Z`,
        }))
        return jsonResponse(req, items)
      }
      if (url.startsWith('https://api.github.com/users/octocat/repos')) {
        return jsonResponse(req, REPOS)
      }
      if (url.startsWith('https://api.github.com/users/octocat')) {
        return jsonResponse(req, {
          login: 'octocat',
          id: 583231,
          avatar_url: 'https://avatars.githubusercontent.com/u/583231?v=4',
          html_url: 'https://github.com/octocat',
          name: 'The Octocat',
          company: '@github',
          blog: 'https://github.blog',
          location: 'San Francisco',
          bio: 'Building things with code · 用代码记录成长',
          public_repos: REPOS.length,
          followers: 37,
          following: 12,
          created_at: '2011-01-25T18:44:36Z',
        })
      }
      const langMatch = url.match(/^https:\/\/api\.github\.com\/repos\/octocat\/([^/]+)\/languages/)
      if (langMatch) {
        return jsonResponse(req, LANGS[langMatch[1]] ?? { TypeScript: 42000, JavaScript: 12000 })
      }
      const commitMatch = url.match(/^https:\/\/api\.github\.com\/repos\/octocat\/([^/]+)\/commits\?(.*)$/)
      if (commitMatch) {
        const qs = new URL(url).searchParams
        const perPage = Number(qs.get('per_page') ?? 30)
        const pageNo = Number(qs.get('page') ?? 1)
        const all = COMMITS.get(commitMatch[1]) ?? []
        const slice = all.slice((pageNo - 1) * perPage, pageNo * perPage)
        return jsonResponse(req, slice)
      }
      if (url.startsWith('https://api.github.com/')) {
        return jsonResponse(req, {}, 404)
      }
    } catch (err) {
      console.error('[mock] error handling', url, err)
      return req.respond({ status: 500, body: 'mock error' })
    }
    return req.continue()
  })

  try {
    await page.goto(`${BASE}/report/octocat?year=${year}`, {
      waitUntil: 'networkidle0',
      timeout: 60000,
    })
    try {
      await page.waitForFunction(
        () => document.body.innerText.includes('年度开发者贡献报告'),
        { timeout: 30000, polling: 500 },
      )
    } catch {
      console.log('--- 等待超时，页面文本 ---')
      console.log(await page.evaluate(() => document.body.innerText))
      await page.screenshot({ path: join(outDir, `${outName}-failed.png`), fullPage: true })
      throw new Error('报告页未渲染')
    }
    await new Promise((r) => setTimeout(r, 3500))

    const bodyText = await page.evaluate(() => document.body.innerText)
    const scrollH = await page.evaluate(() => document.documentElement.scrollHeight)
    console.log('标题存在:', bodyText.includes('年度开发者贡献报告'))
    console.log('页面总高度:', scrollH, 'px')
    console.log('横向溢出:', await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth))
    const layout = await page.evaluate(() =>
      [...document.querySelectorAll('section')].map((s, i) => ({
        section: i,
        height: Math.round(s.getBoundingClientRect().height),
        cards: [...s.children].map((c) => ({
          height: Math.round(c.getBoundingClientRect().height),
          title: c.querySelector('h2')?.textContent?.trim().slice(0, 20),
        })),
      })),
    )
    console.log('区块高度:', JSON.stringify(layout))
    console.log('--- 页面文本 ---')
    console.log(bodyText.replace(/\n{3,}/g, '\n\n').slice(0, 3000))

    await page.screenshot({ path: join(outDir, `${outName}.png`), fullPage: true })
    await page.screenshot({ path: join(outDir, `${outName}-viewport.png`), fullPage: false })
    console.log('截图:', join(outDir, `${outName}.png`))
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
