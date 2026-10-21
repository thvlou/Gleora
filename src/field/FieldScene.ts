import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

import type { ClipPlan, Feature } from '../features.ts'

// 피쳐 9개를 한 덩어리로 띄운 3D 필드.
// - 배치: 화면을 거의 채우는 납작한 타원체 위 피보나치 격자. 오브젝트를 크게, 깊이 폭은 얕게 해 이웃끼리
//   가까이 붙어 보이게 한다 (흩어져 작아 보이지 않게).
// - 자세: 모두 같은 3/4 각도(에셋 렌더와 같은 시선)로 두고, 포인터 쪽으로 다 함께 살짝 기운다.
// - 회전: 트랙볼 — 쿼터니언 방향 + 화면 축 기준, 상하좌우 제한 없음. 놓으면 관성 후 느린 자전.
//   오브젝트에 올라가 있으면 자전을 멈춰 활성 오브젝트만 움직이게 한다.
// - 클립: features.ts 의 ClipPlan 대로 (호버 반복·호버 1회·클릭 1회·토글).
// - 확대: 휠(트랙패드 핀치 포함)·+/−/0 키로 카메라 거리를 바꾼다. 배치 크기는 기본 거리 기준 그대로.

const FOV = 30
const DISTANCE = 10
const MODEL_SIZE = 2.4 // GLB 정규화 크기 (최장 변)
const OBJECT_SIZE = 0.22 // 깊이 0 에서 화면 짧은 변 대비 오브젝트 크기
const SPREAD = { x: 0.7, y: 0.7, z: 2.2 } // 화면 반폭·반높이 대비 필드 반지름, z 는 월드 단위
const MAX_ASPECT = 2.2 // 아주 넓거나 긴 화면에서도 덩어리가 한쪽으로 늘어나 흩어지지 않게 (긴 반지름 ≤ 짧은 쪽 × 이 값)
const NARROW_BOOST = 1.3 // 세로 화면 — 폭만 보고 크기를 정하면 너무 작아져서 이만큼 더 허용
const FRONT_AREA = 3.4 // 시각 크기 보정 기준 — 정면 면적이 이만큼 되게 (2.4 정규화 단위²)
const POSE = { x: 0.2, y: -0.42 } // rad — 위에서 왼쪽으로 내려다보는 3/4 각도
const GOLDEN = Math.PI * (3 - Math.sqrt(5))

const IDLE_SPIN = 5 // °/s — 가만히 두면 화면 세로축으로 돈다
const DRAG_GAIN = 0.18 // ° / px
const INERTIA = 1.2
const CLICK_SLOP = 6 // px — 이보다 적게 움직이고 놓으면 클릭
const ZOOM = { min: 0.6, max: 1.6, wheel: 0.0008, pinch: 0.01, key: 1.15 } // 카메라 거리 배율

// 스프링 (질량 1)
const SPRING = { k: 150, c: 19 } // 등장 — 감쇠비 ≈ 0.78, 살짝 넘쳤다 자리 잡는다
const CLOSE = { k: 240, c: 31 }
const HOVER = { k: 260, c: 26 }
const STAGGER = 0.05
const TWIST = 0.5 // rad — 등장할 때 풀리는 Z 비틀림

const DEG = Math.PI / 180

type Spring = { x: number; v: number }
const step = (s: Spring, target: number, { k, c }: { k: number; c: number }, dt: number) => {
  s.v += (-k * (s.x - target) - c * s.v) * dt
  s.x += s.v * dt
}

// 한 모델의 클립 조작 — 호버 반복은 떠날 때 천천히 멈추고, 클릭 클립은 차례로, 토글은 두 자세를 오간다
class ClipController {
  private actions = new Map<string, THREE.AnimationAction>()
  private queue: string[] = []
  private current: THREE.AnimationAction | null = null
  private toggleOn = false

