import katex from 'katex'
import type { LaTeXSource } from './types'

function useBracketLatex(source?: LaTeXSource): boolean {
  return !source || source === 'auto' || source === 'chatgpt' || source === 'deepseek'
}

const INLINE_MATH_RE = /\$\$(.+?)\$\$|\\\[(.+?)\\\]|\$(.+?)\$|\\\((.+?)\\\)/gs

function mdInlineToHtml(text: string): string {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/(\*\*|__)(.+?)\1/g, '<strong>$2</strong>')
    .replace(/(?<!\w)\*(.+?)\*(?!\*)/g, '<em>$1</em>')
    .replace(/(?<!\w)_(.+?)_(?!\w)/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/~~(.*?)~~/g, '<s>$1</s>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
}

type HtmlBlock =
  | { type: 'code'; lines: string[]; lang: string }
  | { type: 'table'; rows: string[][]; aligns: string[] }
  | { type: 'list'; ordered: boolean; items: { text: string; indent: number }[] }
  | { type: 'quote'; lines: string[] }
  | { type: 'heading'; level: number; text: string }
  | { type: 'hr' }
  | { type: 'para'; text: string }
  | { type: 'quiz'; json: string }

function parseTableRow(line: string): string[] {
  const trimmed = line.trim()
  const parts = trimmed.split('|')
  const startsWithPipe = trimmed.startsWith('|')
  const endsWithPipe = trimmed.endsWith('|')

  if (startsWithPipe && endsWithPipe) {
    return parts.slice(1, -1).map(c => c.trim())
  }
  if (startsWithPipe) {
    return parts.slice(1).map(c => c.trim())
  }
  if (endsWithPipe) {
    return parts.slice(0, -1).map(c => c.trim())
  }
  return parts.map(c => c.trim())
}

function isTableSeparator(cells: string[]): boolean {
  return cells.every(c => /^:?-+:?$/.test(c))
}

function parseQuizJson(jsonStr: string): { question: string; options: string[]; answer?: string; explanation?: string } | null {
  try {
    const cleaned = jsonStr.trim()
    const obj = typeof JSON.parse(cleaned) === 'object' ? JSON.parse(cleaned) : null
    if (!obj) return null
    return {
      question: obj.question || obj.stem || obj.text || '',
      options: obj.options || obj.choices || obj.answers || [],
      answer: obj.answer || obj.correct || obj.correctAnswer || undefined,
      explanation: obj.explanation || obj.solution || obj.reasoning || undefined,
    }
  } catch {
    return null
  }
}

