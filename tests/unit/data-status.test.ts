import { describe, expect, it } from 'vitest'
import {
  complete,
  empty,
  error,
  partial,
  unsupported,
  type DataState,
} from '../../src/types/data-status'

describe('指标数据状态', () => {
  it('complete 状态携带值', () => {
    const s = complete(42, '口径说明', 'source')
    expect(s).toEqual({
      status: 'complete',
      value: 42,
      note: '口径说明',
      source: 'source',
    })
  })

  it('empty / unsupported / error 状态值为 null', () => {
    expect(empty().value).toBeNull()
    expect(unsupported('无法还原').note).toBe('无法还原')
    expect(error('请求失败').status).toBe('error')
    expect(error('请求失败').value).toBeNull()
  })

  it('partial 状态保留部分值', () => {
    const s = partial(10, '仅覆盖部分仓库')
    expect(s.status).toBe('partial')
    expect(s.value).toBe(10)
  })

  it('UI 层判断逻辑：error 状态下不展示值', () => {
    const s: DataState<number> = error('接口限流')
    const hasValue = s.value !== null && s.status !== 'error'
    expect(hasValue).toBe(false)
  })

  it('empty 状态不展示值', () => {
    const s: DataState<number> = empty()
    const hasValue = s.value !== null && s.status !== 'error'
    expect(hasValue).toBe(false)
  })
})