  constructor(
    readonly mixer: THREE.AnimationMixer,
    clips: THREE.AnimationClip[],
    private plan: ClipPlan,
  ) {
    clips.forEach((clip) => {
      const a = mixer.clipAction(clip)
      a.setLoop(THREE.LoopOnce, 1)
      a.clampWhenFinished = clip.name === plan.toggle?.clip
      this.actions.set(clip.name, a)
    })
    plan.hoverLoop?.forEach((name) => this.actions.get(name)?.setLoop(THREE.LoopRepeat, Infinity))
    mixer.addEventListener('finished', (e) => e.action === this.current && this.next())
  }

  hoverStart(motion: boolean) {
    if (!motion) return
    this.plan.hoverLoop?.forEach((name) => {
      const a = this.actions.get(name)
      if (!a) return
      a.stopWarping()
      a.paused = false
      a.timeScale = 1
      a.play()
    })
    this.plan.hoverOnce?.forEach((name) => this.actions.get(name)?.reset().play())
  }

  hoverEnd() {
    // 기계가 서서히 멈추듯 — 그 자리에서 정지 (명세: 포인터 이탈 시 정지)
    this.plan.hoverLoop?.forEach((name) => this.actions.get(name)?.halt(0.45))
  }

  click() {
    const t = this.plan.toggle
    if (t) {
      const a = this.actions.get(t.clip)
      if (a) {
        this.toggleOn = !this.toggleOn
        if (!a.isRunning() && !a.paused) a.reset()
        a.paused = false
        a.timeScale = this.toggleOn ? 1 : -1
        if (!this.toggleOn && a.time <= 0) a.time = t.at
        a.play()
      }
    }
    if (this.plan.click?.length && !this.current) {
      this.queue = [...this.plan.click]
      this.next()
    }
  }

  private next() {
    const name = this.queue.shift()
    this.current = (name && this.actions.get(name)) || null
    this.current?.reset().play()
  }

  update(dt: number) {
    this.mixer.update(dt)
    // 토글 클립은 0초와 at 초에서 멈춰 그 자세를 유지한다
    const t = this.plan.toggle
    const a = t && this.actions.get(t.clip)
    if (t && a && !a.paused) {
      if (this.toggleOn && a.time >= t.at) {
        a.time = t.at
        a.paused = true
      } else if (!this.toggleOn && a.timeScale < 0 && a.time <= 0) {
        a.time = 0
        a.paused = true
      }
    }
  }
}

