import { ref } from 'vue'

export function createHistory() {
  const undoStack = []
  const redoStack = []
  const undoCount = ref(0)
  const redoCount = ref(0)

  function syncCounts() {
    undoCount.value = undoStack.length
    redoCount.value = redoStack.length
  }

  return {
    commit(command, options = {}) {
      if (!command || typeof command.undo !== 'function' || typeof command.redo !== 'function') {
        return
      }

      if (options.apply !== false) {
        command.redo()
      }

      undoStack.push(command)
      redoStack.length = 0
      syncCounts()
    },
    undo() {
      const command = undoStack.pop()
      if (!command) {
        return false
      }
      command.undo()
      redoStack.push(command)
      syncCounts()
      return true
    },
    redo() {
      const command = redoStack.pop()
      if (!command) {
        return false
      }
      command.redo()
      undoStack.push(command)
      syncCounts()
      return true
    },
    clear() {
      undoStack.length = 0
      redoStack.length = 0
      syncCounts()
    },
    get canUndo() {
      return undoCount.value > 0
    },
    get canRedo() {
      return redoCount.value > 0
    }
  }
}