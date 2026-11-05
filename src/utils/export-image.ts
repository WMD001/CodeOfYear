/**
 * PNG 导出：使用 html-to-image 导出完整报告页面
 * - 保持深色主题、字体、图表与颜色
 * - 高清导出（pixelRatio 2）
 * - 导出前暂存滚动位置，导出完成后还原，不破坏页面布局
 */
import { toPng } from 'html-to-image'

export interface ExportResult {
  ok: boolean
  error?: string
}

/**
 * 导出指定 DOM 元素为 PNG 并触发下载。
 * @param element 报告根元素
 * @param fileName 文件名（不含扩展名）
 */
export async function exportElementAsPng(
  element: HTMLElement,
  fileName: string,
): Promise<ExportResult> {
  const scrollX = window.scrollX
  const scrollY = window.scrollY

  try {
    // 宽图（热力图较长）采用全宽导出
    const dataUrl = await toPng(element, {
      pixelRatio: 2,
      backgroundColor: '#0b1120',
      cacheBust: true,
      // 头部的分享/导出/Token 操作不进入图片
      filter: (node) =>
        !(node instanceof HTMLElement && node.dataset.exportIgnore === 'true'),
      width: element.scrollWidth,
      height: element.scrollHeight,
      style: {
        transform: 'none',
        width: `${element.scrollWidth}px`,
        height: `${element.scrollHeight}px`,
      },
    })

    const link = document.createElement('a')
    link.download = `${fileName}.png`
    link.href = dataUrl
    link.click()

    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : '导出失败',
    }
  } finally {
    // 还原滚动位置（导出过程不改变页面布局）
    window.scrollTo(scrollX, scrollY)
  }
}

/** 复制文本到剪贴板，返回是否成功 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // 兜底：旧方案
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(textarea)
      return ok
    } catch {
      return false
    }
  }
}
