import { describe, expect, it } from 'vitest'
import {
  collectHtmlBlocks,
  exportHtmlElementAsImage,
  resolveImageExportOptions,
  sanitizeFileName
} from '../../src/editor/exporters/imageExporter'
import { buildOpmlText, buildOutlineText } from '../../src/editor/exporters/outlineExporter'

const document = {
  title: 'Plan',
  content: {
    nodes: [
      { id: 'root', text: '中心' },
      { id: 'a', parentId: 'root', text: 'A', labels: ['x'] },
      { id: 'b', parentId: 'a', text: 'B' },
      { id: 'f', text: '浮动', floating: true }
    ]
  }
}

describe('outline exporters', () => {
  it('builds an indented markdown outline', () => {
    const text = buildOutlineText(document)
    expect(text).toContain('# Plan')
    expect(text).toContain('- 中心')
    expect(text).toContain('  - A  #x')
    expect(text).toContain('    - B')
    expect(text).toContain('- 浮动')
  })

  it('builds opml with nested outlines', () => {
    const xml = buildOpmlText(document)
    expect(xml.startsWith('<?xml')).toBe(true)
    expect(xml).toContain('text="A"')
    expect(xml).toContain('<outline text="B"></outline>')
  })

  it('keeps mind-note text blocks in markdown and opml exports', () => {
    const noteDocument = {
      ...document,
      content: {
        ...document.content,
        textBlocks: [
          { id: 'note-1', nodeId: 'root', order: 0, text: '根主题备注' },
          { id: 'note-2', nodeId: 'a', order: 0, text: '分支备注\n第二行' },
          { id: 'note-3', nodeId: 'root', parentId: 'note-1', order: 0, text: '子块备注' }
        ]
      }
    }

    const markdown = buildOutlineText(noteDocument)
    expect(markdown).toContain('- 📝 根主题备注')
    expect(markdown).toContain('    - 📝 子块备注')
    expect(markdown).toContain('  - 📝 分支备注')
    expect(markdown).toContain('  - 📝 第二行')

    const opml = buildOpmlText(noteDocument)
    expect(opml).toContain('_note="根主题备注&#10;&#10;  子块备注"')
    expect(opml).toContain('_note="分支备注&#10;第二行"')
  })

  it('keeps the exported image aspect ratio', () => {
    expect(resolveImageExportOptions({ widthCm: 10, heightCm: 6 })).toMatchObject({
      width: 1182,
      height: 709,
      mimeType: 'image/png'
    })
  })

  it('supports explicit high-resolution PDF raster dimensions', () => {
    expect(resolveImageExportOptions({
      width: 4096,
      height: 2458,
      dpi: 328,
      format: 'png'
    })).toMatchObject({
      width: 4096,
      height: 2458,
      pixelDensity: 328,
      mimeType: 'image/png'
    })
  })

  it('sanitizes illegal download file names', () => {
    expect(sanitizeFileName('a/b:c*?"<>|.png')).toBe('a_b_c______.png')
    expect(sanitizeFileName('name. ')).toBe('name')
    expect(sanitizeFileName('   ')).toBe('diagram')
  })
})

describe('html image export', () => {
  it('collects markdown preview blocks for canvas rendering', () => {
    const root = window.document.createElement('div')
    root.innerHTML = [
      '<h1>标题</h1>',
      '<p>正文 <strong>加粗</strong></p>',
      '<ul><li>一</li><li>二<ul><li>子</li></ul></li></ul>',
      '<ul data-type="taskList">',
      '<li data-type="taskItem"><label><input type="checkbox" checked><span>已完成</span></label></li>',
      '<li data-type="taskItem"><label><input type="checkbox"><span>未完成</span></label></li>',
      '</ul>',
      '<p><img src="https://example.com/architecture.png" alt="架构图"></p>',
      '<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>',
      '<pre>code</pre>'
    ].join('')

    const blocks = collectHtmlBlocks(root)
    expect(blocks.map(block => block.tag)).toEqual([
      'h1', 'p', 'li', 'li', 'li', 'li', 'li', 'image', 'table-row', 'table-row', 'pre'
    ])
    expect(blocks[0].text).toBe('标题')
    expect(blocks[1].text).toContain('正文')
    expect(blocks[1].runs?.some(run => run.style.bold && run.text.includes('加粗'))).toBe(true)
    const done = blocks.find(block => block.text === '已完成')
    const todo = blocks.find(block => block.text === '未完成')
    expect(done?.checked).toBe(true)
    expect(todo?.checked).toBe(false)
    const image = blocks.find(block => block.tag === 'image')
    expect(image?.alt).toBe('架构图')
    expect(image?.src).toContain('architecture.png')
    expect(blocks[8].text).toContain('A')
    expect(typeof exportHtmlElementAsImage).toBe('function')
  })
})
