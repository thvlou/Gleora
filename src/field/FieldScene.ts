import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

import type { Feature } from '../features.ts'

// 피쳐 9개를 화면 전체에 퍼뜨린 3D 필드.
// motion.dev Sphere 의 원리(스프링 등장 · 드래그 관성 · 회전하는 3D 배치)를 이어 쓰되, 작은 구 대신 화면 비율에
// 맞춘 큰 고리에 놓아 앞쪽 오브젝트가 화면 가장자리까지 닿게 한다. 방위각은 40° 간격, 높이는 9단계를
// 4씩 건너뛰며 나눠 주어 앞뒤로 스쳐 가는 오브젝트끼리 같은 높이에 겹치지 않는다.
// 오브젝트는 늘 카메라 쪽을 보게 해 잘 읽히고, 필드 전체가 천천히 돌며 화면을 가로지른다.

const FOV = 30
const DISTANCE = 10
const MODEL_SIZE = 2.4 // GLB 정규화 크기 (최대 변)
const OBJECT_SIZE = 0.18 // 깊이 0 에서 화면 짧은 변 대비 오브젝트 크기
const SPREAD = { x: 0.8, y: 0.62, z: 2.6 } // 화면 반폭·반높이 대비 고리 반지름·높이, z 는 월드 단위

const IDLE_YAW = 6 // °/s
const DRAG_GAIN = 0.18 // ° / px
const INERTIA = 1.2
const PITCH_LIMIT = 28

const SPRING = { k: 150, c: 19 } // 감쇠비 ≈ 0.78 — 살짝 넘쳤다 자리 잡는다
const CLOSE = { k: 240, c: 31 }
const HOVER = { k: 300, c: 26 }
const STAGGER = 0.06
const TWIST = 0.55 // rad — 등장할 때 풀리는 Z 비틀림

const DEG = Math.PI / 180

type Spring = { x: number; v: number }
const step = (s: Spring, target: number, { k, c }: { k: number; c: number }, dt: number) => {
  s.v += (-k * (s.x - target) - c * s.v) * dt
  s.x += s.v * dt
}

type Item = {
  feature: Feature
  base: THREE.Vector3 // 고리 위 자리 (xz 단위 원, y -1…1)
  anchor: THREE.Group // 위치·크기 (카메라를 바라본다)
  sway: THREE.Group // 제자리 흔들림
  mixer: THREE.AnimationMixer | null
  hoverActions: THREE.AnimationAction[]
  loadedAt: number | null
  progress: Spring
  hover: Spring
  label: HTMLElement
}

