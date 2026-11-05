import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HomePage from '../../src/pages/HomePage'

// 简化导航断言：不实际路由跳转，仅校验跳转目标由 useNavigate 触发
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => vi.fn((to: string) => {
      window.__navTarget = to
    }),
  }
})

declare global {
  interface Window {
    __navTarget?: string
  }
}

beforeEach(() => {
  window.__navTarget = undefined
})

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <HomePage />
    </MemoryRouter>,
  )
}

describe('HomePage 首页查询', () => {
  it('渲染标题、副标题与查询表单', () => {
    renderHome()
    expect(
      screen.getByRole('heading', { level: 1, name: /用数据回顾/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/生成一屏可分享的年度摘要/),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('GitHub 用户名')).toBeInTheDocument()
    expect(screen.getByLabelText('统计年份')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '生成我的年度报告' }),
    ).toBeInTheDocument()
  })

  it('提交后跳转到 /report/:username?year=YYYY', async () => {
    const user = userEvent.setup()
    renderHome()
    await user.type(screen.getByLabelText('GitHub 用户名'), 'octocat')
    await user.click(screen.getByRole('button', { name: '生成我的年度报告' }))
    expect(window.__navTarget).toBe('/report/octocat?year=2026')
  })

  it('空用户名提示错误', async () => {
    const user = userEvent.setup()
    renderHome()
    await user.click(screen.getByRole('button', { name: '生成我的年度报告' }))
    expect(screen.getByRole('alert')).toHaveTextContent('请输入 GitHub 用户名')
    expect(window.__navTarget).toBeUndefined()
  })

  it('非法用户名提示格式错误', async () => {
    const user = userEvent.setup()
    renderHome()
    await user.type(screen.getByLabelText('GitHub 用户名'), '-bad-name-')
    await user.click(screen.getByRole('button', { name: '生成我的年度报告' }))
    expect(screen.getByRole('alert')).toHaveTextContent('用户名格式不正确')
    expect(window.__navTarget).toBeUndefined()
  })

  it('年份选择器默认当前年份', () => {
    renderHome()
    const select = screen.getByLabelText('统计年份') as HTMLSelectElement
    expect(select.value).toBe(String(new Date().getFullYear()))
  })

  it('提供示例报告入口', () => {
    renderHome()
    expect(screen.getByText('The Octocat')).toBeInTheDocument()
    expect(screen.getByText('Linus Torvalds')).toBeInTheDocument()
    expect(screen.getByText('Dan Abramov')).toBeInTheDocument()
  })
})
