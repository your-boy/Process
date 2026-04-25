const fs = require("fs");
let code = fs.readFileSync("src/components/Editor.vue", "utf8");
let firstIndex = code.indexOf("function onSelectionMove");
let lastIndex = code.lastIndexOf("function onSelectionMove");
if (firstIndex !== lastIndex) {
  // slice out the second one assuming it goes till onCanvasPanMove
  let substr = code.slice(lastIndex);
  let nextFunc = substr.indexOf("function onCanvasPanMove");
  if (nextFunc > -1) {
    code = code.slice(0, lastIndex) + substr.slice(nextFunc);
  }
}
fs.writeFileSync("src/components/Editor.vue", code);
