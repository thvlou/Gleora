import type { Shader } from './lib/custom-effect-runtime/types.ts'
import * as movingGradient from './lib/custom-effects/CodeComponentId_8ce92017e53431a2f04b3574f4ba7c98f6f55f1e_7037.ts'
import * as lensDistortion from './lib/custom-effects/CodeComponentId_505065ffcd2ca330e2c78951d58d5c7d9d78a08d_607.ts'
import { FIGMA_MATTE } from './effects/matte.ts'

// 파라미터는 Figma 에 저작된 값 그대로. 모듈 상수로 두어 객체 정체성이 바뀌지 않게 한다
// (바뀌면 런타임이 setup 을 다시 돈다).

// Frame 1 — 흰 실크 배경
export const SILK_FILL: Shader = {
  setup: movingGradient.setup,
  render: movingGradient.render,
  manifest: movingGradient.manifest,
  params: {
    intensity: 3.200000047683716,
    gradient: {
      stops: [
        { position: 0, color: { r: 1, g: 1, b: 1, a: 1 } },
        { position: 0.5, color: { r: 1, g: 1, b: 1, a: 1 } },
        { position: 0.75, color: { r: 0.9471153616905212, g: 0.9471153616905212, b: 0.9471153616905212, a: 1 } },
        { position: 1, color: { r: 0.9519230723381042, g: 0.9519230723381042, b: 0.9519230723381042, a: 1 } },
      ],
    },
    gradientBalance: 0,
    material: 1,
    morphSpeed: 2,
    detail: 1.7999999523162842,
    twist: 1.600000023841858,
    zoom: 40,
    gradientMethod: 2,
    warp: 1.2000000476837158,
    rotationSpeed: 16,
  },
}

// Frame 2 — 노란 기가 도는 흰 배경
export const STATIC_FILL: Shader = {
  setup: movingGradient.setup,
  render: movingGradient.render,
  manifest: movingGradient.manifest,
  params: {
    intensity: 3.379999876022339,
    gradient: {
      stops: [
        { position: 0, color: { r: 1, g: 0.8167067170143127, b: 0.26682692766189575, a: 0.10000000149011612 } },
        { position: 0.24038460850715637, color: { r: 1, g: 1, b: 1, a: 1 } },
        { position: 1, color: { r: 1, g: 1, b: 1, a: 1 } },
      ],
    },
    gradientBalance: 0,
    material: 0,
    morphSpeed: 3.740000009536743,
    detail: 1.600000023841858,
    twist: 0.949999988079071,
    zoom: 21,
    gradientMethod: 0,
    warp: 0.25999999046325684,
    rotationSpeed: 20,
  },
}

// Frame 2 배경 체인 — 연기의 낮은 알파를 Figma 와 같은 방식으로 합성한다 (effects/matte.ts)
export const STATIC_FILL_CHAIN: Shader[] = [STATIC_FILL, FIGMA_MATTE]

// 로고 글자 — Channel mixer (빨강 채널을 살짝 섞는다). Figma 저작 값.
// 셰이더 원본(CodeComponentId_ac9f…)은 HTML-in-Canvas 가 있어야 글자를 입력으로 받으므로,
// 같은 식을 SVG feColorMatrix 로 옮긴다: 채널 c' = mix(c, dot(rgb, tint.rgb), tint.a). colorSpace 는 sRGB.
type Tint = { r: number; g: number; b: number; a: number }
const LOGO_TINT = {
  redTint: { r: 1, g: 0.19230769574642181, b: 0.19230769574642181, a: 1 },
  greenTint: { r: 0, g: 1, b: 0, a: 1 },
  blueTint: { r: 0, g: 0, b: 1, a: 1 },
}

function mixerRow(tint: Tint, channel: 0 | 1 | 2) {
  const own = [0, 0, 0].map((_, i) => (i === channel ? 1 : 0))
  const row = [tint.r, tint.g, tint.b].map((t, i) => own[i] + (t - own[i]) * tint.a)
  return [...row, 0, 0].join(' ')
}

export const LOGO_TINT_MATRIX = [
  mixerRow(LOGO_TINT.redTint, 0),
  mixerRow(LOGO_TINT.greenTint, 1),
  mixerRow(LOGO_TINT.blueTint, 2),
  '0 0 0 1 0',
].join('  ')

// Frame 2 이미지 — Lens distortion (색수차)
function lens(chromaticMode: number, centre: { x: number; y: number }): Shader[] {
  return [
    {
      setup: lensDistortion.setup,
      render: lensDistortion.render,
      manifest: lensDistortion.manifest,
      params: {
        chromaticMode,
        distortionStrength: 0.30000001192092896,
        aberrationStrength: 0.10000000149011612,
        centre,
        quality: 0,
      },
    },
  ]
}
export const LENS_IMAGE_1 = lens(1, { x: 28, y: 50 })
export const LENS_IMAGE_2 = lens(1, { x: 64, y: 50 })
export const LENS_IMAGE_3 = lens(0, { x: 50, y: 0 })
