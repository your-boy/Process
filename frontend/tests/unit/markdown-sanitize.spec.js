import { describe, expect, it } from 'vitest'
import { renderMarkdownToHtml } from '../../src/editor/modes/markdown'

describe('markdown rendering', () => {
  it('removes executable HTML and unsafe URLs', () => {
    const html = renderMarkdownToHtml([
      '<img src="x" onerror="alert(1)">',
      '<script>alert(1)</script>',
      '[bad](javascript:alert(1))'
    ].join('\n\n'))

    expect(html).not.toContain('onerror')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('javascript:')
  })

  it('keeps normal markdown structure', () => {
    const html = renderMarkdownToHtml('# Title\n\n- one\n- two')
    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<li>one</li>')
  })

  it('renders task list state without unsafe input elements', () => {
    const html = renderMarkdownToHtml('- [x] done\n- [ ] todo')
    expect(html).toContain('data-type="taskList"')
    expect(html).toContain('data-type="taskItem"')
    expect(html).toContain('data-checked="true"')
    expect(html).toContain('data-checked="false"')
    expect(html).not.toContain('<input')
  })
})
