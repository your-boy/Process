const fs = require('fs');
let bak = fs.readFileSync('src/components/Editor.vue.bak', 'utf8');
let cur = fs.readFileSync('src/components/Editor.vue', 'utf8');

const startRegex = /const modeHint = computed\([\s\S]*?const paletteHint = computed\(\(\) => \{\n *return [^\}]+\n\}\)/;
let bakMatch = bak.match(startRegex);

if (bakMatch) {
  let brokenRegex = /const modeHint = computed\(\(\) => ""\)\s*const gestureSummary = computed\(\(\) => ""\)\s*const paletteItems = computed\(\(\) => \[\]\)\s*const paletteTitle = computed\(\(\) => ""\)\s*const paletteHint = computed\(\(\) => ""\)/;
  cur = cur.replace(brokenRegex, bakMatch[0]);
  fs.writeFileSync('src/components/Editor.vue', cur);
  console.log('Restored');
} else {
  console.log('Not found in bak');
}
