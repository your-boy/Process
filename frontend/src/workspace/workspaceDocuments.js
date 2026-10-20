/**
 * Workspace document normalization and merge helpers.
 *
 * The workspace keeps a small page window from the server plus unsaved local
 * drafts. These helpers keep that window stable while preserving document keys
 * across refreshes.
 */
export function createWorkspaceDocumentRepository({
  normalizeDocument,
  cloneDocument,
  translate,
  allocateKey,
  keysById
}) {
  function normalizeWorkspaceDocuments(documents = []) {
    if (!Array.isArray(documents)) {
      return []
    }

    return documents.flatMap((item, index) => {
      if (!item?.snapshot || typeof item.snapshot !== 'object') {
        return []
      }

      const snapshot = normalizeDocument(cloneDocument(item.snapshot))
      const key = typeof item.key === 'string' && item.key.trim()
        ? item.key.trim()
        : `workspace-restored-${index + 1}`

      return [{
        key,
        title: String(item.title || snapshot.title || translate('workspace.untitled')).trim()
          || translate('workspace.untitled'),
        mode: String(item.mode || snapshot.mode || 'flowchart').trim() || 'flowchart',
        summaryOnly: item.summaryOnly === true,
        snapshot
      }]
    })
  }

  function normalizeRemoteWorkspaceDocuments(documents = [], localDocuments = []) {
    if (!Array.isArray(documents)) {
      return []
    }

    return documents.flatMap(item => {
      const snapshot = normalizeDocument(cloneDocument(item))
      if (!snapshot?.mode || !snapshot?.title) {
        return []
      }

      const documentId = String(snapshot.id || '')
      const existing = localDocuments.find(localItem => String(localItem.snapshot?.id || '') === documentId)
      const key = existing?.key || keysById.get(documentId) || allocateKey()
      if (documentId) {
        keysById.set(documentId, key)
      }
      return [{
        key,
        title: snapshot.title,
        mode: snapshot.mode,
        summaryOnly: item.summaryOnly === true,
        snapshot
      }]
    })
  }

  function mergeWorkspaceDocuments(localDocuments = [], remoteDocuments = []) {
    const merged = [...localDocuments]
    const byId = new Map(merged
      .map(item => [String(item.snapshot?.id || ''), item])
      .filter(([id]) => Boolean(id)))

    remoteDocuments.forEach(item => {
      const snapshotId = String(item.snapshot?.id || '')
      if (!snapshotId) {
        return
      }
      const existing = byId.get(snapshotId)
      if (existing) {
        const sequenceNo = Number(item.snapshot?.sequenceNo)
        if ((!existing.snapshot.sequenceNo || existing.snapshot.sequenceNo <= 0) && sequenceNo > 0) {
          existing.snapshot.sequenceNo = Math.round(sequenceNo)
        }
        return
      }
      merged.push(item)
      byId.set(snapshotId, item)
    })

    return merged
  }

  function resolveActiveDocumentKey(documents, activeKey) {
    if (!documents.length) {
      return null
    }

    return documents.some(item => item.key === activeKey)
      ? activeKey
      : documents[0].key
  }

  function getWorkspaceCounter(documents = []) {
    return documents.reduce((maxValue, item) => {
      const match = /^workspace-(\d+)$/.exec(String(item?.key || ''))
      if (!match) {
        return maxValue
      }
      return Math.max(maxValue, Number(match[1]))
    }, 0)
  }

  function modeLabel(mode) {
    return {
      flowchart: translate('workspace.flowchart'),
      mindmap: translate('workspace.mindmap'),
      markdown: translate('workspace.markdown'),
      'mind-note': translate('workspace.mindNote')
    }[mode] || translate('workspace.doc')
  }

  return {
    normalizeWorkspaceDocuments,
    normalizeRemoteWorkspaceDocuments,
    mergeWorkspaceDocuments,
    resolveActiveDocumentKey,
    getWorkspaceCounter,
    modeLabel
  }
}
