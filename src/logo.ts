import imgG from './assets/logo/G.svg'
import imgL from './assets/logo/l.svg'
import imgE from './assets/logo/e.svg'
import imgO from './assets/logo/o.svg'
import imgR from './assets/logo/r.svg'
import imgA from './assets/logo/a.svg'

// 모든 좌표는 Figma 1920×1080 프레임 기준(px).
export const FRAME = { w: 1920, h: 1080 }

type Rect = { x: number; y: number; w: number; h: number }

export type Letter = {
  name: string
  src: string
  rect: Rect // 프레임 안 위치·크기
  shader: boolean // Figma 에서 Channel mixer 효과가 걸린 글자인지 ('o' 만 없음)
}

export const LOGO_LETTERS: Letter[] = [
  { name: 'G', src: imgG, shader: true, rect: { x: 848, y: 485, w: 47.458, h: 100 } },
  { name: 'l', src: imgL, shader: true, rect: { x: 897.46, y: 493.47, w: 12.076, h: 91.525 } },
  { name: 'e', src: imgE, shader: true, rect: { x: 911.53, y: 517.63, w: 40.297, h: 67.373 } },
  { name: 'o', src: imgO, shader: false, rect: { x: 953.83, y: 519.21, w: 40.297, h: 65.791 } },
  { name: 'r', src: imgR, shader: true, rect: { x: 996.13, y: 518.9, w: 29.492, h: 66.102 } },
  { name: 'a', src: imgA, shader: true, rect: { x: 1027.62, y: 517.63, w: 40.297, h: 67.373 } },
]

// 로고 컴포넌트 박스 (Figma 'Logo Static' 인스턴스)
export const STATIC_LOGO_BOX: Rect = { x: 808, y: 455, w: 302, h: 160 }
