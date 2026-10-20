import type { ReactNode, Ref } from 'react'

import type { Letter } from '../logo.ts'
import { LOGO_TINT_MATRIX } from '../shaders.ts'
import styles from './LogoLetter.module.css'

const TINT_FILTER_ID = 'gleora-logo-tint'

// Channel mixer 필터 정의. 페이지에 한 번만 렌더한다 (App).
export function LogoTintFilter() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
      <filter id={TINT_FILTER_ID} colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values={LOGO_TINT_MATRIX} />
      </filter>
    </svg>
  )
}

// 로고 글자 한 개. Figma 에서 Channel mixer 가 걸린 글자('o' 제외)는 같은 색 행렬 필터를 쓴다.
export function LogoLetter({
  letter,
  origin,
  innerRef,
  children,
}: {
  letter: Letter
  origin: { x: number; y: number } // 로고 박스 좌상단 (프레임 좌표)
  innerRef?: Ref<HTMLDivElement>
  children?: ReactNode // 글자 뒤에 깔 레이어 (예: 정전기 잔상)
}) {
  const { rect, src, shader, name } = letter
  return (
    <div
      ref={innerRef}
      className={styles.letter}
      style={{ left: rect.x - origin.x, top: rect.y - origin.y, width: rect.w, height: rect.h }}
    >
      {children}
      <div className={styles.fill} data-name={name}>
        <img
          alt=""
          className={styles.img}
          src={src}
          style={shader ? { filter: `url(#${TINT_FILTER_ID})` } : undefined}
        />
      </div>
    </div>
  )
}
