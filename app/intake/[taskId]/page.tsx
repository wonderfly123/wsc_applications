import { IntakeForm } from '@/components/IntakeForm'
import Image from 'next/image'
import Script from 'next/script'

export const dynamic = 'force-dynamic'

export default async function IntakePage({
  params,
}: {
  params: { taskId: string }
}) {
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  return (
    <div className="min-h-screen bg-[#f0ede4]">
      {mapsKey && (
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${mapsKey}&libraries=places`}
          strategy="beforeInteractive"
        />
      )}
      {/* Header bar */}
      <div className="bg-[#878774]">
        <div className="max-w-2xl mx-auto px-6 py-8 flex items-center gap-5">
          <Image
            src="/logo.png"
            alt="Windansea Coconuts"
            width={56}
            height={56}
            className="rounded-lg"
          />
          <div>
            <p className="font-[family-name:var(--font-cormorant)] text-2xl font-medium text-white leading-tight">
              Windansea Coconuts
            </p>
            <p className="text-sm text-white/70 font-[family-name:var(--font-jost)] tracking-widest uppercase mt-0.5">
              Event Intake Form
            </p>
          </div>
        </div>
      </div>

      {/* Intro */}
      <div className="max-w-2xl mx-auto px-6 pt-8 pb-2">
        <p className="text-sm text-[#9a9890] font-[family-name:var(--font-jost)]">
          This link is unique to your event. If you need to come back later, bookmark this page or find the link in your email.
        </p>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-6 py-6 pb-16 overflow-hidden">
        <IntakeForm taskId={params.taskId} />
      </div>
    </div>
  )
}
