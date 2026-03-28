'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { INTAKE_FIELDS, UPLOAD_FIELDS, IntakeFieldDef } from '@/lib/intake-fields'

function validateField(field: IntakeFieldDef, value: string): string | null {
  const trimmed = value.trim()
  if (field.required && !trimmed) return `${field.label} is required`

  if (!trimmed) return null

  if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return 'Please enter a valid email address'
  }
  if (field.type === 'tel' && !/^[\d\s()+-]{7,}$/.test(trimmed)) {
    return 'Please enter a valid phone number'
  }
  if (field.type === 'number') {
    const num = Number(trimmed)
    if (isNaN(num) || num < 0) return 'Please enter a valid number'
    if (num === 0 && field.required) return `${field.label} must be greater than 0`
  }
  return null
}

function validateTimePairs(values: Record<string, string>): Record<string, string | null> {
  const errs: Record<string, string | null> = {}
  const setup = values.setupTime || ''
  const teardown = values.teardownTime || ''
  const serviceStart = values.serviceStart || ''
  const serviceEnd = values.serviceEnd || ''

  if (setup && teardown && teardown <= setup) {
    errs.teardownTime = 'Tear down must be after set up'
  }
  if (serviceStart && serviceEnd && serviceEnd <= serviceStart) {
    errs.serviceEnd = 'Service end must be after service start'
  }
  if (setup && serviceStart && serviceStart < setup) {
    errs.serviceStart = 'Service start cannot be before set up time'
  }
  if (teardown && serviceEnd && serviceEnd > teardown) {
    errs.serviceEnd = errs.serviceEnd || 'Service end cannot be after tear down time'
  }
  return errs
}

function FieldError({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <p className="mt-1.5 text-[13px] text-[#c44b2b] font-[family-name:var(--font-jost)]">
      {message}
    </p>
  )
}

function CustomSelect({ name, options, required, placeholder = 'Select...', error, onBlur, defaultValue }: {
  name: string
  options: string[]
  required: boolean
  placeholder?: string
  error?: string | null
  onBlur?: (value: string) => void
  defaultValue?: string
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(defaultValue || '')
  const [openUp, setOpenUp] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        if (open) onBlur?.(selected)
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, selected, onBlur])

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
          error
            ? 'border-[#c44b2b] ring-2 ring-[#c44b2b]/20'
            : open
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
              onClick={() => { setSelected(opt); setOpen(false); onBlur?.(opt) }}
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

function PlacesAutocomplete({ name, required, placeholder, baseClass, onBlur, onPlaceSelect }: {
  name: string
  required: boolean
  placeholder?: string
  baseClass: string
  onBlur?: (value: string) => void
  onPlaceSelect?: (name: string, valid: boolean) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const validAddressRef = useRef('')

  useEffect(() => {
    const input = inputRef.current
    if (!input || !window.google?.maps?.places) return

    const autocomplete = new window.google.maps.places.Autocomplete(input, {
      types: ['address'],
      componentRestrictions: { country: 'us' },
    })

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      if (place.formatted_address && inputRef.current) {
        inputRef.current.value = place.formatted_address
        validAddressRef.current = place.formatted_address
        onPlaceSelect?.(name, true)
        onBlur?.(place.formatted_address)
      }
    })
  }, [onBlur, name, onPlaceSelect])

  function handleBlur() {
    const current = inputRef.current?.value || ''
    if (current !== validAddressRef.current) {
      validAddressRef.current = ''
      onPlaceSelect?.(name, false)
    }
    onBlur?.(current)
  }

  return (
    <input
      ref={inputRef}
      name={name}
      type="text"
      required={required}
      placeholder={placeholder}
      className={baseClass}
      autoComplete="off"
      onBlur={handleBlur}
    />
  )
}

