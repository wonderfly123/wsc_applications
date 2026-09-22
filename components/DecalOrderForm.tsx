'use client'

import { FormEvent, useEffect, useState } from 'react'
import {
  DECAL_SIZES,
  DECAL_SIZE_LABELS,
  DECAL_RECIPIENT,
  DECAL_CC,
  MAX_LOGO_BYTES,
  ALLOWED_LOGO_EXTENSIONS,
  DecalSize,
  validateDecalOrder,
  validateLogoFile,
} from '@/lib/decal'

const STORAGE_KEY = 'decal_form_password'

const inputClass =
  'w-full px-4 py-3 bg-[#faf9f6] border border-[#e0ddd4] rounded-sm text-[15px] text-[#1e1d1a] font-[family-name:var(--font-jost)] placeholder:text-[#b5b2a8] focus:outline-none focus:border-[#878774] transition-colors'
const labelClass = 'block text-[13px] font-medium text-[#1e1d1a] font-[family-name:var(--font-jost)] mb-2'
const buttonClass =
  'w-full py-4 bg-[#1e1d1a] text-[#f0ede4] font-[family-name:var(--font-jost)] text-[15px] font-medium tracking-wider uppercase rounded-sm hover:bg-[#333028] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm'
const errorClass =
  'p-4 bg-red-50 border border-red-200 text-red-700 text-sm font-[family-name:var(--font-jost)] rounded-sm'

