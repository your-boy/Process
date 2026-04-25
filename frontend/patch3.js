const fs = require('fs');
let code = fs.readFileSync('src/components/Editor.vue', 'utf8');

code = code.replace(/@pointerdown="startCanvasPan"/, '@pointerdown="startCanvasInteraction"');
code = code.replace(/<\/svg>/, \<rect v-if="selectionBox" :x="Math.min(selectionBox.startX, selectionBox.currentX)" :y="Math.min(selectionBox.startY, selectionBox.currentY)" :width="Math.abs(selectionBox.currentX - selectionBox.startX)" :height="Math.abs(selectionBox.currentY - selectionBox.startY)" class="selection-rect" fill="rgba(37,99,235,0.1)" stroke="#2563eb" stroke-dasharray="4" pointer-events="none" />\n<\/svg>\);

const logic = \  const selectionBox = ref(null)

  function startCanvasInteraction(event) {
    if (event.button === 0 && !spacePressed.value) {
      const pt = resolvePoint(event)
      selectionBox.value = { startX: pt.x, startY: pt.y, currentX: pt.x, currentY: pt.y }
      window.addEventListener('pointermove', onSelectionMove)
      window.addEventListener('pointerup', endSelection)
    } else {
      startCanvasPan(event)
    }
  }

  function onSelectionMove(event) {
    if (!selectionBox.value) return
    const pt = resolvePoint(event)
    selectionBox.value.currentX = pt.x
    selectionBox.value.currentY = pt.y
  }

  function endSelection() {
    if (selectionBox.value) {
      const minX = Math.min(selectionBox.value.startX, selectionBox.value.currentX)
      const minY = Math.min(selectionBox.value.startY, selectionBox.value.currentY)
      const maxX = Math.max(selectionBox.value.startX, selectionBox.value.currentX)
      const maxY = Math.max(selectionBox.value.startY, selectionBox.value.currentY)
      if (Math.abs(maxX - minX) > 5 || Math.abs(maxY - minY) > 5) {
        const hits = document.value.content.nodes.filter(n => n.x >= minX && n.y >= minY && n.x + n.width <= maxX && n.y + n.height <= maxY)
        // multi-select missing in state? Just select first for now or trigger native group
        if (hits.length > 0) props.editorState.selectNode(hits[0].id)
      }
    }
    selectionBox.value = null
    window.removeEventListener('pointermove', onSelectionMove)
    window.removeEventListener('pointerup', endSelection)
  }

  function startCanvasPan(event) {\;

code = code.replace(/  function startCanvasPan\(event\) \{/, logic);

fs.writeFileSync('src/components/Editor.vue', code);
console.log('patched3');
