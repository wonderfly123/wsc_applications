'use client'

import React, { useState } from 'react'
import { BEOAttachment } from '@/lib/types'

function FileIcon() {
  return (
    <svg className="w-4 h-4 text-[#878774]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  )
}

function Modal({ attachment, onClose }: { attachment: BEOAttachment; onClose: () => void }) {
  const isImage = attachment.mimetype.startsWith('image/')
  const isPdf = attachment.mimetype === 'application/pdf'
  // Use Google Docs viewer for PDFs since ClickUp URLs force download
  const pdfViewerUrl = isPdf
    ? `https://docs.google.com/gview?url=${encodeURIComponent(attachment.url)}&embedded=true`
    : ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 print:hidden" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-[90vw] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#d8d5cc]">
          <span className="text-[13px] font-medium text-[#1e1d1a] font-[family-name:var(--font-jost)]">
            {attachment.title}
          </span>
          <button
            onClick={onClose}
            className="text-[#9a9890] hover:text-[#1e1d1a] text-xl leading-none px-2"
          >
            &times;
          </button>
        </div>
        <div className="p-4 overflow-auto flex items-center justify-center">
          {isImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={attachment.url}
              alt={attachment.title}
              className="max-w-[80vw] max-h-[75vh] object-contain"
            />
          )}
          {isPdf && (
            <iframe
              src={pdfViewerUrl}
              className="w-[80vw] h-[75vh]"
              title={attachment.title}
            />
          )}
          {!isImage && !isPdf && (
            <div className="text-center py-8">
              <p className="text-[#9a9890] text-sm font-[family-name:var(--font-jost)] mb-3">
                Preview not available
              </p>
              <a
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#878774] underline text-sm font-[family-name:var(--font-jost)]"
              >
                Download file
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AttachmentGroup({ label, items, onSelect }: { label: string; items: BEOAttachment[]; onSelect: (att: BEOAttachment) => void }) {
  if (items.length === 0) return null
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#9a9890] font-[family-name:var(--font-jost)] mb-2">
        {label}
      </div>
      <div className="flex flex-col gap-1">
        {items.map((att, i) => (
          <button
            key={i}
            onClick={() => onSelect(att)}
            className="flex items-center gap-2 text-left hover:bg-[#f5f4f0] rounded px-2 py-1.5 -mx-2 transition-colors"
          >
            <FileIcon />
            <span className="text-[14px] text-[#878774] underline font-[family-name:var(--font-jost)]">
              {att.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function AttachmentViewer({ attachments }: { attachments: BEOAttachment[] }) {
  const [selected, setSelected] = useState<BEOAttachment | null>(null)

  if (attachments.length === 0) return null

  const stampLogos = attachments.filter((a) => a.category === 'Stamp Logo')
  const maps = attachments.filter((a) => a.category === 'Delivery Map')
  const other = attachments.filter((a) => a.category === 'Other')

  return (
    <>
      <div className="px-5 py-4 flex flex-col gap-4">
        <AttachmentGroup label="Stamp Logo" items={stampLogos} onSelect={setSelected} />
        <AttachmentGroup label="Delivery Map" items={maps} onSelect={setSelected} />
        <AttachmentGroup label="Other" items={other} onSelect={setSelected} />
      </div>
      {selected && <Modal attachment={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
