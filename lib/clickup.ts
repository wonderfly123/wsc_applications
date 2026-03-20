import { BEOData, FIELD_MAP } from './types'

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
  for (const [key, fieldId] of Object.entries(FIELD_MAP)) {
    const field = fieldById.get(fieldId)
    result[key as keyof BEOData] = field ? resolveFieldValue(field) : '\u2014'
  }
  return result
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
  return parseCustomFields(task.custom_fields ?? [])
}
