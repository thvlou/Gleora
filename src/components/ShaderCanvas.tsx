import { useCallback, useState, type ReactNode } from 'react'

import type { HtmlInCanvasElement, Shader } from '../lib/custom-effect-runtime/types.ts'
import { useShaderRuntime } from '../lib/custom-effect-runtime/useShaderRuntime.ts'

// DOM 을 복사하지 않는(HTML-in-Canvas 불필요) 셰이더 체인을 캔버스 하나에 그린다.
// ShaderFill 과 같지만 체인을 받고, WebGPU 가 없으면 fallback 을 그린다.
// shaders 배열의 정체성이 바뀌면 런타임이 setup 을 다시 돌므로 모듈 상수나 useMemo 로 넘긴다.
export function ShaderCanvas({
  shaders,
  className,
  fallback = null,
}: {
  shaders: Shader[]
  className?: string
  fallback?: ReactNode
}) {
  const [canvas, setCanvas] = useState<HtmlInCanvasElement | null>(null)
  const { error } = useShaderRuntime({ canvas, shaders, hasChildren: false })
  const canvasRef = useCallback((el: HTMLCanvasElement | null) => {
    setCanvas(el as HtmlInCanvasElement | null)
  }, [])

  return error ? (
    <>{fallback}</>
  ) : (
    // 크기를 CSS 로 고정해야 한다 — 비워 두면 런타임이 바꾼 canvas.width 가 다시 레이아웃 크기가 되어 끝없이 커진다.
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', pointerEvents: 'none', width: '100%', height: '100%' }}
    />
  )
}
