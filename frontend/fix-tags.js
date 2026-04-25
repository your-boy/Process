const fs = require("fs");
let code = fs.readFileSync("src/components/Editor.vue", "utf8");
code = code.replace(/<option value="flowchart">.*/, `<option value="flowchart">流程图</option>`);
code = code.replace(/<option value="mindmap">.*/, `<option value="mindmap">思维导图</option>`);
code = code.replace(/<option value="mind-note">.*/, `<option value="mind-note">思维笔记</option>`);
code = code.replace(/{{ Math.round\(document\.content\.viewport\.zoom \* 100\) }}%<\/span>/, `{{ Math.round(document.content.viewport.zoom * 100) }}%</span>`);
code = code.replace(/<div class="note-chip">.*/g, `<div class="note-chip">Info</div>`);
code = code.replace(/<span v-if="isTreeMode">.*/, `<span v-if="isTreeMode">折叠性能 p95：{{ editorState.performanceSummary.value.p95.toFixed(2) }}ms</span>`);
code = code.replace(/<button v-if="document\.mode === .mind-note." type="button" @click="editorState\.formatMindNoteTextBlock\([^)]+\)">[^<]+/g, (match) => {
  return match + "</button>".replace(/<\/button><\/button>/, "</button>");
});
code = code.replace(/<\/button><\/button>/g, "</button>");
fs.writeFileSync("src/components/Editor.vue", code);
