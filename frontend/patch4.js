const fs = require("fs");
let code = fs.readFileSync("src/components/Editor.vue", "utf8");

code = code.replace(/<\/svg>/, "<rect v-if=\"selectionBox\" :x=\"Math.min(selectionBox.startX, selectionBox.currentX)\" :y=\"Math.min(selectionBox.startY, selectionBox.currentY)\" :width=\"Math.abs(selectionBox.currentX - selectionBox.startX)\" :height=\"Math.abs(selectionBox.currentY - selectionBox.startY)\" class=\"selection-rect\" fill=\"rgba(37,99,235,0.1)\" stroke=\"#2563eb\" stroke-dasharray=\"4\" pointer-events=\"none\" />\n        </svg>");

code = code.replace(/function onCanvasPanMove/g, "function onSelectionMove(event) {\n    if (!selectionBox.value) return\n    const pt = resolvePoint(event)\n    selectionBox.value.currentX = pt.x\n    selectionBox.value.currentY = pt.y\n  }\n\n  function endSelection(event) {\n    if (selectionBox.value) {\n      const minX = Math.min(selectionBox.value.startX, selectionBox.value.currentX)\n      const minY = Math.min(selectionBox.value.startY, selectionBox.value.currentY)\n      const maxX = Math.max(selectionBox.value.startX, selectionBox.value.currentX)\n      const maxY = Math.max(selectionBox.value.startY, selectionBox.value.currentY)\n      if (Math.abs(maxX - minX) > 5 && Math.abs(maxY - minY) > 5) {\n        const hits = document.value.content.nodes.filter(n => n.x >= minX && n.y >= minY && n.x + n.width <= maxX && n.y + n.height <= maxY)\n        if (hits.length > 0) props.editorState.selectNode(hits[0].id)\n      }\n    }\n    selectionBox.value = null\n    window.removeEventListener(\"pointermove\", onSelectionMove)\n    window.removeEventListener(\"pointerup\", endSelection)\n  }\n\n  function onCanvasPanMove");

fs.writeFileSync("src/components/Editor.vue", code);
console.log("patched4");
