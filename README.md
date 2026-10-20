# Gleora

디자인 레퍼런스 갤러리 Gleora 의 웹 프로토타입. Figma 디자인을 Figma 셰이더 런타임 그대로 옮긴다.
이전 폴더 UI 프로토타입은 [Gleora-legacy](https://github.com/thvlou/Gleora-legacy) 에 있다.

## 지금 있는 것

- **표지** — 노란 기가 도는 흰 연기 배경(Moving gradient), 색수차 이미지 3장(Lens distortion), 로고.
  로고에 마우스를 올리면 정전기처럼 지지직거린다.
- **메인** — 로고를 누르면 표지가 물러나고, 같은 배경 위에 피쳐 9개(Web·UI·Graphic·Type·Motion·Photo·Color·Icon·Code)의
  3D 오브젝트(Blender 제작 GLB, three.js)가 화면 가득 퍼진다. 필드 전체가 천천히 돌며 화면을 가로지르고, 드래그하면 돌리고
  놓으면 관성으로 감속. 오브젝트에 마우스를 올리면 내장 애니메이션(스위치·셔터·키캡·견본 펼침)이 재생된다.
  `← Gleora` 나 Esc 로 표지 복귀.

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
  field/FieldScene           three.js 장면 — 고리 배치 · 스프링 등장 · 드래그 관성 · 호버 클립
  features.ts                피쳐 목록 · 모델(src/assets/models/*.glb)
  effects/                   런타임에 끼우는 셰이더 — 이미지 입력, Figma 와 같은 알파 합성
  shaders.ts                 Figma 저작 파라미터
  lib/                       Figma 셰이더 런타임·셰이더 원본 (수정하지 않음)
```
