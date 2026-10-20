import type { Shader } from '../lib/custom-effect-runtime/types.ts'
import { renderPass, setupPass } from './pass.ts'

// HTML-in-Canvas 없이도 이미지에 Figma 셰이더를 걸기 위한 첫 단계. 런타임의 DOM 복사 대신
// 비트맵을 텍스처로 올려 object-fit: cover 로 그린다. 다음 셰이더는 이것을 입력으로 받는다.
const FS = /* wgsl */ `
@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var imageTex: texture_2d<f32>;
@group(0) @binding(2) var<uniform> fit: vec4f; // xy=scale, zw=offset

@fragment fn fs_main(in: VsOut) -> @location(0) vec4f {
  return textureSampleLevel(imageTex, samp, in.uv * fit.xy + fit.zw, 0.0);
}
`

export function imageSource(image: ImageBitmap): Shader {
  return {
    setup(device, frame) {
      setupPass(device, frame, FS, 16)
      const texture = device.createTexture({
        size: [image.width, image.height, 1],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      })
      // Figma 셰이더(Lens distortion 등)는 알파가 곱해진 입력을 기대한다.
      device.queue.copyExternalImageToTexture(
        { source: image },
        { texture, premultipliedAlpha: true },
        [image.width, image.height],
      )
      frame.state.image = texture
    },
    render(device, frame) {
      const { width, height } = frame.output!
      const s = Math.max(width / image.width, height / image.height)
      const sx = width / (image.width * s)
      const sy = height / (image.height * s)
      renderPass(device, frame, frame.state.image as GPUTexture, new Float32Array([sx, sy, (1 - sx) / 2, (1 - sy) / 2]))
    },
    params: {},
    manifest: { name: 'Image source', version: 2, isAnimated: false, usesMouse: false },
  }
}
