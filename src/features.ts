import web from './assets/models/web.glb?url'
import ui from './assets/models/ui.glb?url'
import graphic from './assets/models/graphic.glb?url'
import type from './assets/models/type.glb?url'
import motion from './assets/models/motion.glb?url'
import photo from './assets/models/photo.glb?url'
import color from './assets/models/color.glb?url'
import icon from './assets/models/icon.glb?url'
import code from './assets/models/code.glb?url'

// Gleora 피쳐 9개 — "Archive Objects / 09". 웹의 피쳐를 오래된 도구·기계·표지물로 해석한 Blender 모델
// (gleora-archive-3d/glb 원본 그대로, 최장 변 2.4 정규화, 정면 +Z).
//
// 클립은 에셋 README 의 모션 명세대로 연결한다. 활성(호버·클릭한) 오브젝트만 움직인다.
// - hoverLoop: 호버하는 동안 반복, 떠나면 천천히 멈춤
// - hoverOnce: 호버로 들어올 때 한 번
// - click:     클릭할 때 차례로 한 번씩 (앞 클립이 끝나면 다음)
// - toggle:    클릭할 때마다 clip 의 0초 ↔ at 초 자세 사이를 오간다
export type ClipPlan = {
  hoverLoop?: string[]
  hoverOnce?: string[]
  click?: string[]
  toggle?: { clip: string; at: number }
}

export type Feature = { key: string; label: string; model: string; clips: ClipPlan }

export const FEATURES: Feature[] = [
  { key: 'web', label: 'Web', model: web, clips: { hoverLoop: ['WEB.scan'] } },
  { key: 'ui', label: 'UI', model: ui, clips: { toggle: { clip: 'UI.knife_toggle', at: 0.5 } } },
  { key: 'graphic', label: 'Graphic', model: graphic, clips: { hoverLoop: ['GRAPHIC.roll'], click: ['GRAPHIC.feed'] } },
  { key: 'type', label: 'Type', model: type, clips: { click: ['TYPE.key_press', 'TYPE.carriage_return'] } },
  { key: 'motion', label: 'Motion', model: motion, clips: { hoverLoop: ['MOTION.project'] } },
  { key: 'photo', label: 'Photo', model: photo, clips: { hoverOnce: ['PHOTO.focus'], click: ['PHOTO.shutter'] } },
  { key: 'color', label: 'Color', model: color, clips: { click: ['COLOR.quarter_turn'] } },
  { key: 'icon', label: 'Icon', model: icon, clips: { hoverOnce: ['ICON.wind'] } },
  { key: 'code', label: 'Code', model: code, clips: { click: ['CODE.inspect'] } },
]
