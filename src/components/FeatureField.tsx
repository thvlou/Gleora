import { useEffect, useRef } from 'react'

import { FEATURES } from '../features.ts'
import type { FieldScene } from '../field/FieldScene.ts'
import styles from './FeatureField.module.css'

// 피쳐 9개 3D 필드 (three.js). 배경 셰이더 위에 투명 캔버스로 얹는다.
// three.js 와 모델은 표지가 뜬 뒤 잠시 있다가 미리 내려받아(표지 첫 로딩을 늦추지 않게),
// 로고를 눌렀을 때 바로 펼쳐지게 한다.
export function FeatureField({ open }: { open: boolean }) {
  const root = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const labels = useRef<(HTMLSpanElement | null)[]>([])
  const scene = useRef<FieldScene | null>(null)

  const openRef = useRef(open)
  const startRef = useRef<() => void>(() => {})

  useEffect(() => {
    const el = root.current
    const cv = canvas.current
    if (!cv || !el) return
    let alive = true
    let field: FieldScene | null = null
    const start = () =>
      import('../field/FieldScene.ts')
        .then(({ FieldScene }) => {
          if (!alive || field) return
          field = new FieldScene(cv, FEATURES, labels.current as HTMLElement[])
          field.onVisibleChange = (visible) => {
            el.style.visibility = visible ? 'visible' : 'hidden'
          }
          scene.current = field
          field.load()
          field.setOpen(openRef.current)
        })
        .catch((e) => console.warn('Failed to start 3D field', e)) // WebGL 이 없는 환경 등
    const preload = window.setTimeout(start, 1200)
    startRef.current = start
    return () => {
      alive = false
      window.clearTimeout(preload)
      field?.dispose()
      scene.current = null
    }
  }, [])


  useEffect(() => {
    openRef.current = open
    if (open && !scene.current) startRef.current()
    scene.current?.setOpen(open)
  }, [open])

  return (
    <div ref={root} className={styles.field} data-open={open ? '' : undefined} style={{ visibility: 'hidden' }}>
      <canvas ref={canvas} className={styles.canvas} />
      <ul className={styles.labels} aria-label="피쳐">
        {FEATURES.map((f, i) => (
          <li key={f.key}>
            <span
              ref={(node) => {
                labels.current[i] = node
              }}
              className={styles.label}
            >
              {f.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
