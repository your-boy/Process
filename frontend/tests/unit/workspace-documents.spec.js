import { describe, expect, it } from 'vitest'
import { createWorkspaceDocumentRepository } from '../../src/workspace/workspaceDocuments'

const identityNormalize = value => ({ ...value })
const clone = value => JSON.parse(JSON.stringify(value))
const translate = key => key
const keysById = new Map()
let counter = 0

const repository = createWorkspaceDocumentRepository({
  normalizeDocument: identityNormalize,
  cloneDocument: clone,
  translate,
  allocateKey: () => `workspace-${++counter}`,
  keysById
})

describe('workspace document repository', () => {
  it('normalizes drafts without dropping their key', () => {
    const [item] = repository.normalizeWorkspaceDocuments([{
      key: 'workspace-9',
      title: 'Draft',
      mode: 'markdown',
      snapshot: { id: null, title: 'Draft', mode: 'markdown', content: {} }
    }])

    expect(item.key).toBe('workspace-9')
    expect(item.summaryOnly).toBe(false)
  })

  it('keeps stable keys for remote documents across page refreshes', () => {
    const first = repository.normalizeRemoteWorkspaceDocuments([{
      id: 12,
      title: 'Remote',
      mode: 'flowchart',
      summaryOnly: true,
      content: { pages: [] }
    }], [])
    const second = repository.normalizeRemoteWorkspaceDocuments([{
      id: 12,
      title: 'Remote',
      mode: 'flowchart',
      summaryOnly: true,
      content: { pages: [] }
    }], [])

    expect(first[0].key).toBe(second[0].key)
    expect(first[0].summaryOnly).toBe(true)
  })

  it('merges drafts and server rows without duplicating ids', () => {
    const draft = { key: 'workspace-1', snapshot: { id: null } }
    const remote = { key: 'workspace-2', snapshot: { id: 7, sequenceNo: 3 } }
    const merged = repository.mergeWorkspaceDocuments([draft, remote], [
      { key: 'workspace-2', snapshot: { id: 7, sequenceNo: 4 } }
    ])

    expect(merged).toHaveLength(2)
    expect(merged[1].snapshot.sequenceNo).toBe(3)
  })
})
