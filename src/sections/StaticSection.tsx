import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'

import { FeatureField } from '../components/FeatureField.tsx'
import { LogoLetter } from '../components/LogoLetter.tsx'
import { ShaderCanvas } from '../components/ShaderCanvas.tsx'
import { Stage } from '../components/Stage.tsx'
import { imageSource } from '../effects/imageSource.ts'
import type { Shader } from '../lib/custom-effect-runtime/types.ts'
import { LOGO_LETTERS, STATIC_LOGO_BOX } from '../logo.ts'
import { LENS_IMAGE_1, LENS_IMAGE_2, LENS_IMAGE_3, STATIC_FILL_CHAIN } from '../shaders.ts'
import image1 from '../assets/images/image-1.png'
import image2 from '../assets/images/image-2.png'
import image3 from '../assets/images/image-3.png'
import styles from './StaticSection.module.css'

const IMAGES = [
  { src: image1, shaders: LENS_IMAGE_1, rect: { x: 63, y: 583, w: 970, h: 955 } },
  { src: image2, shaders: LENS_IMAGE_2, rect: { x: 1097, y: -224, w: 1041, h: 1237 } },
  { src: image3, shaders: LENS_IMAGE_3, rect: { x: -146, y: -122, w: 1179, h: 516 } },
]

// 이미지 비트맵을 Lens distortion 앞에 넣는다 (HTML-in-Canvas 없이 색수차가 보이게).
// 비트맵을 불러오기 전이나 WebGPU 가 없으면 원본 이미지를 그린다.
function LensImage({ src, lens }: { src: string; lens: Shader[] }) {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  useEffect(() => {
    let alive = true
    const img = new Image()
    img.src = src
    img
      .decode()
      .then(() => createImageBitmap(img))
      .then((b) => (alive ? setBitmap(b) : b.close()))
      .catch((e) => console.warn('Failed to load image for lens effect', e))
    return () => {
      alive = false
    }
  }, [src])
  const shaders = useMemo(() => (bitmap ? [imageSource(bitmap), ...lens] : null), [bitmap, lens])

  const plain = (
    <div className={styles.imageFill}>
      <img alt="" className={styles.imageImg} src={src} />
    </div>
  )
  return shaders ? <ShaderCanvas className={styles.imageFill} shaders={shaders} fallback={plain} /> : plain
}

// 호버 동안 TICK 마다 지지직 — 글자 떨림, 노랑·빨강 잔상, 스파크.
// 색은 이미지 색수차 테두리에서 가져왔다.
const TICK = 45
const SPARK_COLORS = ['#ffd044', '#ff2a1f', '#ffb949']

const rand = (min: number, max: number) => min + Math.random() * (max - min)
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]

