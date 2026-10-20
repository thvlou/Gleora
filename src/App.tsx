import { LogoTintFilter } from './components/LogoLetter.tsx'
import { StaticSection } from './sections/StaticSection.tsx'

// 표지 — Figma Frame 2(정전기) 커버. Frame 1(실크) 커버는 쓰지 않는다 (git 히스토리 b370e54 에 있음).
export default function App() {
  return (
    <main>
      <h1 hidden>Gleora</h1>
      <LogoTintFilter />
      <StaticSection />
    </main>
  )
}
