// Full-viewport decorative scene rendered behind page content. Purely visual —
// aria-hidden and non-interactive so it never gets in the way of the dashboard.
type Theme = 'fire' | 'underwater' | 'sky'

const GRADIENTS: Record<Theme, string> = {
  fire: 'linear-gradient(to bottom, #2b0a03 0%, #7c1d06 22%, #c53a06 50%, #f97316 75%, #fde047 100%)',
  underwater: 'linear-gradient(to bottom, #021024 0%, #04395e 30%, #0a6ea8 65%, #37b6e9 100%)',
  sky: 'linear-gradient(to bottom, #bfe9ff 0%, #eaf6ff 45%, #fff8e1 100%)',
}

export default function PageBackdrop({ theme }: { theme: Theme }) {
  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
      style={{ background: GRADIENTS[theme] }}
    >
      {theme === 'underwater' && <UnderwaterScene />}
      {theme === 'sky' && <SkyScene />}
    </div>
  )
}

function UnderwaterScene() {
  return (
    <>
      {Array.from({ length: 10 }).map((_, i) => (
        <span
          key={i}
          className="bubble"
          style={{
            left: `${(i * 9 + 5) % 100}%`,
            animationDelay: `${(i % 5) * 0.9}s`,
            width: `${6 + (i % 3) * 4}px`,
            height: `${6 + (i % 3) * 4}px`,
          }}
        />
      ))}
    </>
  )
}

function SkyScene() {
  return (
    <>
      <span className="absolute top-6 right-6 text-[16vw] sm:text-[9vw] animate-spin-slow select-none">☀️</span>
      <div className="absolute inset-x-0 top-14 flex justify-center">
        <span className="text-[70vw] sm:text-[45vw] leading-none select-none opacity-90">🌈</span>
      </div>
      <span className="absolute bottom-6 left-4 text-[20vw] sm:text-[12vw] animate-bob select-none">🦄</span>
      {Array.from({ length: 10 }).map((_, i) => (
        <span
          key={i}
          className="sparkle"
          style={{ left: `${(i * 11 + 4) % 100}%`, top: `${(i * 17 + 6) % 80}%`, animationDelay: `${(i % 6) * 0.5}s` }}
        >
          ✨
        </span>
      ))}
    </>
  )
}
