import { BEOData, BEOAttachment, FIELD_MAP, ATTACHMENT_FIELDS } from './types'
import { INTAKE_FIELDS } from './intake-fields'

interface ClickUpCustomField {
  id: string
  value: unknown
  type_config?: {
    options?: Array<{ id: string; name: string; orderindex: number }>
  }
}

function resolveFieldValue(field: ClickUpCustomField): string {
  const { value, type_config } = field

  if (value === null || value === undefined || value === '') return '\u2014'

  // Dropdown fields: value is the orderindex number, resolve to option name
  if (type_config?.options && typeof value === 'number') {
    const option = type_config.options.find((o) => o.orderindex === value)
    return option?.name ?? '\u2014'
  }

  // Location fields (object with formatted_address)
  if (typeof value === 'object' && value !== null && 'formatted_address' in value) {
    return (value as { formatted_address: string }).formatted_address || '\u2014'
  }

  // Boolean fields
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'

  // Date fields (ClickUp stores as epoch ms string or number)
  const numVal = Number(value)
  if (!isNaN(numVal) && numVal > 1_000_000_000_000) {
    return new Date(numVal).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  }

  return String(value)
}

export function parseCustomFields(customFields: ClickUpCustomField[]): BEOData {
  const fieldById = new Map(customFields.map((f) => [f.id, f]))

  const result = {} as BEOData
  result.eventName = '\u2014'
  for (const [key, fieldId] of Object.entries(FIELD_MAP)) {
    const field = fieldById.get(fieldId)
    ;(result as unknown as Record<string, unknown>)[key] = field ? resolveFieldValue(field) : '\u2014'
  }

  // Extract attachments from attachment fields
  const attachments: BEOAttachment[] = []
  for (const { id: fieldId, category } of ATTACHMENT_FIELDS) {
    const field = fieldById.get(fieldId)
    if (field?.value && Array.isArray(field.value)) {
      for (const att of field.value) {
        if (att.url) {
          attachments.push({ title: att.title ?? '', url: att.url, mimetype: att.mimetype ?? '', category })
        }
      }
    }
  }
  result.attachments = attachments

  return result
}

export async function createTask(
  name: string,
  description: string,
  customFields?: Array<{ id: string; value: unknown }>,
  options?: { startDate?: number; dueDate?: number }
): Promise<{ id: string; name: string }> {
  const apiKey = process.env.CLICKUP_API_KEY
  const listId = process.env.CLICKUP_LIST_ID
  if (!apiKey) throw new Error('CLICKUP_API_KEY not set')
  if (!listId) throw new Error('CLICKUP_LIST_ID not set')

  const body: Record<string, unknown> = { name, description }
  if (customFields?.length) {
    body.custom_fields = customFields
  }
  if (options?.startDate) {
    body.start_date = options.startDate
    body.start_date_time = true
  }
  if (options?.dueDate) {
    body.due_date = options.dueDate
    body.due_date_time = true
  }

  const res = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`ClickUp createTask failed: ${res.status}`)
  }

  const task = await res.json()
  return { id: task.id, name: task.name }
}

export async function updateTaskFields(
  taskId: string,
  fields: Array<{ id: string; value: unknown; value_options?: Record<string, unknown> }>
): Promise<void> {
  const apiKey = process.env.CLICKUP_API_KEY
  if (!apiKey) throw new Error('CLICKUP_API_KEY not set')

  const results = await Promise.allSettled(
    fields.map((field) => {
      const body: Record<string, unknown> = { value: field.value }
      if (field.value_options) body.value_options = field.value_options
      return fetch(`https://api.clickup.com/api/v2/task/${taskId}/field/${field.id}`, {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }).then((res) => {
        if (!res.ok) throw new Error(`ClickUp field update failed: ${field.id} — ${res.status}`)
      })
    })
  )

  const failures = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
  if (failures.length > 0) {
    throw new Error(failures.map((f) => f.reason?.message || f.reason).join('; '))
  }
}

export async function fetchTaskInitialValues(taskId: string): Promise<Record<string, string>> {
  const apiKey = process.env.CLICKUP_API_KEY
  if (!apiKey) return {}

  const res = await fetch(
    `https://api.clickup.com/api/v2/task/${taskId}?custom_task_ids=false&include_subtasks=false`,
    { headers: { Authorization: apiKey }, next: { revalidate: 0 } }
  )
  if (!res.ok) return {}

  const task = await res.json()
  const values: Record<string, string> = {}

  // Task name → eventName
  if (task.name) values.eventName = task.name

  // Map custom fields by ID to intake field names
  const fieldIdToName = new Map<string, { name: string; clickupFieldType: string; options?: string[] }>()
  for (const f of INTAKE_FIELDS) {
    if (f.clickupFieldId) fieldIdToName.set(f.clickupFieldId, { name: f.name, clickupFieldType: f.clickupFieldType, options: f.options })
  }

  for (const cf of task.custom_fields ?? []) {
    const mapping = fieldIdToName.get(cf.id)
    if (!mapping || cf.value === null || cf.value === undefined || cf.value === '') continue

    if (mapping.clickupFieldType === 'drop_down' && typeof cf.value === 'number') {
      // Resolve orderindex to option name
      const option = cf.type_config?.options?.find(
        (o: { orderindex: number; name: string }) => o.orderindex === cf.value
      )
      if (option) values[mapping.name] = option.name
    } else if (mapping.clickupFieldType === 'number') {
      values[mapping.name] = String(cf.value)
    } else if (mapping.clickupFieldType === 'phone') {
      values[mapping.name] = String(cf.value)
    } else if (typeof cf.value === 'string') {
      values[mapping.name] = cf.value
    }
  }

  return values
}

export async function fetchTask(taskId: string): Promise<BEOData | null> {
  const apiKey = process.env.CLICKUP_API_KEY
  if (!apiKey) throw new Error('CLICKUP_API_KEY not set')

  const res = await fetch(
    `https://api.clickup.com/api/v2/task/${taskId}?custom_task_ids=false&include_subtasks=false`,
    {
      headers: { Authorization: apiKey },
      next: { revalidate: 0 },
    }
  )

  if (!res.ok) return null

  const task = await res.json()
  const data = parseCustomFields(task.custom_fields ?? [])
  data.eventName = task.name ?? '\u2014'

  // Also check task-level attachments for prefixed uploads
  if (task.attachments && Array.isArray(task.attachments)) {
    for (const att of task.attachments) {
      const title = att.title || att.name || ''
      const url = att.url || ''
      const mimetype = att.mimetype || ''
      if (title.startsWith('[STAMP LOGO]')) {
        data.attachments.push({ title, url, mimetype, category: 'Stamp Logo' })
      } else if (title.startsWith('[DELIVERY MAP]')) {
        data.attachments.push({ title, url, mimetype, category: 'Delivery Map' })
      } else {
        data.attachments.push({ title, url, mimetype, category: 'Other' })
      }
    }
  }

  return data
}
