import { createDefaultLayers } from '../model/document'
import { createMindmapDocument } from './mindmap'

export function createMindNoteDocument() {
  const document = createMindmapDocument()
  document.mode = 'mind-note'
  document.title = '未命名思维笔记'
  document.content.layers = createDefaultLayers('mind-note')
  document.content.textBlocks = []
  return document
}