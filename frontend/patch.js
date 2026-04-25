const fs = require('fs');
let code = fs.readFileSync('src/components/Editor.vue', 'utf8');
code = code.replace(/<svg[\s\S]*?<\/svg>/, '<div ref=\'graphContainerRef\' class=\'diagram-canvas x6-canvas\' data-testid=\'canvas-surface\' tabindex=\'-1\' @dragover.prevent @drop.prevent=\'handleCanvasDrop\'></div>');
fs.writeFileSync('src/components/Editor.vue', code);
console.log('patched');
