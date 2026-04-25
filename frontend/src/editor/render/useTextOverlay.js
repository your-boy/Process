import { computed, ref } from 'vue'

export function useTextOverlay(getNodeById) {
  const editingNodeId = ref(null)
  const draftText = ref('')

  const editingNode = computed(() => getNodeById(editingNodeId.value))

  function start(nodeId) {
    const node = getNodeById(nodeId)
    if (!node) {
      return
    }
    editingNodeId.value = nodeId
    draftText.value = node.text || ''
  }

  function cancel() {
    editingNodeId.value = null
    draftText.value = ''
  }

  function submit(callback) {
    if (!editingNodeId.value) {
      return
    }
    callback(editingNodeId.value, draftText.value)
    cancel()
  }

  return {
    editingNodeId,
    draftText,
    editingNode,
    start,
    cancel,
    submit
  }
}