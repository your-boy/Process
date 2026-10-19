import { describe, expect, it } from 'vitest'
import {
  buildCodeFenceInfo,
  CODE_BLOCK_DEFAULTS,
  parseCodeFenceInfo
} from '../../src/editor/render/markdownCodeBlock'
import { convertHtmlToMarkdown, renderMarkdownToHtml } from '../../src/editor/modes/markdown'

describe('markdown code block properties', () => {
  it('parses and builds fenced-code metadata', () => {
    const attributes = parseCodeFenceInfo(
      'javascript bg=#112233 fg=#f8fafc border=#445566 bw=2 radius=8 pad=20 wrap=1'
    )
    expect(attributes).toEqual({
      language: 'javascript',
      backgroundColor: '#112233',
      textColor: '#f8fafc',
      borderColor: '#445566',
      borderWidth: 2,
      borderRadius: 8,
      padding: 20,
      wrap: true
    })
    expect(buildCodeFenceInfo(attributes)).toBe(
      'javascript bg=#112233 fg=#f8fafc border=#445566 bw=2 radius=8 pad=20 wrap=1'
    )
  })

  it('renders custom code block attributes and round-trips them through Markdown', () => {
    const source = [
      '```javascript bg=#112233 fg=#f8fafc border=#445566 bw=2 radius=8 pad=20 wrap=1',
      'const answer = 42',
      '```'
    ].join('\n')
    const html = renderMarkdownToHtml(source)
    expect(html).toContain('data-md-bg="#112233"')
    expect(html).toContain('data-md-fg="#f8fafc"')
    expect(html).toContain('data-md-border="#445566"')
    expect(html).toContain('data-md-bw="2"')
    expect(html).toContain('data-md-radius="8"')
    expect(html).toContain('data-md-pad="20"')
    expect(html).toContain('data-md-wrap="true"')
    expect(html).toContain('class="language-javascript"')
    expect(html).toContain('background:#112233')

    const roundTrip = convertHtmlToMarkdown(html)
    expect(roundTrip).toContain('```javascript')
    expect(roundTrip).toContain('bg=#112233')
    expect(roundTrip).toContain('fg=#f8fafc')
    expect(roundTrip).toContain('border=#445566')
    expect(roundTrip).toContain('bw=2')
    expect(roundTrip).toContain('radius=8')
    expect(roundTrip).toContain('pad=20')
    expect(roundTrip).toContain('wrap=1')
    expect(roundTrip).toContain('const answer = 42')
  })

  it('keeps plain fenced code blocks clean and preserves custom languages', () => {
    expect(buildCodeFenceInfo(CODE_BLOCK_DEFAULTS)).toBe('')
    expect(parseCodeFenceInfo('')).toEqual(CODE_BLOCK_DEFAULTS)
    expect(parseCodeFenceInfo('js')).toMatchObject({ language: 'js' })
    expect(parseCodeFenceInfo('c++')).toMatchObject({ language: 'c++' })
  })
})
