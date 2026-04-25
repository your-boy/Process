const fs = require("fs");
let code = fs.readFileSync("src/components/Editor.vue", "utf8");
code = code.replace(/return '.*/g, "return '");
code = code.replace(/label: '.*/g, "label: '},");
code = code.replace(/text: '.*/g, "text: '");
code = code.replace(/description: '.*/g, "description: '}");
fs.writeFileSync("src/components/Editor.vue", code);