// 글자 테두리 근처 두 점을 지그재그로 잇는다 (로고 박스 좌표, sparks 는 40px 여유)
function sparkPath() {
  const l = pick(LOGO_LETTERS)
  const ox = l.rect.x - STATIC_LOGO_BOX.x + 40
  const oy = l.rect.y - STATIC_LOGO_BOX.y + 40
  const side = Math.random() < 0.5 ? -1 : 1
  let x = ox + (side < 0 ? 0 : l.rect.w) + rand(-4, 4)
  let y = oy + rand(0, l.rect.h)
  const pts = [`${x.toFixed(1)},${y.toFixed(1)}`]
  const steps = 3 + Math.floor(Math.random() * 4)
  for (let i = 0; i < steps; i++) {
    x += side * rand(4, 12)
    y += rand(-10, 10)
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return pts.join(' ')
}

function useStatic() {
  const logo = useRef<HTMLButtonElement>(null)
  const letters = useRef<(HTMLDivElement | null)[]>([])
  const yellows = useRef<(HTMLDivElement | null)[]>([])
  const reds = useRef<(HTMLDivElement | null)[]>([])
  const sparks = useRef<SVGSVGElement>(null)
  const timer = useRef<number | null>(null)

  const zap = () => {
    const burst = Math.random() < 0.18 // 가끔 크게 튄다
    const amp = burst ? 2.6 : 1
    logo.current?.style.setProperty('--shake-x', `${rand(-1.5, 1.5) * amp}px`)
    logo.current?.style.setProperty('--shake-y', `${rand(-1, 1) * amp}px`)

    LOGO_LETTERS.forEach((_, i) => {
      const el = letters.current[i]
      const y = yellows.current[i]
      const r = reds.current[i]
      if (!el || !y || !r) return
      el.style.transform = `translate(${rand(-2, 2) * amp}px, ${rand(-1.5, 1.5) * amp}px) skewX(${rand(-4, 4) * amp}deg)`
      // 잔상은 글자 밖으로 삐져나온 띠로 보이게 가끔 잘라낸다
      const band = () => (Math.random() < 0.45 ? `inset(${rand(0, 60)}% 0 ${rand(0, 40)}% 0)` : 'none')
      y.style.opacity = String(rand(0.55, 0.95))
      y.style.transform = `translate(${rand(-7, -2) * amp}px, ${rand(-2, 2)}px)`
      y.style.clipPath = band()
      r.style.opacity = String(rand(0.35, 0.8))
      r.style.transform = `translate(${rand(2, 6) * amp}px, ${rand(-2, 2)}px)`
      r.style.clipPath = band()
    })

    if (sparks.current) {
      const n = Math.random() < 0.35 ? 0 : 1 + Math.floor(Math.random() * (burst ? 4 : 2))
      sparks.current.innerHTML = Array.from({ length: n }, () => {
        const c = pick(SPARK_COLORS)
        return `<polyline points="${sparkPath()}" fill="none" stroke="${c}" stroke-width="${rand(1, 2.2).toFixed(2)}" stroke-linejoin="bevel" opacity="${rand(0.6, 1).toFixed(2)}" style="filter:drop-shadow(0 0 3px ${c})"/>`
      }).join('')
    }
  }

  const start = () => {
    if (timer.current != null) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    letters.current.forEach((el) => el && (el.style.transition = 'none'))
    logo.current?.setAttribute('data-charged', '')
    zap()
    timer.current = window.setInterval(zap, TICK)
  }

  const stop = () => {
    if (timer.current != null) window.clearInterval(timer.current)
    timer.current = null
    logo.current?.removeAttribute('data-charged')
    letters.current.forEach((el) => {
      if (!el) return
      el.style.transition = 'transform 160ms ease-out'
      el.style.transform = ''
    })
    ;[...yellows.current, ...reds.current].forEach((g) => g && (g.style.opacity = '0'))
    if (sparks.current) sparks.current.innerHTML = ''
  }

  useEffect(() => () => {
    if (timer.current != null) window.clearInterval(timer.current)
  }, [])

  return { logo, letters, yellows, reds, sparks, start, stop }
}

// 표지 ↔ 메인. 로고를 누르면 표지(로고·이미지)가 물러나고 같은 배경 위에 피쳐 9개가 화면 가득 펼쳐진다.
function useEntered(logo: RefObject<HTMLElement | null>, back: RefObject<HTMLButtonElement | null>) {
  const [entered, setEntered] = useState(false)
  const first = useRef(true)

  useEffect(() => {
    if (!entered) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setEntered(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [entered])

  // 전환하면 포커스를 다음 화면의 첫 조작으로 옮긴다 (첫 렌더는 건드리지 않음)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    ;(entered ? back.current : logo.current)?.focus({ preventScroll: true })
  }, [entered, back, logo])

  return [entered, setEntered] as const
}

export function StaticSection() {
  const { logo, letters, yellows, reds, sparks, start, stop } = useStatic()
  const back = useRef<HTMLButtonElement>(null)
  const [entered, setEntered] = useEntered(logo, back)

  const enter = () => {
    stop()
    setEntered(true)
  }

  return (
    <section className={styles.section} aria-label="Gleora">
      <ShaderCanvas className={styles.fill} shaders={STATIC_FILL_CHAIN} />
      <Stage>
        <div className={styles.cover} data-away={entered ? '' : undefined} inert={entered}>
          <button
            ref={logo}
            type="button"
            className={styles.logo}
            style={{ left: STATIC_LOGO_BOX.x, top: STATIC_LOGO_BOX.y, width: STATIC_LOGO_BOX.w, height: STATIC_LOGO_BOX.h }}
            onPointerEnter={start}
            onPointerLeave={stop}
            onClick={enter}
            aria-label="Gleora — 피쳐 보기"
          >
            {LOGO_LETTERS.map((l, i) => {
              const mask = { maskImage: `url("${l.src}")` } as CSSProperties
              return (
                <LogoLetter
                  key={l.name}
                  letter={l}
                  origin={STATIC_LOGO_BOX}
                  innerRef={(el) => {
                    letters.current[i] = el
                  }}
                >
                  <div
                    ref={(el) => {
                      yellows.current[i] = el
                    }}
                    className={`${styles.ghost} ${styles.ghostYellow}`}
                    style={mask}
                  />
                  <div
                    ref={(el) => {
                      reds.current[i] = el
                    }}
                    className={`${styles.ghost} ${styles.ghostRed}`}
                    style={mask}
                  />
                </LogoLetter>
              )
            })}
            <svg ref={sparks} className={styles.sparks} aria-hidden="true" />
          </button>
          {IMAGES.map(({ src, shaders, rect }) => (
            <div key={src} className={styles.image} style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}>
              <LensImage src={src} lens={shaders} />
            </div>
          ))}
        </div>
      </Stage>
      <FeatureField open={entered} />
      <button
        ref={back}
        type="button"
        className={styles.back}
        data-show={entered ? '' : undefined}
        tabIndex={entered ? 0 : -1}
        aria-hidden={!entered}
        onClick={() => setEntered(false)}
      >
        ← Gleora
      </button>
    </section>
  )
}
