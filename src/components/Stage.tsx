import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

import { FRAME } from '../logo.ts'
import styles from './Stage.module.css'

// Figma 1920×1080 프레임을 섹션에 cover 로 맞춘다. 안쪽 좌표는 Figma 값을 그대로 쓴다.
export function Stage({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const section = ref.current?.parentElement
    if (!section) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setScale(Math.max(width / FRAME.w, height / FRAME.h))
    })
    ro.observe(section)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={ref} className={styles.stage} style={{ '--scale': scale } as CSSProperties}>
      {children}
    </div>
  )
}
