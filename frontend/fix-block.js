const fs = require("fs");
let code = fs.readFileSync("src/components/Editor.vue", "utf8");
code = code.replace(/const modeHint = computed.*?const paletteHint = computed[^\}]+}/s, `
const modeHint = computed(() => "")
const gestureSummary = computed(() => "")
const paletteItems = computed(() => [])
const paletteTitle = computed(() => "")
const paletteHint = computed(() => "")
`);
console.log(code.indexOf("const modeHint"));
fs.writeFileSync("src/components/Editor.vue", code);