function FormField({ field, error, onBlur, onPlaceSelect, labelOverride, defaultValue }: { field: IntakeFieldDef; error?: string | null; onBlur?: (name: string, value: string) => void; onPlaceSelect?: (name: string, valid: boolean) => void; labelOverride?: string; defaultValue?: string }) {
  const hasError = !!error
  const normalClass =
    'w-full max-w-full rounded-lg px-4 py-3 border border-[#d8d5cc] bg-white text-[#1e1d1a] font-[family-name:var(--font-jost)] text-[15px] placeholder:text-[#bbb8b0] focus:outline-none focus:border-[#8b6914] focus:ring-2 focus:ring-[#8b6914]/20 transition-all box-border'
  const errorClass =
    'w-full max-w-full rounded-lg px-4 py-3 border border-[#c44b2b] bg-white text-[#1e1d1a] font-[family-name:var(--font-jost)] text-[15px] placeholder:text-[#bbb8b0] focus:outline-none focus:border-[#c44b2b] focus:ring-2 focus:ring-[#c44b2b]/20 transition-all box-border'
  const baseClass = hasError ? errorClass : normalClass

  function handleBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    onBlur?.(field.name, e.target.value)
  }

  return (
    <div>
      <label
        htmlFor={field.name}
        className="block text-[15px] font-medium text-[#1e1d1a] font-[family-name:var(--font-jost)] mb-1.5"
      >
        {labelOverride || field.label}
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
          error={error}
          onBlur={(value) => onBlur?.(field.name, value)}
          defaultValue={defaultValue}
        />
      ) : field.clickupFieldType === 'location' ? (
        <PlacesAutocomplete
          name={field.name}
          required={field.required}
          placeholder={field.placeholder}
          baseClass={baseClass}
          onBlur={(value) => onBlur?.(field.name, value)}
          onPlaceSelect={onPlaceSelect}
        />
      ) : field.type === 'textarea' ? (
        <textarea
          id={field.name}
          name={field.name}
          required={field.required}
          placeholder={field.placeholder}
          rows={3}
          className={`${baseClass} resize-none`}
          onBlur={handleBlur}
          defaultValue={defaultValue}
        />
      ) : (
        <input
          id={field.name}
          name={field.name}
          type={field.type}
          required={field.required}
          placeholder={field.placeholder}
          className={baseClass}
          {...(field.type === 'number' ? { min: 0 } : {})}
          onBlur={handleBlur}
          defaultValue={defaultValue}
        />
      )}
      <FieldError message={error} />
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