function parseBlocks(md: string): HtmlBlock[] {
  const lines = md.split('\n')
  const blocks: HtmlBlock[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Code fence / quiz
    if (/^```/.test(line.trimStart())) {
      const lang = line.trimStart().slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !/^```/.test(lines[i].trimStart())) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing ```
      if (lang === 'quiz') {
        blocks.push({ type: 'quiz', json: codeLines.join('\n') })
      } else {
        blocks.push({ type: 'code', lines: codeLines, lang })
      }
      continue
    }

    // Separator line = empty
    if (line.trim() === '') { i++; continue }

    // Heading
    const hd = line.match(/^(#{1,6})\s+(.+)$/)
    if (hd) {
      blocks.push({ type: 'heading', level: hd[1].length, text: hd[2] })
      i++
      continue
    }

    // Thematic break
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      blocks.push({ type: 'hr' })
      i++
      continue
    }

    // Table rows (collect until non-table)
    const hasPipeChar = line.includes('|')
    const nextLineStr = i + 1 < lines.length ? lines[i + 1].trim() : ''
    const isNextSep = nextLineStr.startsWith('|') && isTableSeparator(parseTableRow(nextLineStr))

    if (hasPipeChar && (line.trim().startsWith('|') || isNextSep)) {
      const trimmed = line.trim()
      const cells = parseTableRow(trimmed)
      if (cells.length > 0 && !isTableSeparator(cells)) {
        const startI = i
        const rows: string[][] = [cells]
        let aligns: string[] = []
        i++

        if (i < lines.length) {
          const next = lines[i].trim()
          if (next.includes('|')) {
            const nc = parseTableRow(next)
            if (isTableSeparator(nc)) {
              aligns = nc.map(c => {
                const t = c.trim()
                if (t.startsWith(':') && t.endsWith(':')) return 'center'
                if (t.endsWith(':')) return 'end'
                return 'start'
              })
              i++
            }
          }
        }

        while (i < lines.length) {
          const next = lines[i].trimEnd()
          if (!next.includes('|')) break
          const nc = parseTableRow(next)
          rows.push(nc)
          i++
        }

        if (rows.length >= 1) {
          blocks.push({ type: 'table', rows, aligns })
          continue
        }
        i = startI
      }
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const qLines: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        qLines.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      blocks.push({ type: 'quote', lines: qLines })
      continue
    }

    // List items with indentation
    const ulStart = line.match(/^(\s*)[-*+]\s+(.+)$/)
    const olStart = line.match(/^(\s*)\d+[.)]\s+(.+)$/)
    if (ulStart || olStart) {
      const isOrdered = !!olStart
      const m = ulStart || olStart!
      const indent = (m[1].length / 2) | 0
      const items: { text: string; indent: number }[] = [{ text: m[2], indent }]
      i++
      while (i < lines.length) {
        const n = lines[i]
        const nu = n.match(/^(\s*)[-*+]\s+(.+)$/)
        const no = n.match(/^(\s*)\d+[.)]\s+(.+)$/)
        if (nu) {
          const ni = (nu[1].length / 2) | 0
          items.push({ text: nu[2], indent: ni })
          i++
          continue
        }
        if (no) {
          const ni = (no[1].length / 2) | 0
          items.push({ text: no[2], indent: ni })
          i++
          continue
        }
        break
      }
      blocks.push({ type: 'list', ordered: isOrdered, items })
      continue
    }

    // Paragraph
    const paraLines: string[] = [line]
    i++
    while (i < lines.length) {
      const n = lines[i].trimEnd()
      if (n === '' || /^(#{1,6}\s+|```|---|\*{3,}|_{3,}|>)/.test(n)) break
      if (/^\s*[-*+]\s+/.test(n)) break
      if (/^\s*\d+[.)]\s+/.test(n)) break
      paraLines.push(n)
      i++
    }
    blocks.push({ type: 'para', text: paraLines.join(' ') })
  }

  return blocks
}

