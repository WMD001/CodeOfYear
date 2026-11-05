import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DevTokenDialog from '../../src/components/DevTokenDialog'

describe('DevTokenDialog 开发环境 Token 弹窗', () => {
  it('开发环境显示入口，保存后写入 localStorage 并回调', async () => {
    const onSaved = vi.fn()
    const user = userEvent.setup()
    render(<DevTokenDialog onSaved={onSaved} />)

    await user.click(screen.getByRole('button', { name: '开发 Token' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/未配置/)).toBeInTheDocument()

    await user.type(screen.getByLabelText('GitHub Token'), 'ghp_test1234567890')
    await user.click(screen.getByRole('button', { name: '保存并刷新' }))

    expect(localStorage.getItem('gyr_github_token')).toBe('ghp_test1234567890')
    expect(onSaved).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('清除 Token 后回调并删除本地存储', async () => {
    localStorage.setItem('gyr_github_token', 'ghp_oldtoken12345')
    const onSaved = vi.fn()
    const user = userEvent.setup()
    render(<DevTokenDialog onSaved={onSaved} />)

    await user.click(screen.getByRole('button', { name: '开发 Token' }))
    expect(await screen.findByText(/已配置/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '清除 Token' }))

    expect(localStorage.getItem('gyr_github_token')).toBeNull()
    expect(onSaved).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('空 Token 保存时提示错误且不写入', async () => {
    const user = userEvent.setup()
    render(<DevTokenDialog />)

    await user.click(screen.getByRole('button', { name: '开发 Token' }))
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: '保存并刷新' }))

    expect(screen.getByRole('alert')).toHaveTextContent('请输入 Token')
    expect(localStorage.getItem('gyr_github_token')).toBeNull()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})