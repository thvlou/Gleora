import imgG from './assets/logo/G.svg'
import imgL from './assets/logo/l.svg'
import imgE from './assets/logo/e.svg'
import imgO from './assets/logo/o.svg'
import imgR from './assets/logo/r.svg'
import imgA from './assets/logo/a.svg'

// 모든 좌표는 Figma 1920×1080 프레임 기준(px).
export const FRAME = { w: 1920, h: 1080 }

type Rect = { x: number; y: number; w: number; h: number }

// Figma 의 흩뿌려진 상태(Frame 3) 원본 값. 원점은 회전 전 좌상단, m 은 [a, b, c, d]
// (x' = a·x + b·y, y' = c·x + d·y), rot 는 Figma 각도(반시계 +).
type FigmaPlacement = { ox: number; oy: number; w: number; h: number; rot: number; m: [number, number, number, number] }

export type Pose = { x: number; y: number; rot: number; sx: number; sy: number }
export const REST: Pose = { x: 0, y: 0, rot: 0, sx: 1, sy: 1 }

export type Letter = {
  name: string
  src: string
  rect: Rect // 기본 상태(Frame 1/2) 위치·크기
  shader: boolean // Figma 에서 Channel mixer 효과가 걸린 글자인지 ('o' 만 없음)
  scattered: Pose // 기본 상태 대비 흩뿌려진 상태(Frame 3)
}

const LETTERS: Array<Omit<Letter, 'scattered'> & { figma: FigmaPlacement }> = [
  { name: 'G', src: imgG, shader: true, rect: { x: 848, y: 485, w: 47.458, h: 100 },
    figma: { ox: 794, oy: 471.319, w: 59.788, h: 125.982, rot: 15, m: [0.96593, 0.25882, -0.25882, 0.96593] } },
  { name: 'l', src: imgL, shader: true, rect: { x: 897.46, y: 493.47, w: 12.076, h: 91.525 },
    figma: { ox: 911.361, oy: 529, w: 12.076, h: 91.525, rot: -10.583, m: [0.98299, -0.18366, 0.18366, 0.98299] } },
  { name: 'e', src: imgE, shader: true, rect: { x: 911.53, y: 517.63, w: 40.297, h: 67.373 },
    figma: { ox: 933.285, oy: 451, w: 55.558, h: 92.889, rot: -4.775, m: [0.99653, -0.08324, 0.08324, 0.99653] } },
  { name: 'o', src: imgO, shader: false, rect: { x: 953.83, y: 519.21, w: 40.297, h: 65.791 },
    figma: { ox: 960.553, oy: 553.001, w: 48.258, h: 78.79, rot: 12.907, m: [0.97473, 0.22337, -0.22337, 0.97473] } },
  { name: 'r', src: imgR, shader: true, rect: { x: 996.13, y: 518.9, w: 29.492, h: 66.102 },
    figma: { ox: 1019.553, oy: 465, w: 43, h: 96, rot: 0, m: [1, 0, 0, 1] } },
  { name: 'a', src: imgA, shader: true, rect: { x: 1027.62, y: 517.63, w: 40.297, h: 67.373 },
    figma: { ox: 1075.25, oy: 528, w: 53, h: 88, rot: -15.622, m: [0.96306, -0.26928, 0.26928, 0.96306] } },
]

// Figma 배치 → 기본 위치 대비 CSS 변환(중심 기준). Figma 의 반시계 회전은 CSS 에서 음수.
function toPose(rect: Rect, f: FigmaPlacement): Pose {
  const [a, b, c, d] = f.m
  const cx = f.ox + a * (f.w / 2) + b * (f.h / 2)
  const cy = f.oy + c * (f.w / 2) + d * (f.h / 2)
  return {
    x: cx - (rect.x + rect.w / 2),
    y: cy - (rect.y + rect.h / 2),
    rot: -f.rot,
    sx: f.w / rect.w,
    sy: f.h / rect.h,
  }
}

export const LOGO_LETTERS: Letter[] = LETTERS.map(({ figma, ...l }) => ({ ...l, scattered: toPose(l.rect, figma) }))

// 로고 컴포넌트 박스 (Frame 1 'Logo' 인스턴스, Frame 2 'Logo Static' 인스턴스)
export const SILK_LOGO_BOX: Rect = { x: 792, y: 445, w: 337, h: 189 }
export const STATIC_LOGO_BOX: Rect = { x: 808, y: 455, w: 302, h: 160 }
