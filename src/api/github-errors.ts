/**
 * GitHub API 错误归一化
 * 将 403 / 404 / 422 / 429 / 5xx 映射为明确、可展示的错误类型。
 */

export type GithubErrorKind =
  | 'not_found' // 404：用户名不存在 / 资源不存在
  | 'rate_limited' // 403/429：API 速率限制
  | 'forbidden' // 403：权限不足（如无 Token 访问 GraphQL）
  | 'validation' // 422：参数无效
  | 'network' // 网络层失败
  | 'server' // 5xx
  | 'unknown'

export class GithubApiError extends Error {
  kind: GithubErrorKind
  status: number | null
  /** 原始请求标识，便于排查 */
  endpoint?: string

  constructor(
    kind: GithubErrorKind,
    message: string,
    status: number | null = null,
    endpoint?: string,
  ) {
    super(message)
    this.name = 'GithubApiError'
    this.kind = kind
    this.status = status
    this.endpoint = endpoint
  }
}

/** 将 HTTP 状态码映射为错误类型与用户可读文案 */
export function errorFromResponse(
  status: number,
  endpoint?: string,
  bodyText?: string,
): GithubApiError {
  const rateLimited = bodyText?.includes('rate limit') || status === 429
  if (status === 404) {
    return new GithubApiError(
      'not_found',
      '未找到该 GitHub 用户名或资源，请检查用户名拼写',
      status,
      endpoint,
    )
  }
  if (status === 403 && rateLimited) {
    return new GithubApiError(
      'rate_limited',
      'GitHub API 速率限制已达上限，请稍后再试（匿名模式约 60 次/小时）',
      status,
      endpoint,
    )
  }
  if (status === 403) {
    return new GithubApiError(
      'forbidden',
      '访问被拒绝：该接口可能需要认证 Token',
      status,
      endpoint,
    )
  }
  if (status === 429) {
    return new GithubApiError(
      'rate_limited',
      '请求过于频繁，触发 GitHub 速率限制，请稍后再试',
      status,
      endpoint,
    )
  }
  if (status === 422) {
    return new GithubApiError(
      'validation',
      '请求参数无效（422），请调整统计条件',
      status,
      endpoint,
    )
  }
  if (status >= 500) {
    return new GithubApiError(
      'server',
      'GitHub 服务器暂时不可用（' + status + '），请稍后重试',
      status,
      endpoint,
    )
  }
  return new GithubApiError(
    'unknown',
    'GitHub API 返回异常状态：' + status,
    status,
    endpoint,
  )
}

/** 将网络/解析异常映射为错误类型 */
export function errorFromNetwork(err: unknown, endpoint?: string): GithubApiError {
  if (err instanceof GithubApiError) return err
  if (err instanceof TypeError) {
    return new GithubApiError(
      'network',
      '网络请求失败，请检查网络连接后重试',
      null,
      endpoint,
    )
  }
  return new GithubApiError(
    'unknown',
    err instanceof Error ? err.message : '未知错误',
    null,
    endpoint,
  )
}
