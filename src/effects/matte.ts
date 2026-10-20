import type { Shader } from '../lib/custom-effect-runtime/types.ts'
import { renderPass, setupPass } from './pass.ts'

// Moving gradient 는 알파를 곱하지 않은 색(c, a)을 내보내는데, 브라우저 캔버스는 이를 곱해진 값으로
// 읽어 흰 배경 위에서 날아가 버린다. Figma 는 색에 알파를 곱한 뒤 그 값을 다시 straight-alpha 로
// 흰 바탕에 합성한다 — c·a² + (1 − a). Frame 2 연기 픽셀의 바닥값(≈195,190,176)이 이 곡선의
// 최저점(193,188,174)과 맞고, 검정 위 합성(c·a)이었다면 있어야 할 거의 검은 픽셀이 Figma 에는 없다.
// 체인 끝에서 이 합성을 해 불투명하게 내보낸다.
const FS = /* wgsl */ `
@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var inputTex: texture_2d<f32>;

@fragment fn fs_main(in: VsOut) -> @location(0) vec4f {
  let c = textureSampleLevel(inputTex, samp, in.uv, 0.0);
  return vec4f(c.rgb * c.a * c.a + vec3f(1.0 - c.a), 1.0);
}
`

export const FIGMA_MATTE: Shader = {
  setup: (device, frame) => setupPass(device, frame, FS),
  render: (device, frame) => renderPass(device, frame, frame.input!),
  params: {},
  manifest: { name: 'Figma matte (white)', version: 2, isAnimated: false, usesMouse: false },
}