type Item = {
  feature: Feature
  base: THREE.Vector3 // 단위 구 위 자리
  anchor: THREE.Group // 위치·크기, 카메라를 바라본다
  pose: THREE.Group // 공통 3/4 자세 + 포인터 기울기
  fit: THREE.Group // 시각 크기 보정
  reach: number // 중심에서 아래 가장자리까지 (모델 단위, 보정 배율 포함) — 이름표 자리
  hit: THREE.Mesh | null // 넓은 보이지 않는 선택 영역
  clips: ClipController | null
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
  private lean = { x: 0, y: 0 } // 포인터 쪽 기울기 (부드럽게 따라감)
  private size = { w: 1, h: 1, unit: 1, rx: 1, ry: 1 }
  private reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  private open = false
  private openedAt = 0
  private raf = 0
  private last = 0
  // 필드 방향과 각속도 (°/s, 화면 X·Y 축 기준). 시작 자세는 살짝 내려다보는 각도.
  private orientation = new THREE.Quaternion()
    .setFromAxisAngle(new THREE.Vector3(1, 0, 0), 10 * DEG)
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 20 * DEG))
  private spin = { x: 0, y: IDLE_SPIN }
  private zoom = 1
  private zoomTarget = 1
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
    this.renderer.toneMappingExposure = 1.08

    // 금속이 검게 죽지 않도록 중립 환경광 + 위왼쪽 주광 + 약한 역광
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environmentIntensity = 1
    pmrem.dispose()
    const key = new THREE.DirectionalLight(0xfff6ea, 1.6)
    key.position.set(-4, 6, 7)
    const rim = new THREE.DirectionalLight(0xffffff, 0.5)
    rim.position.set(5, 2, -6)
    this.scene.add(key, rim)

    this.camera.position.set(0, 0, DISTANCE)
    // 뒤쪽을 배경색으로 아주 살짝만 옅게 — 너무 흐리면 동떨어져 보인다
    this.scene.fog = new THREE.Fog(0xf3f0e8, DISTANCE + 0.5, DISTANCE + 16)

    const n = features.length
    this.items = features.map((feature, i) => {
      // 피보나치 격자 — 단위 구 위 고른 자리
      const y = 1 - (2 * i + 1) / n
      const r = Math.sqrt(1 - y * y)
      const t = i * GOLDEN
      const anchor = new THREE.Group()
      const pose = new THREE.Group()
      const fit = new THREE.Group()
      anchor.add(pose)
      pose.add(fit)
      anchor.visible = false
      anchor.userData.index = i
      this.scene.add(anchor)
      return {
        feature,
        base: new THREE.Vector3(Math.sin(t) * r, y, Math.cos(t) * r),
        anchor,
        pose,
        fit,
        reach: MODEL_SIZE * 0.5,
        hit: null,
        clips: null,
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
    canvas.addEventListener('pointercancel', this.onCancel)
    canvas.addEventListener('pointerleave', this.onLeave)
    canvas.addEventListener('wheel', this.onWheel, { passive: false })
    window.addEventListener('keydown', this.onKey)
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
          const model = gltf.scene
          // 시각 크기 보정 — 최장 변만 맞추면 얇은 표지판은 작아 보이고 큐브는 커 보인다.
          // 정면(xy) 면적이 비슷해지게 하되 0.85–1.25 배 안에서만.
          const box = new THREE.Box3().setFromObject(model)
          const dim = box.getSize(new THREE.Vector3())
          const k = THREE.MathUtils.clamp(Math.sqrt(FRONT_AREA / Math.max(dim.x * dim.y, 0.1)), 0.85, 1.25)
          item.fit.scale.setScalar(k)
          // 3/4 자세로 기울면 앞 아래 모서리가 더 내려와 보여서 여유를 둔다
          item.reach = (dim.y / 2 - box.getCenter(new THREE.Vector3()).y) * k * 1.12 + 0.3
          item.fit.add(model)
          // 작은 부품 대신 넓은 상자로 고른다 (레이캐스트도 이것만)
          const hit = new THREE.Mesh(
            new THREE.BoxGeometry(dim.x * 1.15, dim.y * 1.15, dim.z * 1.15),
            new THREE.MeshBasicMaterial({ visible: false }),
          )
          hit.position.copy(box.getCenter(new THREE.Vector3()))
          item.fit.add(hit)
          item.hit = hit
          if (gltf.animations.length) {
            item.clips = new ClipController(new THREE.AnimationMixer(model), gltf.animations, item.feature.clips)
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
    this.canvas.removeEventListener('pointercancel', this.onCancel)
    this.canvas.removeEventListener('pointerleave', this.onLeave)
    this.canvas.removeEventListener('wheel', this.onWheel)
    window.removeEventListener('keydown', this.onKey)
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      mesh.geometry?.dispose()
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []
      mats.forEach((m) => {
        Object.values(m).forEach((v) => v instanceof THREE.Texture && v.dispose())
        m.dispose()
      })
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
    const rx = halfW * SPREAD.x
    const ry = halfH * SPREAD.y
    this.size = {
      w,
      h,
      unit: (OBJECT_SIZE * 2 * Math.min(halfH, halfW * NARROW_BOOST)) / MODEL_SIZE,
      rx: Math.min(rx, ry * MAX_ASPECT),
      ry: Math.min(ry, rx * MAX_ASPECT),
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
    this.toPointer(e)
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 }
    this.canvas.setPointerCapture(e.pointerId)
    this.spin.x = this.spin.y = 0
  }

  private onMove = (e: PointerEvent) => {
    this.toPointer(e)
    const d = this.drag
    if (!d || e.pointerId !== d.id) return
    const now = performance.now()
    const dt = Math.max((now - d.t) / 1000, 1 / 240)
    const moved = d.moved + Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y)
    if (moved > CLICK_SLOP) this.canvas.dataset.dragging = ''
    // 가로 이동 → 화면 세로축(Y) 회전, 세로 이동 → 화면 가로축(X) 회전. 잡은 쪽이 손을 따라온다.
    const dy = (e.clientX - d.x) * DRAG_GAIN
    const dx = (e.clientY - d.y) * DRAG_GAIN
    this.turn(dx, dy)
    this.spin.x = this.spin.x * 0.6 + (dx / dt) * 0.4
    this.spin.y = this.spin.y * 0.6 + (dy / dt) * 0.4
    this.drag = { ...d, x: e.clientX, y: e.clientY, t: now, moved }
  }

  private onUp = (e: PointerEvent) => {
    const d = this.drag
    if (!d || e.pointerId !== d.id) return
    if (d.moved < CLICK_SLOP) {
      // 클릭 — 누른 자리의 오브젝트 클립 재생
      const index = this.pick()
      if (index >= 0) this.items[index].clips?.click()
      this.spin.x = this.spin.y = 0
    } else if (performance.now() - d.t > 80) {
      this.spin.x = this.spin.y = 0
    }
    this.onCancel(e)
  }

  private onCancel = (e: PointerEvent) => {
    if (this.drag && e.pointerId === this.drag.id) this.drag = null
    delete this.canvas.dataset.dragging
  }

  private onLeave = () => {
    if (!this.drag) this.pointer.set(9, 9)
  }

  private zoomBy(factor: number) {
    this.zoomTarget = THREE.MathUtils.clamp(this.zoomTarget * factor, ZOOM.min, ZOOM.max)
    this.wake()
  }

  // 휠을 올리면 다가가고 내리면 물러난다. 트랙패드 핀치는 ctrl+휠로 들어와 더 민감하게.
  private onWheel = (e: WheelEvent) => {
    if (!this.open) return
    e.preventDefault()
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY
    this.zoomBy(Math.exp(delta * (e.ctrlKey ? ZOOM.pinch : ZOOM.wheel)))
  }

  private onKey = (e: KeyboardEvent) => {
    if (!this.open || e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === '+' || e.key === '=') this.zoomBy(1 / ZOOM.key)
    else if (e.key === '-' || e.key === '_') this.zoomBy(ZOOM.key)
    else if (e.key === '0') this.zoomBy(1 / this.zoomTarget)
  }

  // 화면 축 기준 회전을 현재 방향 앞에 덧붙인다 (카메라가 고정이라 월드 축 = 화면 축)
  private turnQ = new THREE.Quaternion()
  private axis = new THREE.Vector3()
  private turn(degX: number, degY: number) {
    const angle = Math.hypot(degX, degY)
    if (angle < 1e-6) return
    this.turnQ.setFromAxisAngle(this.axis.set(degX / angle, degY / angle, 0), angle * DEG)
    this.orientation.premultiply(this.turnQ).normalize()
  }

  private hits: THREE.Object3D[] = []
  private pick() {
    this.hits.length = 0
    this.items.forEach((it) => it.hit && it.anchor.visible && it.progress.x > 0.6 && this.hits.push(it.hit))
    this.raycaster.setFromCamera(this.pointer, this.camera)
    let o: THREE.Object3D | null = this.raycaster.intersectObjects(this.hits, false)[0]?.object ?? null
    while (o && o.userData.index === undefined) o = o.parent
    return o ? (o.userData.index as number) : -1
  }

  private setHovered(index: number) {
    if (index === this.hovered) return
    this.items[this.hovered]?.clips?.hoverEnd()
    this.hovered = index
    this.canvas.style.cursor = index >= 0 ? 'pointer' : ''
    this.items[index]?.clips?.hoverStart(!this.reduced)
  }

  // --- 프레임 ---

  private frame = (now: number) => {
    this.raf = 0
    const dt = Math.min((now - this.last) / 1000, 1 / 30)
    this.last = now
    const time = now / 1000
    const { unit, rx, ry, w, h } = this.size

    // 호버 — 드래그 중이 아니고 열려 있을 때만
    const dragging = this.drag != null && this.drag.moved > CLICK_SLOP
    if (this.open && !dragging) this.setHovered(this.pick())
    else this.setHovered(-1)

    // 놓으면 관성으로 돌다가 기본 자전으로. 오브젝트에 올라가 있으면 자전을 멈춘다.
    if (!this.drag) {
      const ease = 1 - Math.exp(-INERTIA * dt)
      const idle = this.reduced || this.hovered >= 0 ? 0 : IDLE_SPIN
      this.spin.x += (0 - this.spin.x) * ease
      this.spin.y += (idle - this.spin.y) * ease
      this.turn(this.spin.x * dt, this.spin.y * dt)
    }

    // 확대 — 카메라 거리를 부드럽게 따라간다. 안개도 함께 옮겨 깊이감이 유지되게.
    this.zoom += (this.zoomTarget - this.zoom) * (1 - Math.exp(-(this.reduced ? 30 : 9) * dt))
    const distance = DISTANCE * this.zoom
    this.camera.position.z = distance
    const fog = this.scene.fog as THREE.Fog
    fog.near = distance + 0.5
    fog.far = distance + 16

    // 포인터 쪽으로 다 함께 기운다
    const inside = Math.abs(this.pointer.x) <= 1 && Math.abs(this.pointer.y) <= 1
    const follow = 1 - Math.exp(-3 * dt)
    this.lean.x += ((inside && !this.reduced ? this.pointer.x : 0) - this.lean.x) * follow
    this.lean.y += ((inside && !this.reduced ? this.pointer.y : 0) - this.lean.y) * follow

    const since = (now - this.openedAt) / 1000
    const v = new THREE.Vector3()
    const p = new THREE.Vector3()
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

      // 필드 방향으로 돌리고 화면 비율로 늘린다. 떠다님은 자리에 따라 위상이 이어지는 물결 하나로.
      p.copy(item.base).applyQuaternion(this.orientation)
      const drift = this.reduced ? 0 : Math.sin(time * 0.8 + p.x * 1.6 + p.y * 1.1) * 0.05
      const hx = item.hover.x
      // 호버한 오브젝트는 앞으로 조금 나온다
      item.anchor.position.set(p.x * rx * t, (p.y * ry + drift) * t, (p.z * SPREAD.z + hx * 0.6) * t)
      const s = unit * (0.2 + 0.8 * t) * (1 + 0.1 * hx)
      item.anchor.scale.setScalar(s)
      item.anchor.lookAt(this.camera.position)
      item.anchor.rotateZ(this.reduced ? 0 : (1 - t) * TWIST)

      // 공통 3/4 자세 + 포인터 기울기. 호버하면 조금 더 정면으로 돌아선다.
      item.pose.rotation.set(
        POSE.x * (1 - 0.5 * hx) - this.lean.y * 0.14,
        POSE.y * (1 - 0.45 * hx) + this.lean.x * 0.22,
        0,
      )

      item.clips?.update(dt)

      // 이름표 — 오브젝트 아래. 뒤쪽은 숨긴다.
      const facing = (p.z + 1) / 2 // 0 = 맨 뒤, 1 = 맨 앞
      v.set(item.anchor.position.x, item.anchor.position.y - item.reach * s, item.anchor.position.z).project(this.camera)
      // 이름표도 오브젝트와 같은 원근·확대 비율로 — 크기가 따로 놀면 동떨어져 보인다
      const persp = THREE.MathUtils.clamp(DISTANCE / Math.max(1, distance - item.anchor.position.z), 0.6, 1.8)
      item.label.style.transform =
        `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, 0) scale(${(persp * (1 + 0.15 * hx)).toFixed(3)})`
      const show = THREE.MathUtils.smoothstep(facing, 0.3, 0.6)
      item.label.style.opacity = String(Math.min(1, t * 1.5) * Math.max(show * (0.55 + 0.45 * hx), hx))
      item.label.toggleAttribute('data-hover', i === this.hovered)
    })

    this.renderer.render(this.scene, this.camera)
    this.onVisibleChange(visible)
    // 닫혀서 모두 사라지면 멈춘다 (열거나 모델이 도착하면 wake 로 다시 돈다)
    if (visible || this.open) this.raf = requestAnimationFrame(this.frame)
  }
}
