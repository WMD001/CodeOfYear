/**
 * 指标数据状态（需求文档第十一节）
 * 每个指标必须具有明确的数据状态，禁止用零值掩盖接口失败。
 */
export type DataStatus =
  | 'complete' // 完整：数据已按预定口径获取
  | 'partial' // 部分：受接口时间范围、分页或数据可用性限制
  | 'empty' // 暂无数据：当前没有可展示的数据
  | 'unsupported' // 不支持统计：公开 API 无法可靠还原该指标
  | 'error' // 获取失败：请求出现错误

/**
 * 带状态的指标值。value 为 null 时表示该状态无可用数据。
 */
export interface DataState<T> {
  status: DataStatus
  value: T | null
  /** 统计口径 / 数据来源说明（可解释性要求） */
  note?: string
  /** 数据来源标识，如 "GitHub GraphQL · contributionsCollection" */
  source?: string
}

/** 构造一个完整状态 */
export function complete<T>(value: T, note?: string, source?: string): DataState<T> {
  return { status: 'complete', value, note, source }
}

/** 构造一个部分状态 */
export function partial<T>(value: T, note?: string, source?: string): DataState<T> {
  return { status: 'partial', value, note, source }
}

/** 构造一个空状态 */
export function empty<T>(note?: string): DataState<T> {
  return { status: 'empty', value: null, note }
}

/** 构造一个不支持统计状态 */
export function unsupported<T>(note?: string): DataState<T> {
  return { status: 'unsupported', value: null, note }
}

/** 构造一个错误状态 */
export function error<T>(note?: string): DataState<T> {
  return { status: 'error', value: null, note }
}
