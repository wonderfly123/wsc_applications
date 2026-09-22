import type { Metadata } from 'next'
import Image from 'next/image'
import { DecalOrderForm } from '@/components/DecalOrderForm'

export const metadata: Metadata = {
  title: 'Windansea Coconuts — Order a Decal',
  description: 'Internal decal order form',
}

export default function DecalPage() {
  return (
    <div className="min-h-screen bg-[#f0ede4]">
      <div className="bg-[#878774]">
        <div className="max-w-2xl mx-auto px-6 py-5 flex items-center gap-4">
          <Image src="/logo.png" alt="Windansea Coconuts" width={40} height={40} className="rounded-lg" />
          <div>
            <p className="font-[family-name:var(--font-cormorant)] text-xl font-medium text-white leading-tight">
              Windansea Coconuts
            </p>
            <p className="text-xs text-white/70 font-[family-name:var(--font-jost)] tracking-wide uppercase">
              Decal Order Form
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <DecalOrderForm />
      </div>
    </div>
  )
}
