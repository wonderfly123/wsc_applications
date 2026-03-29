import { IntakeForm } from '@/components/IntakeForm'
import { fetchTaskInitialValues } from '@/lib/clickup'
import Image from 'next/image'
import Script from 'next/script'

export const dynamic = 'force-dynamic'

export default async function IntakePage({
  params,
}: {
  params: { taskId: string }
}) {
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const initialValues = await fetchTaskInitialValues(params.taskId)
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
        <div className="max-w-3xl mx-auto px-6 py-8 flex items-center gap-5">
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

      {/* Bookmark notice */}
      <div className="max-w-3xl mx-auto px-6 pt-8 pb-2">
        <div className="bg-white border border-[#e0ddd4] rounded-sm px-5 py-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-[#8b6914] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          <p className="text-[15px] text-[#1e1d1a] font-[family-name:var(--font-jost)] leading-relaxed">
            <span className="font-semibold">This link is unique to your event.</span> If you need to come back later, bookmark this page or find the link in your email.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-3xl mx-auto px-6 py-6 pb-16 overflow-hidden">
        <IntakeForm taskId={params.taskId} initialValues={initialValues} />
      </div>
    </div>
  )
}
