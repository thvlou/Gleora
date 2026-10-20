import { useEffect, useRef } from 'react'

import { LogoLetter } from '../components/LogoLetter.tsx'
import { Stage } from '../components/Stage.tsx'
import { ShaderFill } from '../lib/custom-effect-runtime/index.tsx'
import { LOGO_LETTERS, REST, SILK_LOGO_BOX, type Pose } from '../logo.ts'
import { SILK_FILL } from '../shaders.ts'
import styles from './SilkSection.module.css'

// 호버하면 Frame 3 배치로 흩어져 머물고, 떠나면 로고 중심을 한 바퀴 감아 돌며 제자리로.
const SCATTER = { duration: 520, stagger: 18, spin: -28 }
const SWIRL = { duration: 860, stagger: 34, spin: 360 }

// 기본 글자들의 중심 — 소용돌이의 축
const CENTER = (() => {
  const xs = LOGO_LETTERS.flatMap((l) => [l.rect.x, l.rect.x + l.rect.w])
  const ys = LOGO_LETTERS.flatMap((l) => [l.rect.y, l.rect.y + l.rect.h])
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 }
})()

const easeOutBack = (t: number) => {
  const c = 1.4
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2
}
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const wrapDeg = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180

type Tween = { from: Pose; to: Pose; start: number; duration: number; spin: number; ease: (t: number) => number }

// 로고 중심 기준 극좌표로 보간한다 — 반지름은 줄고 각도는 spin 만큼 더 돈다.
function poseAt(i: number, tw: Tween, t: number): Pose {
  const e = tw.ease(t)
  const { rect } = LOGO_LETTERS[i]
  const base = { x: rect.x + rect.w / 2 - CENTER.x, y: rect.y + rect.h / 2 - CENTER.y }
  const a = { x: base.x + tw.from.x, y: base.y + tw.from.y }
  const b = { x: base.x + tw.to.x, y: base.y + tw.to.y }
  const angA = Math.atan2(a.y, a.x)
  const angB = Math.atan2(b.y, b.x)
  const dAng = (wrapDeg(((angB - angA) * 180) / Math.PI) + tw.spin) * (Math.PI / 180)
  const r = lerp(Math.hypot(a.x, a.y), Math.hypot(b.x, b.y), e)
  const ang = angA + dAng * e
  return {
    x: r * Math.cos(ang) - base.x,
    y: r * Math.sin(ang) - base.y,
    rot: lerp(tw.from.rot, tw.to.rot, e) + tw.spin * e,
    sx: lerp(tw.from.sx, tw.to.sx, e),
    sy: lerp(tw.from.sy, tw.to.sy, e),
  }
}

const toCss = (p: Pose) => `translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg) scale(${p.sx}, ${p.sy})`

function useScatter() {
  const els = useRef<(HTMLDivElement | null)[]>([])
  const poses = useRef<Pose[]>(LOGO_LETTERS.map(() => ({ ...REST })))
  const tweens = useRef<(Tween | null)[]>([])
  const raf = useRef<number | null>(null)

  const tick = (now: number) => {
    let running = false
    tweens.current.forEach((tw, i) => {
      if (!tw) return
      const t = Math.min(1, Math.max(0, (now - tw.start) / tw.duration))
      const p = t >= 1 ? tw.to : poseAt(i, tw, t)
      poses.current[i] = p
      const el = els.current[i]
      if (el) el.style.transform = toCss(p)
      if (t < 1) running = true
      else tweens.current[i] = null
    })
    raf.current = running ? requestAnimationFrame(tick) : null
  }

  const go = (scattered: boolean) => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const cfg = scattered ? SCATTER : SWIRL
    const now = performance.now()
    tweens.current = LOGO_LETTERS.map((l, i) => {
      const cur = poses.current[i]
      return {
        from: { ...cur, rot: wrapDeg(cur.rot) }, // 이전 소용돌이에서 남은 회전을 정리
        to: scattered ? l.scattered : REST,
        start: now + (reduce ? 0 : i * cfg.stagger),
        duration: reduce ? 160 : cfg.duration,
        spin: reduce ? 0 : cfg.spin,
        ease: scattered ? easeOutBack : easeInOutCubic,
      }
    })
    if (raf.current == null) raf.current = requestAnimationFrame(tick)
  }

  useEffect(() => () => {
    if (raf.current != null) cancelAnimationFrame(raf.current)
  }, [])

  return { els, go }
}

export function SilkSection() {
  const { els, go } = useScatter()

  return (
    <section className={styles.section} aria-label="Gleora">
      <ShaderFill className={styles.fill} shader={SILK_FILL} />
      <Stage>
        <div
          className={styles.logo}
          style={{ left: SILK_LOGO_BOX.x, top: SILK_LOGO_BOX.y, width: SILK_LOGO_BOX.w, height: SILK_LOGO_BOX.h }}
          onPointerEnter={() => go(true)}
          onPointerLeave={() => go(false)}
          role="img"
          aria-label="Gleora"
        >
          {LOGO_LETTERS.map((l, i) => (
            <LogoLetter
              key={l.name}
              letter={l}
              origin={SILK_LOGO_BOX}
              innerRef={(el) => {
                els.current[i] = el
              }}
            />
          ))}
        </div>
      </Stage>
    </section>
  )
}
