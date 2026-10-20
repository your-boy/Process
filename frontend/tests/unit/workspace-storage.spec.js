import { beforeEach, describe, expect, it, vi } from 'vitest'

const indexedDb = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn()
}))

vi.mock('idb-keyval', () => ({
  get: indexedDb.get,
  set: indexedDb.set,
  del: indexedDb.del
}))

import {
  WORKSPACE_DRAFT_FALLBACK_PREFIX,
  WORKSPACE_META_KEY_PREFIX,
  persistWorkspaceCache,
  readWorkspaceCache
} from '../../src/editor/services/workspaceStorage'

const payload = {
  activeDocumentKey: 'workspace-1',
  documentCounter: 1,
  openDocuments: [{ key: 'workspace-1', snapshot: { id: null, title: 'Draft' } }]
}

describe('workspace storage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('writes lightweight metadata to localStorage and full payload to IndexedDB', async () => {
    indexedDb.set.mockResolvedValue(undefined)
    await persistWorkspaceCache('user-1', payload)

    const meta = JSON.parse(localStorage.getItem(`${WORKSPACE_META_KEY_PREFIX}user-1`))
    expect(meta.documentCount).toBe(1)
    expect(localStorage.getItem(`${WORKSPACE_META_KEY_PREFIX}user-1`).length).toBeLessThan(4096)
    expect(indexedDb.set).toHaveBeenCalledWith(
      'diagram-editor:workspace-cache:user-1',
      expect.objectContaining({ activeDocumentKey: 'workspace-1' })
    )
  })

  it('falls back to localStorage when IndexedDB is unavailable', async () => {
    indexedDb.set.mockRejectedValue(new Error('blocked'))
    await persistWorkspaceCache('user-1', payload)

    const fallback = JSON.parse(localStorage.getItem(`${WORKSPACE_DRAFT_FALLBACK_PREFIX}user-1`))
    expect(fallback.openDocuments).toHaveLength(1)
    expect(fallback.fallback).toBe(true)
  })

  it('reads the fallback snapshot when IndexedDB returns nothing', async () => {
    localStorage.setItem(`${WORKSPACE_DRAFT_FALLBACK_PREFIX}user-1`, JSON.stringify(payload))
    indexedDb.get.mockResolvedValue(undefined)

    await expect(readWorkspaceCache('user-1')).resolves.toMatchObject({
      activeDocumentKey: 'workspace-1'
    })
  })
})
