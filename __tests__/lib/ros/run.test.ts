// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { runRos, type RosDeps } from '@/lib/ros/run'
import { LJBTC_EXEMPLAR } from '@/lib/ros/exemplar'
import { computeFingerprint } from '@/lib/ros/fingerprint'
import type { ClickUpTask } from '@/lib/ros/types'

const INTAKE = 'dbeda913-50e7-4988-9f1d-d28ec26a9a6d'
const FP = 'fp-field'
const ROSF = 'ros-field'
const DOCF = 'ros-doc-field'
const NOW = new Date('2026-10-08T14:00:00Z')
const DAY = 86_400_000
const intakeYes = {
  id: INTAKE,
  name: 'Intake Form Complete',
  type: 'drop_down',
  value: 0,
  type_config: { options: [{ id: 'y', name: 'Yes', orderindex: 0 }, { id: 'n', name: 'No', orderindex: 1 }] },
}

function mkTask(id: string, over: Partial<ClickUpTask> = {}): ClickUpTask {
  return {
    id,
    name: `Event ${id}`,
    team_id: 'ws1',
    status: { status: 'to do' },
    date_created: String(NOW.getTime() - 10 * DAY),
    start_date: String(NOW.getTime() + 3 * DAY),
    custom_fields: [
      intakeYes,
      { id: FP, name: 'ROS Fingerprint', type: 'text', value: '' },
      { id: ROSF, name: 'ROS', type: 'attachment', value: [] },
    ],
    attachments: [],
    ...over,
  }
}

type Calls = Record<'upload' | 'setFiles' | 'comment' | 'setField' | 'compose' | 'email' | 'doc', unknown[][]>

function mkDeps(tasks: ClickUpTask[], over: Partial<RosDeps> = {}): RosDeps & { calls: Calls } {
  const calls: Calls = { upload: [], setFiles: [], comment: [], setField: [], compose: [], email: [], doc: [] }
  const rec =
    (k: keyof Calls) =>
    (...a: unknown[]) => {
      calls[k].push(a)
      return Promise.resolve()
    }
  const deps: RosDeps & { calls: Calls } = {
    calls,
    listId: 'list1',
    now: () => NOW,
    dryRun: false,
    timeBudgetMs: 240_000,
    trentUserId: undefined,
    clickup: {
      listOpenTasks: async () => tasks,
      fetchRawTask: async (id) => {
        const t = tasks.find((x) => x.id === id)
        if (!t) throw new Error(`no task ${id}`)
        return t
      },
      fetchTaskComments: async () => [],
      findListFieldByName: async (_list, name) =>
        name === 'ROS Fingerprint' ? { id: FP } : name === 'ROS' ? { id: ROSF } : name === 'ROS Doc' ? { id: DOCF } : null,
      uploadToFilesField: async (...a: unknown[]) => {
        calls.upload.push(a)
        return 'new-att-id.docx'
      },
      setFilesFieldValue: rec('setFiles'),
      postComment: rec('comment'),
      setTextField: rec('setField'),
      downloadAttachment: async () => Buffer.from('PK'),
      upsertRosDoc: async (p) => {
        calls.doc.push([p])
        return 'https://app.clickup.com/ws1/v/dc/doc1'
      },
    },
    searchMail: async () => ({ excerpts: [], failedMailboxes: [] }),
    compose: async (inputs) => {
      calls.compose.push([inputs])
      return { ...LJBTC_EXEMPLAR, changes: inputs.mode === 'update' ? ['Something changed'] : null }
    },
    render: async () => Buffer.from('DOCX'),
    extract: async () => 'EXISTING TEXT',
    sendDraftEmail: rec('email'),
    ...over,
  }
  return deps
}

/** A task whose ROS field already holds v1. */
const withRos = (id: string) =>
  mkTask(id, {
    custom_fields: [
      intakeYes,
      { id: FP, name: 'ROS Fingerprint', type: 'text', value: '' },
      { id: ROSF, name: 'ROS', type: 'attachment', value: [{ id: 'old-att-id.docx', title: `[ROS] Event ${id} v1.docx`, url: 'u', date: '1' }] },
    ],
  })

const storeFingerprint = (t: ClickUpTask) => {
  const fp = computeFingerprint({ task: t, comments: [], messageIds: [], excludeFieldIds: [FP, ROSF] })
  t.custom_fields = t.custom_fields.map((f) => (f.id === FP ? { ...f, value: fp } : f))
  return t
}

