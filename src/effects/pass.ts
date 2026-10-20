import type { CustomEffectState } from '../lib/custom-effect-runtime/types.ts'

// Figma 셰이더 런타임에 끼워 넣는 우리 쪽 셰이더들의 공통 부분 — 화면을 덮는 삼각형 하나로
// 프래그먼트 셰이더를 한 번 돌린다. 바인딩은 0 샘플러, 1 텍스처, 2 유니폼(선택) 순서.

export const FULLSCREEN_VS = /* wgsl */ `
struct VsOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex fn vs_main(@builtin(vertex_index) index: u32) -> VsOut {
  let positions = array(vec2f(-1.0, -3.0), vec2f(-1.0, 1.0), vec2f(3.0, 1.0));
  let p = positions[index];
  var out: VsOut;
  out.position = vec4f(p, 0.0, 1.0);
  out.uv = vec2f(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
  return out;
}
`

type PassState = {
  module: GPUShaderModule
  sampler: GPUSampler
  uniformBuf: GPUBuffer | null
  pipeline: GPURenderPipeline | null
  pipelineFormat: GPUTextureFormat | null
  source: GPUTexture | null
  bindGroup: GPUBindGroup | null
}

export function setupPass(device: GPUDevice, frame: CustomEffectState, fragment: string, uniformBytes = 0) {
  const state: PassState = {
    module: device.createShaderModule({ code: FULLSCREEN_VS + fragment }),
    sampler: device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    }),
    uniformBuf: uniformBytes
      ? device.createBuffer({ size: uniformBytes, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
      : null,
    pipeline: null,
    pipelineFormat: null,
    source: null,
    bindGroup: null,
  }
  frame.state.pass = state
}

// source 를 읽어 frame.output 에 그린다. uniforms 가 있으면 매 프레임 올린다.
export function renderPass(device: GPUDevice, frame: CustomEffectState, source: GPUTexture, uniforms?: Float32Array) {
  const s = frame.state.pass as PassState
  const output = frame.output!
  if (!s.pipeline || s.pipelineFormat !== output.format) {
    s.pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: s.module, entryPoint: 'vs_main' },
      fragment: { module: s.module, entryPoint: 'fs_main', targets: [{ format: output.format }] },
      primitive: { topology: 'triangle-list' },
    })
    s.pipelineFormat = output.format
    s.bindGroup = null
  }
  // 런타임은 리사이즈 때 중간 텍스처를 새로 만든다 — 정체성이 바뀌면 바인드 그룹을 다시 만든다.
  if (s.source !== source) {
    s.source = source
    s.bindGroup = null
  }
  if (!s.bindGroup) {
    const entries: GPUBindGroupEntry[] = [
      { binding: 0, resource: s.sampler },
      { binding: 1, resource: source.createView() },
    ]
    if (s.uniformBuf) entries.push({ binding: 2, resource: { buffer: s.uniformBuf } })
    s.bindGroup = device.createBindGroup({ layout: s.pipeline.getBindGroupLayout(0), entries })
  }
  if (uniforms && s.uniformBuf) device.queue.writeBuffer(s.uniformBuf, 0, uniforms)

  const encoder = device.createCommandEncoder()
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      { view: output.createView(), loadOp: 'clear', clearValue: { r: 0, g: 0, b: 0, a: 0 }, storeOp: 'store' },
    ],
  })
  pass.setPipeline(s.pipeline)
  pass.setBindGroup(0, s.bindGroup)
  pass.draw(3)
  pass.end()
  device.queue.submit([encoder.finish()])
}
