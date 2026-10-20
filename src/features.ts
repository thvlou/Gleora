import web from './assets/features/web.webp'
import ui from './assets/features/ui.webp'
import graphic from './assets/features/graphic.webp'
import type from './assets/features/type.webp'
import motion from './assets/features/motion.webp'
import photo from './assets/features/photo.webp'
import color from './assets/features/color.webp'
import icon from './assets/features/icon.webp'
import code from './assets/features/code.webp'

// Gleora 피쳐 9개. 이미지는 gleora-interaction-kit-v3/stills 원본(1254px PNG)을 480px WebP 로 줄인 파생본.
export type Feature = { key: string; label: string; src: string }

export const FEATURES: Feature[] = [
  { key: 'web', label: 'Web', src: web },
  { key: 'ui', label: 'UI', src: ui },
  { key: 'graphic', label: 'Graphic', src: graphic },
  { key: 'type', label: 'Type', src: type },
  { key: 'motion', label: 'Motion', src: motion },
  { key: 'photo', label: 'Photo', src: photo },
  { key: 'color', label: 'Color', src: color },
  { key: 'icon', label: 'Icon', src: icon },
  { key: 'code', label: 'Code', src: code },
]
