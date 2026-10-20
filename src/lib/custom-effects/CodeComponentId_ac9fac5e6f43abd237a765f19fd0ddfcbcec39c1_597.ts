// @ts-nocheck

// Property metadata is only used in Figma Design, so this is a no-op.
function defineProperties(
  _component: unknown,
  _properties: unknown,
): void {}

export default function Effect() { }
function finiteNumber(value, fallback) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}
function colorSpaceParam(params) {
    const raw = params.colorSpace;
    const value = raw != null && typeof raw === 'object'
        ? raw.characters
        : raw;
    return value === 'Linear' ? 1 : 0;
}
function writeColorParam(params, name, fallbackR, fallbackG, fallbackB, fallbackA, target, offset) {
    const value = params[name] || {};
    target[offset] = finiteNumber(value.r, fallbackR);
    target[offset + 1] = finiteNumber(value.g, fallbackG);
    target[offset + 2] = finiteNumber(value.b, fallbackB);
    target[offset + 3] = finiteNumber(value.a, fallbackA);
}
function uniformDataChanged(data, lastData) {
    for (let i = 0; i < data.length; i++) {
        if (data[i] !== lastData[i]) {
            return true;
        }
    }
    return false;
}
export function setup(device, frame) {
    const wgsl = `
diagnostic(off,derivative_uniformity);
struct Uniforms {
  colorSpace: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
  redTint: vec4f,
  greenTint: vec4f,
  blueTint: vec4f,
};
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var inputTex: texture_2d<f32>;

struct VsIn {
  @location(0) pos: vec2f,
  @location(1) uv: vec2f,
};
struct VsOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex fn vs_main(in: VsIn) -> VsOut {
  var out: VsOut;
  out.position = vec4f(in.pos, 0.0, 1.0);
  out.uv = in.uv;
  return out;
}

@fragment fn fs_main(@location(0) outputUv: vec2f) -> @location(0) vec4f {
  let redTint = u.redTint;
  let greenTint = u.greenTint;
  let blueTint = u.blueTint;
  let colorSpace = i32(u.colorSpace);
  let orig = textureSampleLevel(inputTex, samp, outputUv, 0.0);
  // Optionally linearize input (colorSpace == 1 => Linear).
  var linearRgb: vec3f;
  if (colorSpace == 1) {
    linearRgb = pow(max(orig.rgb, vec3f(0.0)), vec3f(2.2));
  } else {
    linearRgb = orig.rgb;
  }
  // For each channel, lerp between the original channel value and the tint color's
  // contribution, using the tint alpha as the blend factor.
  let r = mix(linearRgb.r, dot(linearRgb, redTint.rgb), redTint.a);
  let g = mix(linearRgb.g, dot(linearRgb, greenTint.rgb), greenTint.a);
  let b = mix(linearRgb.b, dot(linearRgb, blueTint.rgb), blueTint.a);
  // Re-encode to sRGB if linearized.
  var outRgb: vec3f;
  if (colorSpace == 1) {
    outRgb = pow(max(vec3f(r, g, b), vec3f(0.0)), vec3f(1.0 / 2.2));
  } else {
    outRgb = vec3f(r, g, b);
  }
  return vec4f(outRgb, orig.a);
}
`;
    frame.state.module = device.createShaderModule({ code: wgsl });
    frame.state.pipeline = null;
    frame.state.pipelineFormat = null;
    frame.state.vertexBuffers = [{
            arrayStride: 16,
            attributes: [
                { shaderLocation: 0, format: 'float32x2', offset: 0 },
                { shaderLocation: 1, format: 'float32x2', offset: 8 },
            ],
        }];
    frame.state.quad = device.createBuffer({
        size: 6 * 4 * 4,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: true,
    });
    new Float32Array(frame.state.quad.getMappedRange()).set([
        -1, -1, 0, 1,
        1, -1, 1, 1,
        -1, 1, 0, 0,
        -1, 1, 0, 0,
        1, -1, 1, 1,
        1, 1, 1, 0,
    ]);
    frame.state.quad.unmap();
    frame.state.uniformBuf = device.createBuffer({
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    frame.state.uniformData = new Float32Array(16);
    frame.state.lastUniformData = new Float32Array(16);
    frame.state.lastUniformData.fill(Number.NaN);
    frame.state.sampler = device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge',
    });
    frame.state.placeholder = device.createTexture({
        size: [1, 1, 1],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    device.queue.writeTexture({ texture: frame.state.placeholder }, new Uint8Array([0, 0, 0, 0]), { bytesPerRow: 4 }, { width: 1, height: 1, depthOrArrayLayers: 1 });
    frame.state.placeholderView = frame.state.placeholder.createView();
    frame.state.inputTexture = null;
    frame.state.inputView = null;
    frame.state.bindGroup = null;
    frame.state.outputTexture = null;
    frame.state.outputView = null;
}
export function render(device, frame) {
    const params = frame.params || {};
    const uniformData = frame.state.uniformData;
    uniformData[0] = colorSpaceParam(params);
    writeColorParam(params, 'redTint', 1, 0, 0, 1, uniformData, 4);
    writeColorParam(params, 'greenTint', 0, 1, 0, 1, uniformData, 8);
    writeColorParam(params, 'blueTint', 0, 0, 1, 1, uniformData, 12);
    if (uniformDataChanged(uniformData, frame.state.lastUniformData)) {
        device.queue.writeBuffer(frame.state.uniformBuf, 0, uniformData);
        frame.state.lastUniformData.set(uniformData);
    }
    const outputFormat = frame.output.format;
    if (frame.state.pipeline == null || frame.state.pipelineFormat !== outputFormat) {
        frame.state.pipeline = device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: frame.state.module,
                entryPoint: 'vs_main',
                buffers: frame.state.vertexBuffers,
            },
            fragment: {
                module: frame.state.module,
                entryPoint: 'fs_main',
                targets: [{ format: outputFormat }],
            },
            primitive: { topology: 'triangle-list' },
        });
        frame.state.pipelineFormat = outputFormat;
        // Bind groups created from an automatic pipeline layout are pipeline-specific.
        frame.state.bindGroup = null;
    }
    const inputTexture = frame.input != null
        ? frame.input
        : frame.state.placeholder;
    if (frame.state.inputTexture !== inputTexture) {
        frame.state.inputTexture = inputTexture;
        frame.state.inputView = frame.input != null
            ? frame.input.createView()
            : frame.state.placeholderView;
        frame.state.bindGroup = null;
    }
    if (frame.state.bindGroup == null) {
        frame.state.bindGroup = device.createBindGroup({
            layout: frame.state.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: frame.state.uniformBuf } },
                { binding: 1, resource: frame.state.sampler },
                { binding: 2, resource: frame.state.inputView },
            ],
        });
    }
    if (frame.state.outputTexture !== frame.output) {
        frame.state.outputTexture = frame.output;
        frame.state.outputView = frame.output.createView();
    }
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
        colorAttachments: [{
                view: frame.state.outputView,
                loadOp: 'clear',
                clearValue: { r: 0, g: 0, b: 0, a: 0 },
                storeOp: 'store',
            }],
    });
    pass.setPipeline(frame.state.pipeline);
    pass.setBindGroup(0, frame.state.bindGroup);
    pass.setVertexBuffer(0, frame.state.quad);
    pass.draw(6);
    pass.end();
    device.queue.submit([encoder.finish()]);
}
defineProperties(Effect, {
    redTint: {
        type: "color",
        label: "Red",
        defaultValue: { r: 1, g: 0, b: 0, a: 1 },
    },
    greenTint: {
        type: "color",
        label: "Green",
        defaultValue: { r: 0, g: 1, b: 0, a: 1 },
    },
    blueTint: {
        type: "color",
        label: "Blue",
        defaultValue: { r: 0, g: 0, b: 1, a: 1 },
    },
    colorSpace: {
        type: "string",
        label: "Color space",
        defaultValue: "sRGB",
        control: "select",
        options: [
            { value: "sRGB", label: "sRGB" },
            { value: "Linear", label: "Linear" },
        ],
    },
});

export const manifest = {
  "name": "Channel mixer",
  "version": 2,
  "isAnimated": false,
  "usesMouse": false
}
