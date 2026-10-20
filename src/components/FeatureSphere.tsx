import { useEffect, useRef } from 'react'

import { FEATURES } from '../features.ts'
import styles from './FeatureSphere.module.css'

// 피쳐 9개를 구 위에 띄운다. motion.dev/ui Gallery 의 Sphere 배치를 관찰해 같은 원리로 다시 만들었다
// (코드는 가져오지 않음):
// - 황금각 피보나치 격자로 구 표면에 고르게 놓고, 카드는 구 바깥을 향한다 (FACE_OUT 만큼)
// - 구 전체를 반지름만큼 뒤로 밀어 맨 앞 카드가 화면 평면(z=0)에 오게 한다
// - 등장은 살짝 넘치는 스프링 + 공통 Z 비틀림이 풀리는 모양, 드래그하면 돌고 놓으면 관성으로 감속
// 좌표는 Stage 의 1920×1080 프레임 기준. 매 프레임 DOM 에 직접 쓴다 (React 렌더 없음).

const RADIUS = 380
const CARD = 250
// 카드가 구 바깥을 향하는 정도. motion.dev 는 1(완전히 바깥)인데, 컷아웃 사물은 가장자리에서
// 옆면만 보이면 선처럼 납작해져서 정면 쪽으로 조금 돌려 둔다.
const FACE_OUT = 0.55
const GOLDEN = Math.PI * (3 - Math.sqrt(5))

const IDLE_YAW = 9 // °/s — 가만히 둘 때 도는 속도
const DRAG_GAIN = 0.28 // ° / px
const INERTIA = 1.4 // 놓은 뒤 기본 속도로 돌아가는 빠르기 (1/s)
const PITCH_LIMIT = 40

// 스프링 (질량 1). 감쇠비 ≈ 0.77 — motion.dev 처럼 살짝 넘쳤다 자리 잡는다.
const SPRING = { k: 170, c: 20 }
const HOVER = { k: 320, c: 28 }
const STAGGER = 0.045 // s
const TWIST = 38 // ° — 등장할 때 풀리는 Z 비틀림

const DEG = Math.PI / 180

// 단위 구 위의 고른 점들. y 는 위가 + (CSS 로 쓸 때 뒤집는다).
const POINTS = FEATURES.map((_, i) => {
  const y = 1 - (2 * i + 1) / FEATURES.length
  const r = Math.sqrt(1 - y * y)
  const t = i * GOLDEN
  return { x: Math.sin(t) * r, y, z: Math.cos(t) * r }
})

type Spring = { x: number; v: number }
const step = (s: Spring, target: number, { k, c }: { k: number; c: number }, dt: number) => {
  s.v += (-k * (s.x - target) - c * s.v) * dt
  s.x += s.v * dt
}

