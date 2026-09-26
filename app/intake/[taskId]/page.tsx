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

  // Every real task has a name; none means ClickUp couldn't find this task.
  if (!initialValues.eventName) {
    return (
      <div className="min-h-screen bg-[#f0ede4] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="font-[family-name:var(--font-cormorant)] text-3xl font-semibold text-[#1e1d1a] mb-3">
            This intake link isn&apos;t valid
          </h1>
          <p className="text-[15px] text-[#878774] font-[family-name:var(--font-jost)] leading-relaxed">
            We couldn&apos;t find the event this link belongs to. Please use the link from your welcome
            email, or contact{' '}
            <a href="mailto:harrison@windanseacoconuts.com" className="underline text-[#8b6914]">
              harrison@windanseacoconuts.com
            </a>{' '}
            and we&apos;ll send you a new one.
          </p>
        </div>
      </div>
    )
  }

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
