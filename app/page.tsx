export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center text-[#878774] font-[family-name:var(--font-jost)]">
      <div className="text-center">
        <p className="text-lg font-[family-name:var(--font-cormorant)]">Windansea Coconuts</p>
        <p className="text-sm mt-2">
          Please reach out to us at{' '}
          <a href="mailto:harrison@windanseacoconuts.com" className="underline text-[#8b6914]">
            harrison@windanseacoconuts.com
          </a>
          {' '}with any questions.
        </p>
      </div>
    </div>
  )
}
