const fs = require("fs");
let code = fs.readFileSync("src/components/Editor.vue", "utf8");
code = code.replace(/<label class="markdown-label" for="markdown-source">.*/, `<label class="markdown-label" for="markdown-source">Markdown Source</label>`);
code = code.replace(/<option value="markdown">.*/, `<option value="markdown">Markdown</option>`);
fs.writeFileSync("src/components/Editor.vue", code);
