import Image from 'next/image'

export default function IntakeIndexPage() {
  return (
    <div className="min-h-screen bg-[#f0ede4]">
      <div className="bg-[#878774]">
        <div className="max-w-2xl mx-auto px-6 py-5 flex items-center gap-4">
          <Image
            src="/logo.png"
            alt="Windansea Coconuts"
            width={40}
            height={40}
            className="rounded-lg"
          />
          <div>
            <p className="font-[family-name:var(--font-cormorant)] text-xl font-medium text-white leading-tight">
              Windansea Coconuts
            </p>
            <p className="text-xs text-white/70 font-[family-name:var(--font-jost)] tracking-wide uppercase">
              Event Intake Form
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-6 py-20 text-center">
        <h1 className="font-[family-name:var(--font-cormorant)] text-3xl font-semibold text-[#1e1d1a] mb-4">
          Looking for your intake form?
        </h1>
        <p className="text-base text-[#878774] font-[family-name:var(--font-jost)] leading-relaxed mb-6">
          Each client receives a unique intake form link via email when their event is confirmed.
          If you can&apos;t find your link, check your inbox for an email from Windansea Coconuts
          or reach out to{' '}
          <a href="mailto:harrison@windanseacoconuts.com" className="underline text-[#8b6914]">
            harrison@windanseacoconuts.com
          </a>.
        </p>
      </div>
    </div>
  )
}