export class FieldScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100)
  private items: Item[]
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2(9, 9)
  private size = { w: 1, h: 1, unit: 1, rx: 1, ry: 1 }
  private reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  private open = false
  private openedAt = 0
  private raf = 0
  private last = 0
  private yaw = 15
  private pitch = 8
  private vYaw = IDLE_YAW
  private vPitch = 0
  private drag: { id: number; x: number; y: number; t: number; moved: number } | null = null
  private hovered = -1
  private ro: ResizeObserver
  private disposed = false
  onVisibleChange: (visible: boolean) => void = () => {}

  constructor(
    private canvas: HTMLCanvasElement,
    features: Feature[],
    labels: HTMLElement[],
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.toneMapping = THREE.NeutralToneMapping
    this.renderer.toneMappingExposure = 1.05

    // 금속 재질이 미리보기처럼 보이려면 환경광이 필요하다 (외부 HDR 없이 방 환경을 굽는다)
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environmentIntensity = 0.95
    pmrem.dispose()
    const key = new THREE.DirectionalLight(0xffffff, 1.4)
    key.position.set(-3, 5, 6)
    this.scene.add(key)

    this.camera.position.set(0, 0, DISTANCE)
    // 뒤쪽 오브젝트를 배경(연기 낀 흰 바탕) 색으로 살짝 옅게 — 깊이감
    this.scene.fog = new THREE.Fog(0xf3f0e8, DISTANCE - 1, DISTANCE + 9)

    this.items = features.map((feature, i) => {
      // 고리 위 자리 — 방위각 40° 간격, 높이는 -1…1 을 9단계로 나눠 4씩 건너뛰며
      const n = features.length
      const y = (((i * 4) % n) / (n - 1)) * 2 - 1
      const t = (i / n) * Math.PI * 2
      const anchor = new THREE.Group()
      const sway = new THREE.Group()
      anchor.add(sway)
      anchor.visible = false
      anchor.userData.index = i
      this.scene.add(anchor)
      return {
        feature,
        base: new THREE.Vector3(Math.sin(t), y, Math.cos(t)),
        anchor,
        sway,
        mixer: null,
        hoverActions: [],
        loadedAt: null,
        progress: { x: 0, v: 0 },
        hover: { x: 0, v: 0 },
        label: labels[i],
      }
    })

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(canvas)
    this.resize()

    canvas.addEventListener('pointerdown', this.onDown)
    canvas.addEventListener('pointermove', this.onMove)
    canvas.addEventListener('pointerup', this.onUp)
    canvas.addEventListener('pointercancel', this.onUp)
    canvas.addEventListener('pointerleave', this.onLeave)
  }

  /** 모델을 내려받는다. 표지가 보일 때 미리 불러 두면 들어갈 때 바로 뜬다. */
  load() {
    const loader = new GLTFLoader()
    this.items.forEach((item) => {
      if (item.loadedAt != null) return
      item.loadedAt = -1
      loader.load(
        item.feature.model,
        (gltf) => {
          if (this.disposed) return
          item.sway.add(gltf.scene)
          if (gltf.animations.length) {
            const mixer = new THREE.AnimationMixer(gltf.scene)
            const actions = gltf.animations.map((clip) => mixer.clipAction(clip))
            if (item.feature.loop && !this.reduced) {
              actions.forEach((a) => a.play())
            } else {
              actions.forEach((a) => {
                a.setLoop(THREE.LoopOnce, 1)
                a.clampWhenFinished = false
              })
              item.hoverActions = actions
            }
            item.mixer = mixer
          }
          item.loadedAt = performance.now()
          this.wake()
        },
        undefined,
        (err) => console.warn(`Failed to load ${item.feature.key} model`, err),
      )
    })
  }

  setOpen(open: boolean) {
    if (this.open === open) return
    this.open = open
    this.openedAt = performance.now()
    if (!open) this.setHovered(-1)
    this.wake()
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    this.canvas.removeEventListener('pointerdown', this.onDown)
    this.canvas.removeEventListener('pointermove', this.onMove)
    this.canvas.removeEventListener('pointerup', this.onUp)
    this.canvas.removeEventListener('pointercancel', this.onUp)
    this.canvas.removeEventListener('pointerleave', this.onLeave)
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      mesh.geometry?.dispose()
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []
      mats.forEach((m) => m.dispose())
    })
    this.scene.environment?.dispose()
    this.renderer.dispose()
  }

  private resize() {
    const w = Math.max(1, this.canvas.clientWidth)
    const h = Math.max(1, this.canvas.clientHeight)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    // 깊이 0 에서 보이는 반높이·반폭 (월드 단위)
    const halfH = DISTANCE * Math.tan((FOV / 2) * DEG)
    const halfW = halfH * this.camera.aspect
    this.size = {
      w,
      h,
      unit: (OBJECT_SIZE * 2 * Math.min(halfH, halfW * 0.9)) / MODEL_SIZE,
      rx: halfW * SPREAD.x,
      ry: halfH * SPREAD.y,
    }
    this.wake()
  }

  private wake() {
    if (this.raf || this.disposed) return
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.frame)
  }

  // --- 입력 ---

  private toPointer(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect()
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
  }

  private onDown = (e: PointerEvent) => {
    if (!this.open || e.button !== 0) return
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 }
    this.canvas.setPointerCapture(e.pointerId)
    this.canvas.dataset.dragging = ''
    this.vYaw = this.vPitch = 0
  }

  private onMove = (e: PointerEvent) => {
    this.toPointer(e)
    const d = this.drag
    if (!d || e.pointerId !== d.id) return
    const now = performance.now()
    const dt = Math.max((now - d.t) / 1000, 1 / 240)
    const dYaw = (e.clientX - d.x) * DRAG_GAIN
    const dPitch = (e.clientY - d.y) * DRAG_GAIN
    this.yaw += dYaw
    this.pitch = THREE.MathUtils.clamp(this.pitch + dPitch, -PITCH_LIMIT, PITCH_LIMIT)
    this.vYaw = this.vYaw * 0.6 + (dYaw / dt) * 0.4
    this.vPitch = this.vPitch * 0.6 + (dPitch / dt) * 0.4
    this.drag = { ...d, x: e.clientX, y: e.clientY, t: now, moved: d.moved + Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) }
  }

  private onUp = (e: PointerEvent) => {
    const d = this.drag
    if (!d || e.pointerId !== d.id) return
    if (performance.now() - d.t > 80) this.vYaw = this.vPitch = 0
    this.drag = null
    delete this.canvas.dataset.dragging
  }

  private onLeave = () => {
    if (!this.drag) this.pointer.set(9, 9)
  }

  private setHovered(index: number) {
    if (index === this.hovered) return
    this.hovered = index
    this.canvas.style.cursor = index >= 0 ? 'pointer' : ''
    const item = this.items[index]
    if (item && !this.reduced) item.hoverActions.forEach((a) => a.reset().play())
  }

  // --- 프레임 ---

  private frame = (now: number) => {
    this.raf = 0
    const dt = Math.min((now - this.last) / 1000, 1 / 30)
    this.last = now
    const time = now / 1000
    const { unit, rx, ry, w, h } = this.size

    if (!this.drag) {
      const ease = 1 - Math.exp(-INERTIA * dt)
      this.vYaw += ((this.reduced ? 0 : IDLE_YAW) - this.vYaw) * ease
      this.vPitch += (0 - this.vPitch) * ease
      this.yaw += this.vYaw * dt
      this.pitch += this.vPitch * dt
      this.pitch += (8 - this.pitch) * (1 - Math.exp(-0.5 * dt))
      this.pitch = THREE.MathUtils.clamp(this.pitch, -PITCH_LIMIT, PITCH_LIMIT)
    }

    // 호버 — 드래그 중이 아니고 열려 있을 때만
    if (this.open && !this.drag) {
      this.raycaster.setFromCamera(this.pointer, this.camera)
      const hit = this.raycaster.intersectObjects(
        this.items.filter((it) => it.anchor.visible && it.progress.x > 0.6).map((it) => it.anchor),
        true,
      )[0]
      let o: THREE.Object3D | null = hit?.object ?? null
      while (o && o.userData.index === undefined) o = o.parent
      this.setHovered(o ? (o.userData.index as number) : -1)
    } else if (this.drag) {
      this.setHovered(-1)
    }

    const cy = Math.cos(this.yaw * DEG), sy = Math.sin(this.yaw * DEG)
    const cp = Math.cos(this.pitch * DEG), sp = Math.sin(this.pitch * DEG)
    const since = (now - this.openedAt) / 1000
    const v = new THREE.Vector3()
    let visible = false

    this.items.forEach((item, i) => {
      const ready = item.loadedAt != null && item.loadedAt > 0
      const startAt = ready ? Math.max(0, (item.loadedAt! - this.openedAt) / 1000) : Infinity
      const target = this.open && ready && since > startAt + i * STAGGER ? 1 : 0
      if (this.reduced) item.progress.x += (target - item.progress.x) * (1 - Math.exp(-10 * dt))
      else step(item.progress, target, this.open ? SPRING : CLOSE, dt)
      step(item.hover, i === this.hovered ? 1 : 0, HOVER, dt)
      const t = item.progress.x

      item.anchor.visible = t > 0.002
      if (!item.anchor.visible) {
        item.label.style.opacity = '0'
        return
      }
      visible = true

      // 필드 회전: yaw(Y) → pitch(X), 그다음 화면 비율로 늘린다
      const b = item.base
      const x1 = b.x * cy + b.z * sy
      const z1 = -b.x * sy + b.z * cy
      const y2 = b.y * cp - z1 * sp
      const z2 = b.y * sp + z1 * cp
      const bob = this.reduced ? 0 : Math.sin(time * 0.7 + i * 1.9) * 0.08
      const tx = x1 * rx, ty = y2 * ry + bob, tz = z2 * SPREAD.z
      // 로고 자리(화면 중심)에서 퍼져 나온다
      item.anchor.position.set(tx * t, ty * t, tz * t)
      const s = unit * (0.15 + 0.85 * t) * (1 + 0.14 * item.hover.x)
      item.anchor.scale.setScalar(s)
      item.anchor.lookAt(this.camera.position)
      item.anchor.rotateZ(this.reduced ? 0 : (1 - t) * TWIST)

      // 제자리 흔들림 + 호버하면 정면으로 돌아선다
      const swayY = this.reduced ? 0 : Math.sin(time * 0.45 + i * 2.3) * 0.38
      const swayX = this.reduced ? 0 : Math.sin(time * 0.38 + i * 1.1) * 0.12
      item.sway.rotation.set(swayX * (1 - item.hover.x), swayY * (1 - item.hover.x) - 0.25 * (1 - item.hover.x), 0)

      item.mixer?.update(dt)

      // 이름표 — 오브젝트 아래
      const facing = (z2 + 1) / 2 // 0 = 맨 뒤, 1 = 맨 앞
      v.set(item.anchor.position.x, item.anchor.position.y - MODEL_SIZE * 0.55 * s, item.anchor.position.z).project(this.camera)
      item.label.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, 0)`
      item.label.style.opacity = String(Math.max(0, Math.min(1, t * 1.5)) * (0.25 + 0.75 * facing) * (0.7 + 0.3 * item.hover.x))
      item.label.toggleAttribute('data-hover', i === this.hovered)
    })

    this.renderer.render(this.scene, this.camera)
    this.onVisibleChange(visible)
    // 닫혀서 모두 사라지면 멈춘다 (열거나 모델이 도착하면 wake 로 다시 돈다)
    if (visible || this.open) this.raf = requestAnimationFrame(this.frame)
  }
}
