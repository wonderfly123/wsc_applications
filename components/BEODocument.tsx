import React from 'react'
import { BEOData } from '@/lib/types'
import { AttachmentViewer } from './AttachmentViewer'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-9">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#878774] font-[family-name:var(--font-jost)] whitespace-nowrap">
          {title}
        </span>
        <span className="flex-1 h-px bg-[#e0ddd4]" />
      </div>
      <div className="border border-[#d8d5cc]">
        {children}
      </div>
    </div>
  )
}

function FieldRow({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex${last ? '' : ' border-b border-[#d8d5cc]'}`}>
      {children}
    </div>
  )
}

function Field({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex-1 px-5 py-4 min-w-0${last ? '' : ' border-r border-[#d8d5cc]'}`}>
      <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#9a9890] font-[family-name:var(--font-jost)] mb-[7px]">
        {label}
      </div>
      <div className="font-[family-name:var(--font-cormorant)] font-normal text-[17px] text-[#1e1d1a] leading-[1.35] min-h-[24px]">
        {value}
      </div>
    </div>
  )
}

function FullWidthField({ label, value, notes }: { label: string; value: string; notes?: boolean }) {
  return (
    <div className="flex">
      <div className="flex-1 px-5 py-4">
        <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#9a9890] font-[family-name:var(--font-jost)] mb-[7px]">
          {label}
        </div>
        <div className={`font-[family-name:var(--font-cormorant)] font-normal text-[17px] text-[#1e1d1a] leading-[1.35] whitespace-pre-wrap${notes ? ' min-h-[64px]' : ' min-h-[24px]'}`}>
          {value}
        </div>
      </div>
    </div>
  )
}

export function BEODocument({ data, taskId }: { data: BEOData; taskId: string }) {
  const isSandcastle = data.package === 'Sandcastle'
  return (
    <div className="w-[820px] min-h-[1060px] mx-auto bg-white shadow-[0_6px_48px_rgba(0,0,0,0.10)] my-10 print:w-full print:my-0 print:shadow-none">
      {/* Header */}
      <div className="bg-[#878774] pt-10 pb-[34px] px-14 flex justify-between items-start">
        <div>
          <h1 className="font-[family-name:var(--font-cormorant)] font-light text-[34px] text-white tracking-[0.03em] leading-none">
            Windansea Coconuts
          </h1>
          <p className="text-[13px] font-normal tracking-[0.2em] text-white/55 mt-[7px] uppercase font-[family-name:var(--font-jost)]">
            Banquet Event Order
          </p>
          <p className="text-[11px] font-normal tracking-[0.1em] text-white/40 mt-[5px] font-[family-name:var(--font-jost)]">
            BEO # {taskId}
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Windansea Coconuts"
          className="h-16 w-auto object-contain"
        />
      </div>

      <div className="px-14 pb-12">
        {/* Client Information */}
        <Section title="Client Information">
          <FieldRow>
            <Field label="Event Name" value={data.eventName} />
            <Field label="Company" value={data.companyName} last />
          </FieldRow>
          <FieldRow>
            <Field label="First Name" value={data.clientFirstName} />
            <Field label="Last Name" value={data.clientLastName} last />
          </FieldRow>
          <FieldRow last>
            <Field label="Email" value={data.clientEmail} />
            <Field label="Phone" value={data.clientPhone} last />
          </FieldRow>
        </Section>

        {/* Event Package Details */}
        <Section title="Event Package Details">
          <FieldRow>
            <FullWidthField label="Package" value={data.package} />
          </FieldRow>
          <FieldRow>
            <Field label="Event Type" value={data.eventType} />
            <Field label="Headcount" value={data.headcount} last />
          </FieldRow>
          <FieldRow>
            <Field label="Garnish" value={data.garnish} />
            <Field label="Coconut Qty" value={data.coconutQty} last />
          </FieldRow>
          {isSandcastle ? (
            <FieldRow last>
              <FullWidthField label="Certifications Needed" value={data.certsNeeded} />
            </FieldRow>
          ) : (
            <>
              <FieldRow>
                <Field label="Coconuts Opened by Service Time" value={data.readyBy} />
                <Field label="Setup Provided" value={data.setupProvided} last />
              </FieldRow>
              <FieldRow last>
                <FullWidthField label="Certifications Needed" value={data.certsNeeded} />
              </FieldRow>
            </>
          )}
        </Section>

        {/* Event Location & Timing */}
        <Section title="Event Location & Timing">
          {isSandcastle ? (
            <>
              <FieldRow>
                <Field label="Delivery Window Start" value={data.setupTime} />
                <Field label="Delivery Window End" value={data.teardownTime} last />
              </FieldRow>
              <FieldRow last>
                <FullWidthField label="Delivery Location" value={data.loadInLocation} />
              </FieldRow>
            </>
          ) : (
            <>
              <FieldRow>
                <Field label="Set Up Time" value={data.setupTime} />
                <Field label="Tear Down Time" value={data.teardownTime} last />
              </FieldRow>
              <FieldRow>
                <Field label="Service Start" value={data.serviceStart} />
                <Field label="Service End" value={data.serviceEnd} last />
              </FieldRow>
              <FieldRow>
                <Field label="Event Location" value={data.eventLocation} />
                <Field label="Load-in Location" value={data.loadInLocation} last />
              </FieldRow>
              <FieldRow last>
                <FullWidthField label="Delivery Instructions" value={data.deliveryInstructions} />
              </FieldRow>
            </>
          )}
        </Section>

        {/* Additional Information */}
        <Section title="Additional Information">
          <FieldRow>
            <FullWidthField label="Insurance Requirements" value={data.insurance} />
          </FieldRow>
          <FieldRow last>
            <FullWidthField label="Event Notes" value={data.eventNotes} notes />
          </FieldRow>
        </Section>

        {/* Attachments */}
        {data.attachments.length > 0 && (
          <Section title="Attachments">
            <AttachmentViewer attachments={data.attachments} />
          </Section>
        )}
      </div>

      {/* Footer */}
      <div className="mx-14 py-[18px] border-t border-[#e0ddd4] flex justify-between items-center">
        <span className="text-[10px] tracking-[0.1em] text-[#aaa9a4] font-[family-name:var(--font-jost)]">windanseacoconuts.com</span>
        <span className="text-[10px] tracking-[0.1em] text-[#aaa9a4] font-[family-name:var(--font-jost)]">harrison@windanseacoconuts.com</span>
        <span className="text-[10px] tracking-[0.1em] text-[#aaa9a4] font-[family-name:var(--font-jost)]">Confidential</span>
      </div>
    </div>
  )
}
