import web from './assets/models/web.glb?url'
import ui from './assets/models/ui.glb?url'
import graphic from './assets/models/graphic.glb?url'
import type from './assets/models/type.glb?url'
import motion from './assets/models/motion.glb?url'
import photo from './assets/models/photo.glb?url'
import color from './assets/models/color.glb?url'
import icon from './assets/models/icon.glb?url'
import code from './assets/models/code.glb?url'

// Gleora 피쳐 9개. 모델은 gleora-sphere-3d/glb 원본 그대로 (Blender 제작, 중심 정렬·최대 변 2.4 단위).
// loop: 늘 반복하는 내장 클립 / 그 밖의 클립은 호버할 때 한 번 재생한다.
export type Feature = { key: string; label: string; model: string; loop: boolean }

export const FEATURES: Feature[] = [
  { key: 'web', label: 'Web', model: web, loop: false },
  { key: 'ui', label: 'UI', model: ui, loop: false },
  { key: 'graphic', label: 'Graphic', model: graphic, loop: false },
  { key: 'type', label: 'Type', model: type, loop: true },
  { key: 'motion', label: 'Motion', model: motion, loop: true },
  { key: 'photo', label: 'Photo', model: photo, loop: false },
  { key: 'color', label: 'Color', model: color, loop: false },
  { key: 'icon', label: 'Icon', model: icon, loop: true },
  { key: 'code', label: 'Code', model: code, loop: false },
]
