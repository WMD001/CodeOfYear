/**
 * useReport：报告页数据加载状态机。
 * 处理 加载中 / 成功 / 失败 三种状态，并在参数变化时重新加载。
 */
import { useCallback, useEffect, useState } from 'react'
import { loadYearlyReport } from '../services/report-service'
import { GithubApiError } from '../api/github-errors'
import type { YearlyReport } from '../types/report'

export type ReportLoadState =
  | { phase: 'loading' }
  | { phase: 'success'; report: YearlyReport }
  | { phase: 'error'; message: string; kind?: string }

export function useReport(username: string, year: number) {
  const [state, setState] = useState<ReportLoadState>({ phase: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false
    setState({ phase: 'loading' })

    loadYearlyReport(username, year)
      .then((report) => {
        if (!cancelled) setState({ phase: 'success', report })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message =
          err instanceof Error && err.message
            ? err.message
            : '报告加载失败，请稍后重试'
        const kind = err instanceof GithubApiError ? err.kind : undefined
        setState({ phase: 'error', message, kind })
      })

    return () => {
      cancelled = true
    }
  }, [username, year, reloadKey])

  return { state, reload }
}