describe('runRos', () => {
  it('CREATE: empty ROS field → compose v1, upload to the field, link it, comment, store fingerprint', async () => {
    const deps = mkDeps([mkTask('a')])
    const s = await runRos(deps)
    expect(s).toMatchObject({ considered: 1, created: 1, updated: 0, skipped: 0, failed: [] })
    expect(deps.calls.compose[0][0]).toMatchObject({ mode: 'create' })
    expect(deps.calls.upload[0].slice(0, 2)).toEqual(['ws1', ROSF])
    expect(deps.calls.upload[0][3]).toBe('[ROS] Event a v1.docx')
    expect(deps.calls.setFiles[0]).toEqual(['a', ROSF, { add: ['new-att-id.docx'], rem: [] }])
    expect(String(deps.calls.comment[0][1])).toMatch(/^\[ROS\] v1 drafted/)
    expect(deps.calls.comment[0][2]).toBeUndefined()
    expect(deps.calls.doc[0][0]).toMatchObject({ workspaceId: 'ws1', listId: 'list1', title: '[ROS] Event a' })
    expect(deps.calls.setField[0]).toEqual(['a', DOCF, 'https://app.clickup.com/ws1/v/dc/doc1'])
    expect(deps.calls.setField[1][1]).toBe(FP)
  })

  it('SKIP: stored fingerprint matches → no compose, no writes', async () => {
    const deps = mkDeps([storeFingerprint(withRos('a'))])
    const s = await runRos(deps)
    expect(s).toMatchObject({ skipped: 1, created: 0, updated: 0 })
    expect(deps.calls.compose).toHaveLength(0)
    expect(deps.calls.upload).toHaveLength(0)
  })

  it('UPDATE: file in field and fingerprint differs → extract existing, compose update, replace with v2', async () => {
    const deps = mkDeps([withRos('a')])
    const s = await runRos(deps)
    expect(s).toMatchObject({ updated: 1 })
    expect(deps.calls.compose[0][0]).toMatchObject({ mode: 'update', existingRosText: 'EXISTING TEXT', previousVersion: 1 })
    expect(deps.calls.upload[0][3]).toBe('[ROS] Event a v2.docx')
    expect(deps.calls.setFiles[0]).toEqual(['a', ROSF, { add: ['new-att-id.docx'], rem: ['old-att-id.docx'] }])
    expect(String(deps.calls.comment[0][1])).toContain('Something changed')
  })

  it('a hand-edited file re-uploaded under any name is treated as the current ROS', async () => {
    const t = mkTask('a', {
      custom_fields: [
        intakeYes,
        { id: FP, name: 'ROS Fingerprint', type: 'text', value: '' },
        { id: ROSF, name: 'ROS', type: 'attachment', value: [{ id: 'manual.docx', title: 'Palm Tree edited by Trent.docx', url: 'u', date: '1' }] },
      ],
    })
    const deps = mkDeps([t])
    expect((await runRos(deps)).updated).toBe(1)
    expect(deps.calls.compose[0][0]).toMatchObject({ mode: 'update', existingRosText: 'EXISTING TEXT' })
    expect(deps.calls.upload[0][3]).toBe('[ROS] Event a v2.docx')
    expect(deps.calls.setFiles[0]).toEqual(['a', ROSF, { add: ['new-att-id.docx'], rem: ['manual.docx'] }])
  })

  it('the ROS files field value never feeds the fingerprint', async () => {
    const t = storeFingerprint(withRos('a'))
    const changedRosField: ClickUpTask = {
      ...t,
      custom_fields: t.custom_fields.map((f) =>
        f.id === ROSF ? { ...f, value: [{ id: 'different.docx', title: '[ROS] Event a v3.docx', url: 'u' }] } : f
      ),
    }
    const deps = mkDeps([changedRosField])
    expect((await runRos(deps)).skipped).toBe(1)
  })

  it('taskId processes one task regardless of window', async () => {
    const far = mkTask('far', { start_date: String(NOW.getTime() + 60 * DAY) })
    const deps = mkDeps([far])
    expect((await runRos(deps)).considered).toBe(0)
    expect((await runRos(deps, { taskId: 'far' })).created).toBe(1)
  })

  it('force bypasses SKIP when the stored fingerprint matches', async () => {
    const deps = mkDeps([storeFingerprint(withRos('a'))])
    expect((await runRos(deps)).skipped).toBe(1)
    expect((await runRos(deps, { taskId: 'a', force: true })).updated).toBe(1)
  })

  it('dry run emails the file and writes nothing to ClickUp', async () => {
    const deps = mkDeps([mkTask('a')], { dryRun: true })
    const s = await runRos(deps)
    expect(s.dryRun).toBe(true)
    expect(deps.calls.email).toHaveLength(1)
    expect(deps.calls.upload).toHaveLength(0)
    expect(deps.calls.setFiles).toHaveLength(0)
    expect(deps.calls.comment).toHaveLength(0)
    expect(deps.calls.setField).toHaveLength(0)
  })

  it('one failing task does not stop the others', async () => {
    const deps = mkDeps([mkTask('bad'), mkTask('good')], {
      compose: async (inputs) => {
        if (inputs.task.id === 'bad') throw new Error('boom')
        return LJBTC_EXEMPLAR
      },
    })
    const s = await runRos(deps)
    expect(s.created).toBe(1)
    expect(s.failed).toEqual([{ taskId: 'bad', error: 'boom' }])
  })

  it('defers tasks once the time budget is spent', async () => {
    let t = NOW.getTime()
    const deps = mkDeps([mkTask('a'), mkTask('b')], { timeBudgetMs: 1, now: () => new Date((t += 1000)) })
    const s = await runRos(deps)
    expect(s.created + s.deferred).toBe(2)
    expect(s.deferred).toBeGreaterThanOrEqual(1)
  })

  it('fails fast when either bot field is missing', async () => {
    const base = mkDeps([mkTask('a')])
    const noFp = mkDeps([mkTask('a')], { clickup: { ...base.clickup, findListFieldByName: async () => null } })
    await expect(runRos(noFp)).rejects.toThrow(/ROS Fingerprint/)
    const noRos = mkDeps([mkTask('a')], {
      clickup: { ...base.clickup, findListFieldByName: async (_l, name) => (name === 'ROS Fingerprint' ? { id: FP } : null) },
    })
    await expect(runRos(noRos)).rejects.toThrow(/"ROS" not found/)
  })

  it('reuses the linked ROS Doc and does not rewrite the link', async () => {
    const t = withRos('a')
    t.custom_fields.push({ id: DOCF, name: 'ROS Doc', type: 'url', value: 'https://app.clickup.com/ws1/v/dc/doc1' })
    const deps = mkDeps([t])
    expect((await runRos(deps)).updated).toBe(1)
    expect(deps.calls.doc[0][0]).toMatchObject({ existingUrl: 'https://app.clickup.com/ws1/v/dc/doc1' })
    expect(deps.calls.setField.map((c) => c[1])).toEqual([FP])
  })

  it('a ROS Doc failure is a warning; the Word file and comment still land', async () => {
    const base = mkDeps([mkTask('a')])
    const deps = mkDeps([mkTask('a')], {
      clickup: {
        ...base.clickup,
        upsertRosDoc: async () => {
          throw new Error('docs down')
        },
      },
    })
    const s = await runRos(deps)
    expect(s.created).toBe(1)
    expect(s.warnings.join(' ')).toContain('docs down')
    // base.clickup's recorders write into base.calls
    expect(base.calls.upload).toHaveLength(1)
    expect(base.calls.comment).toHaveLength(1)
  })

  it('skips the Doc when the list has no ROS Doc field', async () => {
    const base = mkDeps([mkTask('a')])
    const deps = mkDeps([mkTask('a')], {
      clickup: {
        ...base.clickup,
        findListFieldByName: async (_l, name) => (name === 'ROS Fingerprint' ? { id: FP } : name === 'ROS' ? { id: ROSF } : null),
      },
    })
    expect((await runRos(deps)).created).toBe(1)
    expect(deps.calls.doc).toHaveLength(0)
  })

  it('discrepancies are called out in the comment', async () => {
    const deps = mkDeps([mkTask('a')], {
      compose: async () => ({
        ...LJBTC_EXEMPLAR,
        discrepancies: [{ item: 'Headcount', clickup: '150', other: '200', source: 'Harrison email, Oct 12' }],
      }),
    })
    await runRos(deps)
    expect(String(deps.calls.comment[0][1])).toContain('DISCREPANCIES: Headcount (ClickUp: 150; Harrison email, Oct 12: 200)')
  })

  it('a failed mailbox is a warning and the task still proceeds', async () => {
    const deps = mkDeps([mkTask('a')], {
      searchMail: async () => ({ excerpts: [], failedMailboxes: ['trent@windanseacoconuts.com'] }),
    })
    const s = await runRos(deps)
    expect(s.warnings.join(' ')).toContain('trent@windanseacoconuts.com')
    expect(s.created).toBe(1)
  })
})