function renderFieldGrid(fields: IntakeFieldDef[], errors: Record<string, string | null>, onBlur: (name: string, value: string) => void, onPlaceSelect: (name: string, valid: boolean) => void, selectedPackage: string, initialValues: Record<string, string>) {
  const rows: React.ReactNode[] = []
  let i = 0

  while (i < fields.length) {
    const field = fields[i]
    const next = fields[i + 1]
    const label = (selectedPackage && field.labelByPackage?.[selectedPackage]) || undefined
    const nextLabel = next ? (selectedPackage && next.labelByPackage?.[selectedPackage]) || undefined : undefined

    if (field.half && next?.half) {
      rows.push(
        <div key={field.name} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField field={field} error={errors[field.name]} onBlur={onBlur} onPlaceSelect={onPlaceSelect} labelOverride={label} defaultValue={initialValues[field.name]} />
          <FormField field={next} error={errors[next.name]} onBlur={onBlur} onPlaceSelect={onPlaceSelect} labelOverride={nextLabel} defaultValue={initialValues[next.name]} />
        </div>
      )
      i += 2
    } else {
      rows.push(
        <div key={field.name}>
          <FormField field={field} error={errors[field.name]} onBlur={onBlur} onPlaceSelect={onPlaceSelect} labelOverride={label} defaultValue={initialValues[field.name]} />
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

export function IntakeForm({ taskId, initialValues = {} }: { taskId: string; initialValues?: Record<string, string> }) {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [files, setFiles] = useState<Record<string, File | null>>({})
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const [fileErrors, setFileErrors] = useState<Record<string, string | null>>({})
  const [selectedPackage, setSelectedPackage] = useState(initialValues.package || '')
  const validPlaces = useRef<Record<string, boolean>>({})

  const handlePlaceSelect = useCallback((name: string, valid: boolean) => {
    validPlaces.current[name] = valid
    if (valid) {
      setErrors((prev) => ({ ...prev, [name]: null }))
    }
  }, [])

  const handleFieldBlur = useCallback((name: string, value: string) => {
    if (name === 'package') setSelectedPackage(value)
    const field = INTAKE_FIELDS.find((f) => f.name === name)
    if (!field) return
    const error = validateField(field, value)
    setErrors((prev) => {
      const updated = { ...prev, [name]: error }

      // For location fields, validate that a Google place was selected
      if (!error && field.clickupFieldType === 'location' && value.trim()) {
        if (!validPlaces.current[name]) {
          updated[name] = 'Please select an address from the dropdown'
        }
      }

      // For time fields, run cross-field time pair validation
      if (field.type === 'time') {
        const form = document.querySelector('form')
        if (form) {
          const formData = new FormData(form)
          const values: Record<string, string> = {}
          for (const f of INTAKE_FIELDS) {
            if (f.type === 'time') {
              values[f.name] = f.name === name ? value : (formData.get(f.name) as string) || ''
            }
          }
          const timeErrors = validateTimePairs(values)
          for (const [key, msg] of Object.entries(timeErrors)) {
            if (msg) updated[key] = msg
          }
          // Clear time pair errors that are no longer present
          for (const f of INTAKE_FIELDS) {
            if (f.type === 'time' && !timeErrors[f.name] && !validateField(f, f.name === name ? value : (formData.get(f.name) as string) || '')) {
              updated[f.name] = null
            }
          }
        }
      }

      return updated
    })
  }, [])

  function handleFileChange(name: string, file: File | null) {
    setFiles((prev) => ({ ...prev, [name]: file }))
    // Clear file error when a file is selected
    if (file) setFileErrors((prev) => ({ ...prev, [name]: null }))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMsg('')

    // Validate all fields before submitting
    const formEl = e.currentTarget
    const formData = new FormData(formEl)
    const newErrors: Record<string, string | null> = {}
    let hasError = false

    const currentPackage = (formData.get('package') as string) || ''
    const timeValues: Record<string, string> = {}
    for (const field of INTAKE_FIELDS) {
      // Skip fields hidden by package selection
      if (field.hideWhenPackage?.includes(currentPackage)) continue

      const val = (formData.get(field.name) as string) || ''
      const error = validateField(field, val)
      newErrors[field.name] = error
      if (error) hasError = true

      if (field.type === 'time') timeValues[field.name] = val

      // Validate location fields have a Google-selected address
      if (field.clickupFieldType === 'location' && val.trim() && !error) {
        if (!validPlaces.current[field.name]) {
          newErrors[field.name] = 'Please select an address from the dropdown'
          hasError = true
        }
      }
    }

    // Validate time pairs (tear down after set up, service within set up/tear down)
    const timeErrors = validateTimePairs(timeValues)
    for (const [key, msg] of Object.entries(timeErrors)) {
      if (msg) {
        newErrors[key] = msg
        hasError = true
      }
    }

    // Validate required file uploads
    const newFileErrors: Record<string, string | null> = {}
    for (const upload of UPLOAD_FIELDS) {
      if (upload.required && !files[upload.name]) {
        newFileErrors[upload.name] = `${upload.label} is required`
        hasError = true
      } else {
        newFileErrors[upload.name] = null
      }
    }

    setErrors(newErrors)
    setFileErrors(newFileErrors)

    if (hasError) {
      // Scroll to first error
      const firstErrorField = [...INTAKE_FIELDS.map((f) => f.name), ...UPLOAD_FIELDS.map((u) => u.name)]
        .find((name) => newErrors[name] || newFileErrors[name])
      if (firstErrorField) {
        const el = document.querySelector(`[name="${firstErrorField}"]`) ||
          document.getElementById(`upload-${firstErrorField}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

    setStatus('submitting')

    // Build multipart form data with both fields and files
    const submitData = new FormData()

    // Add text fields
    for (const field of INTAKE_FIELDS) {
      const val = (formData.get(field.name) as string) || ''
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
        const fields = INTAKE_FIELDS.filter((f) => f.section === section.key && !(f.hideWhenPackage && f.hideWhenPackage.includes(selectedPackage)))
        return (
          <div key={section.key} className="bg-white rounded-xl border border-[#e0ddd4]">
            <div className="px-6 pt-6 pb-4 border-b border-[#e8e5dd]">
              <h2 className="font-[family-name:var(--font-cormorant)] text-2xl font-semibold text-[#1e1d1a]">
                {section.title}
              </h2>
              <p className="text-sm text-[#9a9890] font-[family-name:var(--font-jost)] mt-0.5">{section.description}</p>
            </div>
            <div className="px-6 py-6">
              {renderFieldGrid(fields, errors, handleFieldBlur, handlePlaceSelect, selectedPackage, initialValues)}
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
            <div key={upload.name} id={`upload-${upload.name}`}>
              <FileUploadField
                {...upload}
                file={files[upload.name] || null}
                onFileChange={handleFileChange}
              />
              <FieldError message={fileErrors[upload.name]} />
            </div>
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
