import { createDefaultLayers } from '../model/document'
import { createMindmapDocument } from './mindmap'
import { createMindNoteTextBlock } from '../render/textBlockLayer'

export function createMindNoteDocument() {
  const document = createMindmapDocument()
  document.mode = 'mind-note'
  document.title = '未命名思维笔记'
  document.content.layers = createDefaultLayers('mind-note')
  document.content.textBlocks = [
    createMindNoteTextBlock({
      nodeId: 'topic-root',
      order: 1,
      html: '<p></p>',
      text: ''
    })
  ]
  return document
}
