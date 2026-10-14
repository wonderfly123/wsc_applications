/**
 * ClickUp Docs (v3 API) for the ROS: one Doc per event under the Events list,
 * linked from the task's "ROS Doc" URL field. The first page holds the ROS as
 * markdown and is replaced on every new version.
 */

const V3 = (ws: string) => `https://api.clickup.com/api/v3/workspaces/${ws}`

async function docsJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const key = process.env.CLICKUP_API_KEY
  if (!key) throw new Error('CLICKUP_API_KEY not set')
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: key, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`ClickUp ${init.method ?? 'GET'} ${url} failed: ${res.status} ${text.slice(0, 200)}`)
  return (text ? JSON.parse(text) : {}) as T
}

/** Doc id from a link like https://app.clickup.com/<ws>/v/dc/<docId> (optionally /<pageId>). */
export function docIdFromUrl(url: string): string | null {
  return url.match(/\/v\/dc\/([^/?#]+)/)?.[1] ?? null
}

export const docUrl = (workspaceId: string, docId: string) => `https://app.clickup.com/${workspaceId}/v/dc/${docId}`

export interface UpsertRosDocParams {
  workspaceId: string
  listId: string
  title: string
  markdown: string
  /** Current value of the task's ROS Doc field, if any. */
  existingUrl?: string
}

async function firstPageId(ws: string, docId: string): Promise<string> {
  const pages = await docsJson<Array<{ id: string }>>(`${V3(ws)}/docs/${docId}/pages?max_page_depth=1`)
  if (!pages[0]?.id) throw new Error(`ClickUp doc ${docId} has no pages`)
  return pages[0].id
}

/**
 * Write the ROS markdown into the task's Doc, creating the Doc when there is
 * none (or the linked one is gone). Returns the Doc's URL.
 */
export async function upsertRosDoc(p: UpsertRosDocParams): Promise<string> {
  const ws = p.workspaceId
  let docId = p.existingUrl ? docIdFromUrl(p.existingUrl) : null
  let pageId: string | null = null
  if (docId) {
    try {
      pageId = await firstPageId(ws, docId)
    } catch (err) {
      console.warn(`ROS Doc ${docId} unreadable, creating a new one:`, err)
      docId = null
    }
  }
  if (!docId) {
    const created = await docsJson<{ id: string }>(`${V3(ws)}/docs`, {
      method: 'POST',
      body: JSON.stringify({ name: p.title, parent: { id: p.listId, type: 6 }, visibility: 'PUBLIC', create_page: true }),
    })
    docId = created.id
    pageId = await firstPageId(ws, docId)
  }
  await docsJson(`${V3(ws)}/docs/${docId}/pages/${pageId}`, {
    method: 'PUT',
    body: JSON.stringify({ name: 'Run of Show', content: p.markdown, content_edit_mode: 'replace', content_format: 'text/md' }),
  })
  return docUrl(ws, docId)
}
