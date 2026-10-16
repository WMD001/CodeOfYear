/**
 * ECharts 按需引入与封装
 * 只注册本项目使用到的图表与组件，减小包体。
 */
import * as echarts from 'echarts/core'
import { BarChart, HeatmapChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useRef, type RefObject } from 'react'

echarts.use([
  HeatmapChart,
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  VisualMapComponent,
  CanvasRenderer,
])

export type { EChartsType } from 'echarts/core'

/**
 * useECharts：管理图表实例生命周期
 * - 容器引用
 * - option 变化时增量更新
 * - 窗口 resize 自适应
 * - 组件卸载时销毁实例
 */
export function useECharts<O>(
  containerRef: RefObject<HTMLDivElement | null>,
  option: O,
): echarts.ECharts | null {
  const chartRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const chart = echarts.init(containerRef.current, 'dark', {
      renderer: 'canvas',
    })
    chartRef.current = chart

    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      chart.dispose()
      chartRef.current = null
    }
  }, [containerRef])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    // @ts-expect-error ECharts 泛型约束宽松，运行时按 option 结构渲染
    chart.setOption(option, { notMerge: false })
  }, [option])

  return chartRef.current
}

export default echarts