function readStoredPassword(): string {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function storePassword(pw: string | null) {
  try {
    if (pw) sessionStorage.setItem(STORAGE_KEY, pw)
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // storage unavailable — the password just won't persist across reloads
  }
}

export function DecalOrderForm() {
  const [password, setPassword] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [checking, setChecking] = useState(false)
  const [gateError, setGateError] = useState<string | null>(null)

  useEffect(() => {
    const saved = readStoredPassword()
    if (saved) {
      setPassword(saved)
      setUnlocked(true)
    }
  }, [])

  async function handleUnlock(e: FormEvent) {
    e.preventDefault()
    setChecking(true)
    setGateError(null)
    try {
      const fd = new FormData()
      fd.set('action', 'unlock')
      fd.set('password', password)
      const res = await fetch('/api/decal', { method: 'POST', body: fd })
      if (res.ok) {
        storePassword(password)
        setUnlocked(true)
      } else {
        setGateError(res.status === 401 ? 'Incorrect password' : 'Something went wrong, try again')
      }
    } catch {
      setGateError('Network error, try again')
    } finally {
      setChecking(false)
    }
  }

  function relock() {
    storePassword(null)
    setPassword('')
    setUnlocked(false)
  }

  if (!unlocked) {
    return (
      <form onSubmit={handleUnlock} className="bg-white rounded-sm border border-[#e0ddd4] p-8 max-w-md mx-auto">
        <h1 className="font-[family-name:var(--font-cormorant)] text-3xl font-semibold text-[#1e1d1a] mb-2">
          Order a decal
        </h1>
        <p className="text-sm text-[#878774] font-[family-name:var(--font-jost)] mb-6">
          This form is for the Windansea team. Enter the password to continue.
        </p>
        <label className={labelClass} htmlFor="decal-password">
          Password
        </label>
        <input
          id="decal-password"
          type="password"
          autoComplete="off"
          className={inputClass}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {gateError && <div className={`${errorClass} mt-4`}>{gateError}</div>}
        <button type="submit" disabled={checking || !password} className={`${buttonClass} mt-6`}>
          {checking ? 'Checking…' : 'Continue'}
        </button>
      </form>
    )
  }

  return <OrderForm password={password} onUnauthorized={relock} />
}

function OrderForm({ password, onUnauthorized }: { password: string; onUnauthorized: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [job, setJob] = useState('')
  const [size, setSize] = useState<DecalSize | ''>('')
  const [quantity, setQuantity] = useState('1')
  const [neededBy, setNeededBy] = useState('')
  const [notes, setNotes] = useState('')
  const [rush, setRush] = useState(false)
  const [logo, setLogo] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  function reset() {
    setJob('')
    setSize('')
    setQuantity('1')
    setNeededBy('')
    setNotes('')
    setRush(false)
    setLogo(null)
    setError(null)
    setSent(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const check = validateDecalOrder({ name, email, job, size, quantity, neededBy, notes, rush })
    if (!check.ok) {
      setError(check.error)
      return
    }
    const fileError = validateLogoFile(logo ? { name: logo.name, size: logo.size } : null)
    if (fileError) {
      setError(fileError)
      return
    }

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.set('password', password)
      fd.set('name', name)
      fd.set('email', email)
      fd.set('job', job)
      fd.set('size', size)
      fd.set('quantity', quantity)
      fd.set('neededBy', neededBy)
      fd.set('notes', notes)
      if (rush) fd.set('rush', 'on')
      if (logo) fd.set('logo', logo, logo.name)

      const res = await fetch('/api/decal', { method: 'POST', body: fd })
      if (res.status === 401) {
        onUnauthorized()
        return
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Something went wrong sending the order')
        return
      }
      setSent(true)
    } catch {
      setError('Network error, please try again')
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <div className="bg-white rounded-sm border border-[#e0ddd4] p-10 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#1e1d1a] flex items-center justify-center">
          <svg className="w-8 h-8 text-[#f0ede4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-[family-name:var(--font-cormorant)] text-3xl font-semibold text-[#1e1d1a] mb-2">
          Order sent
        </h2>
        <p className="text-sm text-[#878774] font-[family-name:var(--font-jost)] mb-1">
          {quantity} × {size}&quot; decal{Number(quantity) === 1 ? '' : 's'} for <strong className="text-[#1e1d1a]">{job}</strong>
        </p>
        <p className="text-sm text-[#878774] font-[family-name:var(--font-jost)] mb-8">
          Emailed to {DECAL_RECIPIENT}, cc {DECAL_CC}. Replies go to Trent.
        </p>
        <button type="button" onClick={reset} className={buttonClass}>
          Send another order
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-cormorant)] text-4xl font-semibold text-[#1e1d1a] mb-2">
          Order a decal
        </h1>
        <p className="text-[15px] text-[#878774] font-[family-name:var(--font-jost)] leading-relaxed">
          Fill in the job details and this sends an email to Marcus with everything he needs, logo attached.
          Windansea decals run either 40&quot; or 20&quot; wide — pick the size below.
        </p>
      </div>

      <div className="bg-white rounded-sm border border-[#e0ddd4] p-6 sm:p-8 space-y-6">
        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label className={labelClass} htmlFor="name">Your name</label>
            <input id="name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Harrison" required />
          </div>
          <div>
            <label className={labelClass} htmlFor="email">Your email</label>
            <input id="email" type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@windanseacoconuts.com" required />
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="job">Job / event name</label>
          <input id="job" className={inputClass} value={job} onChange={(e) => setJob(e.target.value)} placeholder="e.g. Miramar activation, Day in the Stoke" required />
        </div>

        <fieldset>
          <legend className={labelClass}>Decal size</legend>
          <div className="grid sm:grid-cols-2 gap-4">
            {DECAL_SIZES.map((s) => {
              const selected = size === s
              return (
                <label
                  key={s}
                  className={`cursor-pointer rounded-sm border-2 p-6 flex flex-col items-center gap-4 transition-colors ${
                    selected ? 'border-[#1e1d1a] bg-[#faf9f6]' : 'border-[#e0ddd4] bg-[#faf9f6] hover:border-[#bbb8b0]'
                  }`}
                >
                  <input type="radio" name="size" value={s} checked={selected} onChange={() => setSize(s)} className="sr-only" />
                  <div className="w-40 h-16 rounded-md border-2 border-[#bbb8b0] flex items-center justify-center">
                    <div className={`${s === '40' ? 'w-32' : 'w-16'} h-8 rounded-sm border-2 border-dashed border-[#878774] bg-[#878774]/20`} />
                  </div>
                  <div className="text-center">
                    <div className="font-[family-name:var(--font-cormorant)] text-3xl font-semibold text-[#1e1d1a]">{s}&quot;</div>
                    <div className="text-xs text-[#878774] font-[family-name:var(--font-jost)]">{DECAL_SIZE_LABELS[s].replace(/^\d+" /, '')}</div>
                  </div>
                </label>
              )
            })}
          </div>
        </fieldset>

        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label className={labelClass} htmlFor="quantity">Quantity</label>
            <input id="quantity" type="number" min={1} max={500} step={1} className={inputClass} value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
          </div>
          <div>
            <label className={labelClass} htmlFor="neededBy">Needed by</label>
            <input id="neededBy" type="date" className={inputClass} value={neededBy} onChange={(e) => setNeededBy(e.target.value)} required />
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="logo">Logo file</label>
          <label
            htmlFor="logo"
            className="flex items-center gap-4 p-5 border-2 border-dashed border-[#d5d2c9] rounded-sm bg-[#faf9f6] cursor-pointer hover:border-[#878774] transition-colors"
          >
            <div className="w-12 h-12 rounded-sm bg-white border border-[#e0ddd4] flex items-center justify-center text-[#878774] shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0-12l-4 4m4-4l4 4" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="text-[15px] font-medium text-[#1e1d1a] font-[family-name:var(--font-jost)] truncate">
                {logo ? logo.name : 'Click to choose a logo file'}
              </div>
              <div className="text-xs text-[#878774] font-[family-name:var(--font-jost)]">
                {ALLOWED_LOGO_EXTENSIONS.map((x) => x.toUpperCase()).join(', ')} · vector preferred · under {Math.round(MAX_LOGO_BYTES / 1024 / 1024)} MB
              </div>
            </div>
          </label>
          <input
            id="logo"
            type="file"
            accept={ALLOWED_LOGO_EXTENSIONS.map((x) => `.${x}`).join(',')}
            className="sr-only"
            onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="notes">Placement / notes</label>
          <textarea id="notes" rows={4} className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Die cut if possible, center on cooler lid, match Pantone 356C green, etc." />
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={rush} onChange={(e) => setRush(e.target.checked)} className="w-5 h-5 accent-[#1e1d1a]" />
          <span className="text-[15px] font-medium text-[#1e1d1a] font-[family-name:var(--font-jost)]">This is a rush order</span>
        </label>
      </div>

      {error && <div className={errorClass}>{error}</div>}

      <button type="submit" disabled={submitting} className={buttonClass}>
        {submitting ? 'Sending…' : 'Email order to Marcus'}
      </button>
      <p className="text-center text-xs text-[#878774] font-[family-name:var(--font-jost)]">
        Sends to <span className="text-[#1e1d1a]">{DECAL_RECIPIENT}</span> · cc <span className="text-[#1e1d1a]">{DECAL_CC}</span>
      </p>
    </form>
  )
}
