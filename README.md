# Gleora

디자인 레퍼런스 갤러리 Gleora 의 웹 프로토타입. Figma 디자인을 Figma 셰이더 런타임 그대로 옮긴다.
이전 폴더 UI 프로토타입은 [Gleora-legacy](https://github.com/thvlou/Gleora-legacy) 에 있다.

## 지금 있는 것

- **표지** — 노란 기가 도는 흰 연기 배경(Moving gradient), 색수차 이미지 3장(Lens distortion), 로고.
  로고에 마우스를 올리면 정전기처럼 지지직거린다.
- **메인** — 로고를 누르면 표지가 물러나고, 같은 배경 위에 피쳐 9개가 "Archive Objects" — 웹의 피쳐를 오래된
  도구·기계로 해석한 Blender 3D 모델(CRT 터미널·배전반·롤러 인쇄기·타자기·영화 카메라·접이식 카메라·색상 큐브·
  STOP 표지판·CPU 기판) — 로 한 덩어리로 펼쳐진다. 드래그하면 상하좌우 제한 없이 돌리고(트랙볼) 놓으면 관성으로 감속.
  휠(트랙패드 핀치)이나 `+` `−` `0` 키로 확대·축소. 피쳐 이름은 로고와 같은 글꼴(League Gothic)·색.
  오브젝트에 올라가면 자전이 멈추고 그 오브젝트만 움직인다: 호버 중 반복(스캔·릴·롤러), 호버 1회(초점·표지판 흔들림),
  클릭 1회(셔터·큐브 회전·프로세서 분리·종이 배출·타자 후 캐리지), 클릭 토글(나이프 스위치). `← Gleora` 나 Esc 로 표지 복귀.

## 실행

```bash
npm install
npm run dev
```

WebGPU 가 되는 브라우저(Chrome 113+)가 필요하다. 없으면 셰이더 없이 원본 이미지만 그린다.

## 구조

```
src/
  App.tsx                    표지
  sections/StaticSection     표지 — 배경·이미지·로고 정전기 호버
  components/
    Stage                    1920×1080 Figma 프레임을 화면에 cover 로 맞춤
    LogoLetter               로고 글자 (Channel mixer → SVG 색 행렬 필터)
    ShaderCanvas             셰이더 체인을 캔버스에 그림
    FeatureField             피쳐 3D 필드 (three.js 는 표지 뒤에 지연 로딩)
  field/FieldScene           three.js 장면 — 덩어리 배치 · 시각 크기 보정 · 스프링 등장 · 트랙볼 회전 · 클립 조작
  features.ts                피쳐 목록 · 모델(src/assets/models/*.glb) · 클립 연결표
  effects/                   런타임에 끼우는 셰이더 — 이미지 입력, Figma 와 같은 알파 합성
  shaders.ts                 Figma 저작 파라미터
  lib/                       Figma 셰이더 런타임·셰이더 원본 (수정하지 않음)
```
