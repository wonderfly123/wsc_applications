import { IntakeForm } from '@/components/IntakeForm'
import Image from 'next/image'

export const dynamic = 'force-dynamic'

export default async function IntakePage({
  params,
}: {
  params: { taskId: string }
}) {
  return (
    <div className="min-h-screen bg-[#f0ede4]">
      {/* Header bar */}
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

      {/* Intro */}
      <div className="max-w-2xl mx-auto px-6 pt-8 pb-2">
        <h1 className="font-[family-name:var(--font-cormorant)] text-3xl font-semibold text-[#1e1d1a] mb-2">
          Let&apos;s Plan Your Event
        </h1>
        <p className="text-base text-[#878774] font-[family-name:var(--font-jost)] leading-relaxed">
          Thanks for booking with us! Please complete the details below so we can deliver
          a seamless experience at your event. This takes less than 5 minutes.
        </p>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-6 py-6 pb-16 overflow-hidden">
        <IntakeForm taskId={params.taskId} />
      </div>
    </div>
  )
}
