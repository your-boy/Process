function cloneLayers(document) {
  return document.content.layers.map(layer => ({ ...layer }))
}

function replaceLayers(document, nextLayers) {
  document.content.layers = nextLayers.map((layer, index) => ({
    ...layer,
    order: index
  }))
}

function createLayerToggleCommand(document, layerId, key) {
  const before = cloneLayers(document)
  const nextLayers = cloneLayers(document).map(layer => {
    if (layer.id !== layerId) {
      return layer
    }
    return {
      ...layer,
      [key]: !layer[key]
    }
  })

  return {
    redo() {
      replaceLayers(document, nextLayers)
    },
    undo() {
      replaceLayers(document, before)
    }
  }
}

export function createToggleLayerVisibilityCommand(document, layerId) {
  return createLayerToggleCommand(document, layerId, 'visible')
}

export function createToggleLayerLockCommand(document, layerId) {
  return createLayerToggleCommand(document, layerId, 'locked')
}

export function createReorderLayerCommand(document, layerId, direction) {
  const before = cloneLayers(document)
  const nextLayers = cloneLayers(document)
  const currentIndex = nextLayers.findIndex(layer => layer.id === layerId)
  const targetIndex = currentIndex + direction

  if (currentIndex === -1 || targetIndex < 0 || targetIndex >= nextLayers.length) {
    return {
      redo() {},
      undo() {}
    }
  }

  const [layer] = nextLayers.splice(currentIndex, 1)
  nextLayers.splice(targetIndex, 0, layer)

  return {
    redo() {
      replaceLayers(document, nextLayers)
    },
    undo() {
      replaceLayers(document, before)
    }
  }
}