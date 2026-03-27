'use client'

import { useEffect, useRef, useState } from 'react'
import { INTAKE_FIELDS, UPLOAD_FIELDS, IntakeFieldDef } from '@/lib/intake-fields'

function CustomSelect({ name, options, required, placeholder = 'Select...' }: {
  name: string
  options: string[]
  required: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState('')
  const [openUp, setOpenUp] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleToggle() {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      setOpenUp(spaceBelow < 200)
    }
    setOpen(!open)
  }

  return (
    <div ref={ref} className="relative">
      <input type="hidden" name={name} value={selected} required={required} />
      <button
        type="button"
        onClick={handleToggle}
        className={`w-full rounded-lg px-4 py-3 border bg-white text-left font-[family-name:var(--font-jost)] text-[15px] transition-all flex items-center justify-between ${
          open
            ? 'border-[#8b6914] ring-2 ring-[#8b6914]/20'
            : 'border-[#d8d5cc] hover:border-[#bbb8b0]'
        }`}
      >
        <span className={selected ? 'text-[#1e1d1a]' : 'text-[#bbb8b0]'}>
          {selected || placeholder}
        </span>
        <svg
          className={`w-4 h-4 text-[#9a9890] transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className={`absolute z-50 w-full bg-white border border-[#e0ddd4] rounded-lg shadow-lg overflow-hidden ${
          openUp ? 'bottom-full mb-1' : 'top-full mt-1'
        }`}>
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => { setSelected(opt); setOpen(false) }}
              className={`w-full text-left px-4 py-2.5 text-[15px] font-[family-name:var(--font-jost)] transition-colors ${
                selected === opt
                  ? 'bg-[#8b6914]/10 text-[#8b6914]'
                  : 'text-[#1e1d1a] hover:bg-[#f5f3ed]'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function FormField({ field }: { field: IntakeFieldDef }) {
  const baseClass =
    'w-full rounded-lg px-4 py-3 border border-[#d8d5cc] bg-white text-[#1e1d1a] font-[family-name:var(--font-jost)] text-[15px] placeholder:text-[#bbb8b0] focus:outline-none focus:border-[#8b6914] focus:ring-2 focus:ring-[#8b6914]/20 transition-all'

  return (
    <div>
      <label
        htmlFor={field.name}
        className="block text-[15px] font-medium text-[#1e1d1a] font-[family-name:var(--font-jost)] mb-1.5"
      >
        {field.label}
        {field.required && <span className="text-[#c44b2b] ml-0.5">*</span>}
      </label>
      {field.helpText && (
        <p className="text-[13px] text-[#9a9890] font-[family-name:var(--font-jost)] mb-1.5">{field.helpText}</p>
      )}

      {field.type === 'select' ? (
        <CustomSelect
          name={field.name}
          options={field.options || []}
          required={field.required}
        />
      ) : field.type === 'textarea' ? (
        <textarea
          id={field.name}
          name={field.name}
          required={field.required}
          placeholder={field.placeholder}
          rows={3}
          className={`${baseClass} resize-none`}
        />
      ) : (
        <input
          id={field.name}
          name={field.name}
          type={field.type}
          required={field.required}
          placeholder={field.placeholder}
          className={baseClass}
        />
      )}
    </div>
  )
}

function FileUploadField({ name, label, required, accept, helpText, file, onFileChange }: {
  name: string
  label: string
  required: boolean
  accept: string
  helpText?: string
  file: File | null
  onFileChange: (name: string, file: File | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) onFileChange(name, droppedFile)
  }

  return (
    <div>
      <label className="block text-[15px] font-medium text-[#1e1d1a] font-[family-name:var(--font-jost)] mb-1.5">
        {label}
        {required && <span className="text-[#c44b2b] ml-0.5">*</span>}
      </label>
      {helpText && (
        <p className="text-[13px] text-[#9a9890] font-[family-name:var(--font-jost)] mb-1.5">{helpText}</p>
      )}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative rounded-lg border-2 border-dashed px-6 py-8 text-center cursor-pointer transition-all ${
          dragOver
            ? 'border-[#8b6914] bg-[#8b6914]/5'
            : file
              ? 'border-[#8b6914]/40 bg-[#8b6914]/5'
              : 'border-[#d8d5cc] bg-white hover:border-[#bbb8b0]'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => onFileChange(name, e.target.files?.[0] || null)}
        />
        {file ? (
          <div className="flex items-center justify-center gap-3">
            <svg className="w-5 h-5 text-[#8b6914] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-[15px] text-[#1e1d1a] font-[family-name:var(--font-jost)] truncate">{file.name}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onFileChange(name, null) }}
              className="text-[#9a9890] hover:text-[#c44b2b] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <div>
            <svg className="w-8 h-8 mx-auto text-[#d8d5cc] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-[15px] text-[#9a9890] font-[family-name:var(--font-jost)]">
              Drop your file here or <span className="text-[#8b6914] underline">browse</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function renderFieldGrid(fields: IntakeFieldDef[]) {
  const rows: React.ReactNode[] = []
  let i = 0

  while (i < fields.length) {
    const field = fields[i]
    const next = fields[i + 1]

    if (field.half && next?.half) {
      rows.push(
        <div key={field.name} className="grid grid-cols-2 gap-4">
          <FormField field={field} />
          <FormField field={next} />
        </div>
      )
      i += 2
    } else {
      rows.push(
        <div key={field.name}>
          <FormField field={field} />
        </div>
      )
      i += 1
    }
  }

  return <div className="space-y-5">{rows}</div>
}

const SECTIONS = [
  { key: 'client' as const, title: 'Client Information', description: 'Please confirm your contact details.' },
  { key: 'package' as const, title: 'Event Package Details', description: 'Confirm your service package, amount, and customization.' },
  { key: 'timing' as const, title: 'Event Location & Timing', description: 'Venue location and schedule details for your event.' },
  { key: 'additional' as const, title: 'Additional Information', description: 'Questions, comments, and delivery instructions.' },
]

export function IntakeForm({ taskId }: { taskId: string }) {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [files, setFiles] = useState<Record<string, File | null>>({})

  function handleFileChange(name: string, file: File | null) {
    setFiles((prev) => ({ ...prev, [name]: file }))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('submitting')
    setErrorMsg('')

    // Build multipart form data with both fields and files
    const formEl = e.currentTarget
    const submitData = new FormData()

    // Add text fields
    for (const field of INTAKE_FIELDS) {
      const val = (new FormData(formEl).get(field.name) as string) || ''
      submitData.append(field.name, val)
    }

    // Add files
    for (const upload of UPLOAD_FIELDS) {
      const file = files[upload.name]
      if (file) {
        submitData.append(upload.name, file)
      }
    }

    try {
      const res = await fetch(`/api/intake/${taskId}`, {
        method: 'POST',
        body: submitData,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Submission failed' }))
        throw new Error(err.error || `Error ${res.status}`)
      }

      setStatus('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="text-center py-20 px-6">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#1e1d1a] flex items-center justify-center">
          <svg className="w-8 h-8 text-[#f0ede4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-[family-name:var(--font-cormorant)] text-3xl font-medium text-[#1e1d1a] mb-3">
          You&apos;re All Set
        </h2>
        <p className="text-[#878774] font-[family-name:var(--font-jost)] text-sm max-w-sm mx-auto leading-relaxed">
          Your intake form has been submitted. Our team will review the details and reach out if we have any questions.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {SECTIONS.map((section) => {
        const fields = INTAKE_FIELDS.filter((f) => f.section === section.key)
        return (
          <div key={section.key} className="bg-white rounded-xl border border-[#e0ddd4]">
            <div className="px-6 pt-6 pb-4 border-b border-[#e8e5dd]">
              <h2 className="font-[family-name:var(--font-cormorant)] text-2xl font-semibold text-[#1e1d1a]">
                {section.title}
              </h2>
              <p className="text-sm text-[#9a9890] font-[family-name:var(--font-jost)] mt-0.5">{section.description}</p>
            </div>
            <div className="px-6 py-6">
              {renderFieldGrid(fields)}
            </div>
          </div>
        )
      })}

      {/* File Uploads */}
      <div className="bg-white rounded-xl border border-[#e0ddd4]">
        <div className="px-6 pt-6 pb-4 border-b border-[#e8e5dd]">
          <h2 className="font-[family-name:var(--font-cormorant)] text-2xl font-semibold text-[#1e1d1a]">
            File Uploads
          </h2>
          <p className="text-sm text-[#9a9890] font-[family-name:var(--font-jost)] mt-0.5">Upload your logo image (png or jpg) and event/delivery maps as needed.</p>
        </div>
        <div className="px-6 py-6 space-y-5">
          {UPLOAD_FIELDS.map((upload) => (
            <FileUploadField
              key={upload.name}
              {...upload}
              file={files[upload.name] || null}
              onFileChange={handleFileChange}
            />
          ))}
        </div>
      </div>

      {status === 'error' && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm font-[family-name:var(--font-jost)] rounded-lg">
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="w-full py-4 bg-[#1e1d1a] text-[#f0ede4] font-[family-name:var(--font-jost)] text-[15px] font-medium tracking-wider uppercase rounded-lg hover:bg-[#333028] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
      >
        {status === 'submitting' ? 'Submitting...' : 'Submit Intake Form'}
      </button>
    </form>
  )
}
