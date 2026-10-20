import { LogoTintFilter } from './components/LogoLetter.tsx'
import { SilkSection } from './sections/SilkSection.tsx'
import { StaticSection } from './sections/StaticSection.tsx'

// Figma v2 — Frame 1(실크) · Frame 2(정전기)를 위아래 섹션으로 잇는다.
export default function App() {
  return (
    <main>
      <h1 hidden>Gleora</h1>
      <LogoTintFilter />
      <SilkSection />
      <StaticSection />
    </main>
  )
}
