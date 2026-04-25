
const fs = require("fs");
let code = fs.readFileSync("src/components/Editor.vue", "utf8");

const newStartPan = `const selectionBox = ref(null)
  function startCanvasPan(event) {
    if (event.button === 0 && !spacePressed.value) {
      const pt = resolvePoint(event)
      selectionBox.value = { startX: pt.x, startY: pt.y, currentX: pt.x, currentY: pt.y }
      window.addEventListener("pointermove", onSelectionMove)
      window.addEventListener("pointerup", endSelection)
      return
    }

    const canPanWithLeftButton = event.button === 0 && spacePressed.value`;

code = code.replace(/function startCanvasPan\(event\) {\s*const canPanWithLeftButton = event\.button === 0 && spacePressed\.value/, newStartPan);
fs.writeFileSync("src/components/Editor.vue", code);
console.log("patched5");