export function FeatureSphere({ open }: { open: boolean }) {
  const root = useRef<HTMLDivElement>(null)
  const cards = useRef<(HTMLLIElement | null)[]>([])
  const openRef = useRef(open)
  const openedAt = useRef(0)

  useEffect(() => {
    openRef.current = open
    openedAt.current = performance.now()
  }, [open])

  useEffect(() => {
    const el = root.current
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let yaw = 20
    let pitch = 12
    let vYaw = IDLE_YAW
    let vPitch = 0
    const progress: Spring[] = FEATURES.map(() => ({ x: 0, v: 0 }))
    const hover: Spring[] = FEATURES.map(() => ({ x: 0, v: 0 }))
    const hovered = FEATURES.map(() => false)

    // 드래그 — 화면(px) 이동을 회전으로. 스테이지 배율은 신경 쓰지 않는다 (느낌만 맞으면 된다).
    let drag: { id: number; x: number; y: number; t: number } | null = null
    const onDown = (e: PointerEvent) => {
      if (!openRef.current || e.button !== 0) return
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() }
      el.setPointerCapture(e.pointerId)
      el.dataset.dragging = ''
      vYaw = vPitch = 0
    }
    const onMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      const now = performance.now()
      const dt = Math.max((now - drag.t) / 1000, 1 / 240)
      const dYaw = (e.clientX - drag.x) * DRAG_GAIN
      const dPitch = -(e.clientY - drag.y) * DRAG_GAIN
      yaw += dYaw
      pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch + dPitch))
      // 놓았을 때 이어갈 속도 — 최근 움직임에 무게를 둔다
      vYaw = vYaw * 0.6 + (dYaw / dt) * 0.4
      vPitch = vPitch * 0.6 + (dPitch / dt) * 0.4
      drag = { id: drag.id, x: e.clientX, y: e.clientY, t: now }
    }
    const onUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      // 잠깐 멈췄다 놓으면 관성 없이
      if (performance.now() - drag.t > 80) vYaw = vPitch = 0
      drag = null
      delete el.dataset.dragging
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)

    const enters = cards.current.map((card, i) => {
      if (!card) return () => {}
      const on = () => (hovered[i] = true)
      const off = () => (hovered[i] = false)
      card.addEventListener('pointerenter', on)
      card.addEventListener('pointerleave', off)
      return () => {
        card.removeEventListener('pointerenter', on)
        card.removeEventListener('pointerleave', off)
      }
    })

    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      const isOpen = openRef.current
      const since = (now - openedAt.current) / 1000

      if (!drag) {
        const idle = reduced ? 0 : IDLE_YAW
        const ease = 1 - Math.exp(-INERTIA * dt)
        vYaw += (idle - vYaw) * ease
        vPitch += (0 - vPitch) * ease
        yaw += vYaw * dt
        // 가만히 두면 위에서 살짝 내려다보는 각도로 천천히 돌아온다
        pitch += vPitch * dt
        pitch += (12 - pitch) * (1 - Math.exp(-0.6 * dt))
        pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch))
      }

      const cy = Math.cos(yaw * DEG), sy = Math.sin(yaw * DEG)
      const cp = Math.cos(pitch * DEG), sp = Math.sin(pitch * DEG)
      let visible = false

      POINTS.forEach((p, i) => {
        const card = cards.current[i]
        if (!card) return
        // 열릴 때는 위쪽 카드부터 차례로, 닫힐 때는 한꺼번에
        const target = isOpen && since > i * STAGGER ? 1 : 0
        if (reduced) {
          progress[i].x += (target - progress[i].x) * (1 - Math.exp(-10 * dt))
        } else {
          step(progress[i], target, isOpen ? SPRING : { k: 260, c: 32 }, dt)
        }
        step(hover[i], hovered[i] && isOpen && !drag ? 1 : 0, HOVER, dt)
        const t = progress[i].x
        if (t > 0.002 || target > 0) visible = true

        // Y 축(yaw) → X 축(pitch) 회전. y 는 위가 +.
        const x1 = p.x * cy + p.z * sy
        const z1 = -p.x * sy + p.z * cy
        const y2 = p.y * cp - z1 * sp
        const z2 = p.y * sp + z1 * cp

        const az = (Math.atan2(x1, z2) / DEG) * FACE_OUT
        const el = (Math.asin(Math.max(-1, Math.min(1, y2))) / DEG) * FACE_OUT
        // 중심(로고 자리)에서 구 표면으로 퍼져 나간다
        const r = RADIUS * t
        const x = x1 * r
        const y = -y2 * r
        const z = z2 * r - RADIUS
        const scale = (0.25 + 0.75 * t) * (1 + 0.1 * hover[i].x)
        const twist = reduced ? 0 : (1 - t) * TWIST

        // 뒤쪽 반구는 흐리게 — 바깥을 향한 카드라 뒷면(거울상)이 보인다
        const facing = (z2 + 1) / 2 // 0 = 맨 뒤, 1 = 맨 앞
        const depth = 0.16 + 0.84 * facing * facing
        card.style.opacity = String(Math.min(1, Math.max(0, t * 1.6)) * depth)
        card.style.transform =
          `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(2)}px) ` +
          `rotateY(${az.toFixed(2)}deg) rotateX(${el.toFixed(2)}deg) rotateZ(${twist.toFixed(2)}deg) scale(${scale.toFixed(4)})`
        card.toggleAttribute('data-front', facing > 0.55)
      })

      el.style.visibility = visible ? 'visible' : 'hidden'
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      enters.forEach((off) => off())
    }
  }, [])

  return (
    <div
      ref={root}
      className={styles.sphere}
      data-open={open ? '' : undefined}
      aria-hidden={!open}
      style={{ visibility: 'hidden' }}
    >
      <ul className={styles.world} aria-label="피쳐">
        {FEATURES.map((f, i) => (
          <li
            key={f.key}
            ref={(node) => {
              cards.current[i] = node
            }}
            className={styles.card}
            style={{ width: CARD, height: CARD, marginLeft: -CARD / 2, marginTop: -CARD / 2 }}
          >
            <img className={styles.img} src={f.src} alt="" draggable={false} />
            <span className={styles.label}>{f.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
