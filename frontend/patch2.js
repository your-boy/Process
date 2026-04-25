const fs = require('fs');
let code = fs.readFileSync('src/components/Editor.vue', 'utf8');
code = code.replace(/const activeNodes = computed\([\s\S]*?const visibleNodes = computed/m, 'const visibleNodes = computed');
code = code.replace(/activeNodes\.value\.filter\(/, 'document.value.content.nodes.filter(');
fs.writeFileSync('src/components/Editor.vue', code);
console.log('patched2');