function renderInline(text: string, enableLatex = true, source?: LaTeXSource): string {
  if (!enableLatex) return mdInlineToHtml(text)
  const useBracket = useBracketLatex(source)
  const regex = /\*\*\*(.+?)\*\*\*|(\*\*|__)(.+?)\2|(?<!\w)_(.+?)_(?!\w)|\*(.+?)\*|`([^`]+)`|~~(.*?)~~|\[([^\]]+)\]\(([^)]+)\)|\$\$(.+?)\$\$|\\\[(.+?)\\\]|\$(.+?)\$|\\\((.+?)\\\)/gs
  let html = ''
  let last = 0
  for (const m of text.matchAll(regex)) {
    if (m.index! > last) html += mdInlineToHtml(text.slice(last, m.index))
    if (m[10] !== undefined) {
      try { html += katex.renderToString(m[10], { output: 'mathml', throwOnError: false, displayMode: true }) }
      catch { html += '$$' + m[10] + '$$' }
    } else if (useBracket && m[11] !== undefined) {
      try { html += katex.renderToString(m[11], { output: 'mathml', throwOnError: false, displayMode: true }) }
      catch { html += '\\[' + m[11] + '\\]' }
    } else if (m[12] !== undefined) {
      try { html += katex.renderToString(m[12], { output: 'mathml', throwOnError: false }) }
      catch { html += '$' + m[12] + '$' }
    } else if (useBracket && m[13] !== undefined) {
      try { html += katex.renderToString(m[13], { output: 'mathml', throwOnError: false }) }
      catch { html += '\\(' + m[13] + '\\)' }
    } else if (m[11] !== undefined || m[13] !== undefined) {
      html += escapeHtml(m[0])
    } else if (m[1] !== undefined) {
      html += renderMathInText(m[1], 'strong><em', source)
    } else if (m[3] !== undefined) {
      html += renderMathInText(m[3], 'strong', source)
    } else if (m[4] !== undefined) {
      html += renderMathInText(m[4], 'em', source)
    } else if (m[5] !== undefined) {
      html += renderMathInText(m[5], 'em', source)
    } else if (m[6] !== undefined) {
      html += '<code>' + escapeHtml(m[6]) + '</code>'
    } else if (m[7] !== undefined) {
      html += renderMathInText(m[7], 's', source)
    } else if (m[8] !== undefined && m[9] !== undefined) {
      html += '<a href="' + escapeHtml(m[9]) + '">' + renderMathInText(m[8], undefined, source) + '</a>'
    }
    last = m.index! + m[0].length
  }
  if (last < text.length) html += mdInlineToHtml(text.slice(last))
  return html
}

function renderMathInText(text: string, wrapperTag?: string, source?: LaTeXSource): string {
  if (!wrapperTag) return mdInlineToHtml(text)
  const useBracket = useBracketLatex(source)
  const tags = wrapperTag.split('><')
  const openTag = '<' + tags.join('><') + '>'
  const closeTag = '</' + [...tags].reverse().join('></') + '>'
  const mathRe = useBracket ? INLINE_MATH_RE : /\$\$(.+?)\$\$|\$(.+?)\$/gs
  let result = ''
  let last = 0
  for (const m of text.matchAll(mathRe)) {
    if (m.index! > last) {
      const seg = mdInlineToHtml(text.slice(last, m.index))
      result += openTag + seg + closeTag
    }
    const raw = m[1] ?? m[2] ?? m[3] ?? m[4]
    const display = m[1] !== undefined || m[2] !== undefined
    try {
      const mathHtml = katex.renderToString(raw, { output: 'mathml', throwOnError: false, displayMode: display })
      result += openTag + mathHtml + closeTag
    } catch {
      const delim = display ? '$$' : '$'
      result += openTag + delim + raw + delim + closeTag
    }
    last = m.index! + m[0].length
  }
  if (last < text.length) {
    const seg = mdInlineToHtml(text.slice(last))
    result += openTag + seg + closeTag
  }
  return result
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function copyToWordHtml(content: string, font?: string, enableLatex = true, source?: LaTeXSource): string {
  const displayFont = font || 'Times New Roman'
  const blocks = parseBlocks(content)
  const parts: string[] = []

  for (const b of blocks) {
    switch (b.type) {
      case 'heading': {
        const fontSize = [28, 24, 20, 18, 16, 14][b.level - 1]
        parts.push(`<h${b.level} style="font-size:${fontSize}pt;font-weight:bold;margin:10px 0 6px 0;font-family:${displayFont},serif">${renderInline(b.text, enableLatex, source)}</h${b.level}>`)
        break
      }
      case 'para':
        parts.push(`<p style="margin:6px 0;font-family:${displayFont},serif;font-size:12pt;line-height:1.5">${renderInline(b.text, enableLatex, source)}</p>`)
        break
      case 'hr':
        parts.push('<hr style="border:none;border-top:1px solid #000;margin:8px 0">')
        break
      case 'quote': {
        const inner = b.lines.map(l => `<p style="margin:2px 0">${renderInline(l, enableLatex, source)}</p>`).join('')
        parts.push(`<table style="margin:6px 0;width:100%"><tr><td style="border-left:3px solid #ccc;padding:4px 0 4px 12px;color:#555">${inner}</td></tr></table>`)
        break
      }
      case 'list': {
        function renderNestedList(items: { text: string; indent: number }[], ordered: boolean, startIndent: number): string {
          const tag = ordered ? 'ol' : 'ul'
          const collected: string[] = []
          let idx = 0
          while (idx < items.length) {
            if (items[idx].indent !== startIndent) { idx++; continue }
            const children: { text: string; indent: number }[] = []
            idx++
            while (idx < items.length && items[idx].indent > startIndent) {
              if (items[idx].indent === startIndent + 1) children.push(items[idx])
              idx++
            }
            const childHtml = children.length > 0
              ? renderNestedList(children, !ordered, startIndent + 1)
              : ''
            collected.push(`<li>${renderInline(items[idx - 1].text, enableLatex, source)}${childHtml}</li>`)
          }
          return `<${tag} style="margin:3px 0;padding-left:${24 + startIndent * 20}px">${collected.join('')}</${tag}>`
        }
        parts.push(renderNestedList(b.items, b.ordered, 0))
        break
      }
      case 'code': {
        const code = b.lines.map(l => escapeHtml(l)).join('\n')
        parts.push(`<table style="margin:6px 0;width:100%"><tr><td style="background:#f5f5f5;border:1px solid #ccc;padding:8px;font-family:Consolas,monospace;font-size:10pt;white-space:pre-wrap">${code}</td></tr></table>`)
        break
      }
      case 'quiz': {
        const quiz = parseQuizJson(b.json)
        if (quiz) {
          const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F']
          let html = `<table style="margin:8px 0;width:100%;border-collapse:collapse"><tr><td style="background:#f1f8e9;border-left:4px solid #4CAF50;border:1px solid #c8e6c9;padding:12px">`
          html += `<p style="margin:0 0 8px 0;font-weight:bold">${renderInline(quiz.question, enableLatex, source)}</p>`
          quiz.options.forEach((opt, idx) => {
            html += `<p style="margin:2px 0;padding-left:12px">${optionLabels[idx] || String(idx + 1)}. ${renderInline(opt, enableLatex, source)}</p>`
          })
          if (quiz.answer) {
            html += `<p style="margin:8px 0 0 0;color:#2e7d32;font-weight:bold">Đáp án: ${renderInline(quiz.answer, enableLatex, source)}</p>`
          }
          if (quiz.explanation) {
            html += `<p style="margin:4px 0 0 0;color:#555;font-style:italic">Giải thích: ${renderInline(quiz.explanation, enableLatex, source)}</p>`
          }
          html += `</td></tr></table>`
          parts.push(html)
        } else {
          const code = escapeHtml(b.json)
          parts.push(`<table style="margin:6px 0;width:100%"><tr><td style="background:#f5f5f5;border:1px solid #ccc;padding:8px;font-family:Consolas,monospace;font-size:10pt;white-space:pre-wrap">${code}</td></tr></table>`)
        }
        break
      }
      case 'table': {
        const cols = b.rows[0].length
        const aligns = b.aligns || []
        function textAlign(a: string): string {
          if (a === 'center') return 'text-align:center'
          if (a === 'end') return 'text-align:right'
          return 'text-align:left'
        }
        const headerCells = b.rows[0].map((c, ci) => `<th style="border:1px solid #000;padding:4px;font-family:${displayFont},serif;font-size:11pt;font-weight:bold;background:#f0f0f0;${textAlign(aligns[ci] || 'start')}" width="${(100 / cols)}%">${renderInline(c, enableLatex, source)}</th>`).join('')
        const bodyRows = b.rows.slice(1).map(r =>
          `<tr>${r.map((c, ci) => `<td style="border:1px solid #000;padding:4px;font-family:${displayFont},serif;font-size:11pt;${textAlign(aligns[ci] || 'start')}">${renderInline(c, enableLatex, source)}</td>`).join('')}</tr>`
        ).join('')
        parts.push(`<table style="border-collapse:collapse;width:100%;margin:6px 0"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`)
        break
      }
    }
  }

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<meta name="ProgId" content="Word.Document">
<!--[if gte mso 9]>
<xml>
<w:WordDocument>
<w:View>Print</w:View>
</w:WordDocument>
</xml>
<![endif]-->
<style>
body { font-family: '${displayFont}', serif; font-size: 12pt; line-height: 1.5; margin: 0; }
math { font-family: 'Cambria Math', serif; }
</style>
</head>
<body>
${parts.join('\n')}
</body>
</html>`
}
