// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  listOpenTasks,
  fetchRawTask,
  fetchTaskComments,
  findListFieldByName,
  uploadAttachment,
  postComment,
  setTextField,
  downloadAttachment,
} from '@/lib/clickup'

const json = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
  arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
})

describe('clickup ROS helpers', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    process.env.CLICKUP_API_KEY = 'key'
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('listOpenTasks follows pagination until last_page', async () => {
    fetchMock.mockResolvedValueOnce(json({ tasks: [{ id: 'a', custom_fields: [] }], last_page: false }))
    fetchMock.mockResolvedValueOnce(json({ tasks: [{ id: 'b', custom_fields: [] }], last_page: true }))
    const tasks = await listOpenTasks('list1')
    expect(tasks.map((t) => t.id)).toEqual(['a', 'b'])
    expect(fetchMock.mock.calls[0][0]).toContain('/list/list1/task?')
    expect(fetchMock.mock.calls[0][0]).toContain('page=0')
    expect(fetchMock.mock.calls[0][0]).toContain('include_closed=false')
    expect(fetchMock.mock.calls[0][0]).toContain('subtasks=false')
    expect(fetchMock.mock.calls[1][0]).toContain('page=1')
  })

  it('fetchRawTask and fetchTaskComments hit the task endpoints', async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 't', name: 'T', custom_fields: [], attachments: [] }))
    expect((await fetchRawTask('t')).name).toBe('T')
    fetchMock.mockResolvedValueOnce(json({ comments: [{ id: 'c', comment_text: 'hi', date: '1' }] }))
    expect((await fetchTaskComments('t'))[0].id).toBe('c')
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.clickup.com/api/v2/task/t/comment')
  })

  it('findListFieldByName matches exactly and returns null when absent', async () => {
    fetchMock.mockResolvedValue(
      json({ fields: [{ id: 'f1', name: 'ROS Fingerprint', type: 'text' }, { id: 'f2', name: 'Other', type: 'text' }] })
    )
    expect(await findListFieldByName('list1', 'ROS Fingerprint')).toEqual({ id: 'f1', name: 'ROS Fingerprint', type: 'text' })
    expect(await findListFieldByName('list1', 'ros fingerprint')).toBeNull()
  })

  it('uploadAttachment posts multipart with the filename', async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 'att' }))
    await uploadAttachment(
      't',
      Buffer.from('abc'),
      'file.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.clickup.com/api/v2/task/t/attachment')
    expect(init.method).toBe('POST')
    const fd = init.body as FormData
    expect((fd.get('attachment') as File).name).toBe('file.docx')
  })

  it('postComment sends comment_text and optional assignee; setTextField posts the value', async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 'c' }))
    await postComment('t', '[ROS] v1 drafted', 42)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ comment_text: '[ROS] v1 drafted', notify_all: false, assignee: 42 })
    fetchMock.mockResolvedValueOnce(json({}))
    await setTextField('t', 'f1', 'abc')
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.clickup.com/api/v2/task/t/field/f1')
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ value: 'abc' })
  })

  it('downloadAttachment returns a Buffer and throws on non-2xx', async () => {
    fetchMock.mockResolvedValueOnce(json({}))
    expect((await downloadAttachment('https://x/y')).length).toBe(3)
    fetchMock.mockResolvedValueOnce(json({}, false, 404))
    await expect(downloadAttachment('https://x/z')).rejects.toThrow(/404/)
  })
})
