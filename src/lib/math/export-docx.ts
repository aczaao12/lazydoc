import {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  Document,
  Packer,
  LevelFormat,
  AlignmentType,
  LineRuleType,
  WidthType,
  BorderStyle,
} from 'docx'
import type { ParagraphChild } from 'docx'
import { DEF_SPACING, headingLevel, DEFAULT_FONT, DEFAULT_SIZE, DEFAULT_COLOR } from '../export'
import type { LaTeXSource } from './types'
import { latexToMath } from './parser'
import { preprocessMath } from './preprocess'

export interface ExportMathOptions {
  font?: string
  fontSize?: number
  source?: LaTeXSource
}

const INLINE_MATH_RE = /\$\$(.+?)\$\$|\\\[(.+?)\\\]|\$(.+?)\$|\\\((.+?)\\\)/gs

function useBracketLatex(source?: LaTeXSource): boolean {
  return !source || source === 'auto' || source === 'chatgpt' || source === 'deepseek'
}

function inlineRunsWithMath(text: string, font?: string, source?: LaTeXSource): ParagraphChild[] {
  const displayFont = font || DEFAULT_FONT
  const result: ParagraphChild[] = []
  const useBracket = useBracketLatex(source)
  const regex = /\*\*\*(.+?)\*\*\*|(\*\*|__)(.+?)\2|(?<!\w)_(.+?)_(?!\w)|\*(.+?)\*|`([^`]+)`|~~(.*?)~~|\[([^\]]+)\]\(([^)]+)\)|\$\$(.+?)\$\$|\\\[(.+?)\\\]|\$(.+?)\$|\\\((.+?)\\\)/gs
  let last = 0

  for (const m of text.matchAll(regex)) {
    if (m.index! > last) {
      result.push(new TextRun({ text: text.slice(last, m.index), font: displayFont, size: DEFAULT_SIZE, color: DEFAULT_COLOR }))
    }

    if (m[10] !== undefined) {
      result.push(latexToMath(preprocessMath(m[10])))
    } else if (useBracket && m[11] !== undefined) {
      result.push(latexToMath(preprocessMath(m[11])))
    } else if (m[12] !== undefined) {
      result.push(latexToMath(preprocessMath(m[12])))
    } else if (useBracket && m[13] !== undefined) {
      result.push(latexToMath(preprocessMath(m[13])))
    } else if (m[11] !== undefined || m[13] !== undefined) {
      result.push(new TextRun({ text: m[0], font: displayFont, size: DEFAULT_SIZE, color: DEFAULT_COLOR }))
    } else {
      let innerText: string
      const baseProps: Record<string, any> = { font: displayFont, size: DEFAULT_SIZE, color: DEFAULT_COLOR }

      if (m[1] !== undefined) { innerText = m[1]; baseProps.bold = true; baseProps.italics = true }
      else if (m[3] !== undefined) { innerText = m[3]; baseProps.bold = true }
      else if (m[4] !== undefined) { innerText = m[4]; baseProps.italics = true }
      else if (m[5] !== undefined) { innerText = m[5]; baseProps.italics = true }
      else if (m[6] !== undefined) { innerText = m[6]; baseProps.font = 'Courier New'; baseProps.size = 18 }
      else if (m[7] !== undefined) { innerText = m[7]; baseProps.strike = true }
      else {
        if (m[8] !== undefined && m[9] !== undefined) {
          result.push(new TextRun({ text: m[8], style: 'Hyperlink' }))
        }
        last = m.index! + m[0].length
        continue
      }

      const mathRe = useBracket ? INLINE_MATH_RE : /\$\$(.+?)\$\$|\$(.+?)\$/gs
      let innerLast = 0
      for (const im of innerText.matchAll(mathRe)) {
        if (im.index! > innerLast) {
          result.push(new TextRun({ text: innerText.slice(innerLast, im.index), ...baseProps }))
        }
        const raw = im[1] ?? im[2] ?? im[3] ?? im[4]
        if (raw) result.push(latexToMath(preprocessMath(raw)))
        innerLast = im.index! + im[0].length
      }
      if (innerLast < innerText.length) {
        result.push(new TextRun({ text: innerText.slice(innerLast), ...baseProps }))
      }
    }

    last = m.index! + m[0].length
  }

  if (last < text.length) {
    result.push(new TextRun({ text: text.slice(last), font: displayFont, size: DEFAULT_SIZE, color: DEFAULT_COLOR }))
  }

  return result.length ? result : [new TextRun({ text, font: displayFont, size: DEFAULT_SIZE, color: DEFAULT_COLOR })]
}

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

function parseMarkdownWithMath(md: string, font?: string, source?: LaTeXSource): (Paragraph | Table)[] {
  const displayFont = font || DEFAULT_FONT
  const lines = md.split('\n')
  const elements: (Paragraph | Table)[] = []

  let i = 0
  const listStack: { type: 'ordered' | 'unordered'; ref: string; indent: number }[] = []
  let listCounter = 0

  function nextListRef() {
    listCounter++
    return 'ordered-list-' + listCounter
  }

  function clearListStack() {
    listStack.length = 0
  }

  while (i < lines.length) {
    const rawLine = lines[i]
    const line = rawLine.trimEnd()

    // 1. Code Block
    if (line.trimStart().startsWith('```')) {
      clearListStack()
      const marker = line.trimStart().match(/^`{3,}/)?.[0] || '```'
      const lang = line.trimStart().slice(marker.length).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trimEnd().startsWith(marker)) {
        codeLines.push(lines[i])
        i++
      }
      if (i < lines.length) i++ // skip closing marker

      if (lang === 'quiz') {
        try {
          const quizJson = codeLines.join('\n').trim()
          const data = JSON.parse(quizJson)

          elements.push(new Paragraph({
            children: [new TextRun({ text: `Câu hỏi: ${data.question || data.stem || data.text || ''}`, bold: true, font: displayFont, size: DEFAULT_SIZE, color: DEFAULT_COLOR })],
            spacing: { before: 200, after: 120 }
          }))

          const options = data.type === 'truefalse' && (!data.options || data.options.length === 0)
            ? ['Đúng', 'Sai']
            : data.options || data.choices || data.answers || []

          options.forEach((opt: string, optIdx: number) => {
            const letter = String.fromCharCode(65 + optIdx)
            elements.push(new Paragraph({
              children: [
                new TextRun({ text: `  ${letter}. `, bold: true, font: displayFont, size: DEFAULT_SIZE, color: DEFAULT_COLOR }),
                ...inlineRunsWithMath(opt, displayFont, source)
              ],
              spacing: { after: 60 }
            }))
          })

          const answerVal = data.correct !== undefined ? data.correct : (data.answer || data.correctAnswer)
          if (answerVal !== undefined) {
            let correctLetter = ''
            if (typeof answerVal === 'number') {
              correctLetter = String.fromCharCode(65 + answerVal)
            } else {
              correctLetter = String(answerVal)
            }
            const feedbackRuns: ParagraphChild[] = [
              new TextRun({ text: `* Đáp án đúng: ${correctLetter}`, bold: true, font: displayFont, size: DEFAULT_SIZE, color: '2E7D32' })
            ]
            const explanation = data.explain || data.explanation || data.solution || data.reasoning
            if (explanation) {
              feedbackRuns.push(new TextRun({ text: `\n* Giải thích: `, bold: true, font: displayFont, size: DEFAULT_SIZE, color: '555555' }))
              feedbackRuns.push(...inlineRunsWithMath(explanation, displayFont, source))
            }
            elements.push(new Paragraph({
              children: feedbackRuns,
              spacing: { before: 100, after: 200 }
            }))
          }
        } catch {
          elements.push(
            new Table({
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: codeLines.map(c => new Paragraph({
                        children: [new TextRun({ text: c, font: 'Courier New', size: 18 })],
                        spacing: { before: 40, after: 40 }
                      })),
                      shading: { fill: 'FFF0F0' },
                      borders: {
                        top: { style: BorderStyle.SINGLE, size: 4, color: 'FFAAAA' },
                        bottom: { style: BorderStyle.SINGLE, size: 4, color: 'FFAAAA' },
                        left: { style: BorderStyle.SINGLE, size: 4, color: 'FFAAAA' },
                        right: { style: BorderStyle.SINGLE, size: 4, color: 'FFAAAA' },
                      },
                      margins: { top: 120, bottom: 120, left: 120, right: 120 }
                    })
                  ]
                })
              ],
              width: { size: 100, type: WidthType.PERCENTAGE }
            })
          )
        }
      } else {
        elements.push(
          new Table({
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: codeLines.map(c => new Paragraph({
                      children: [new TextRun({ text: c, font: 'Courier New', size: 18 })],
                      spacing: { before: 40, after: 40 }
                    })),
                    shading: { fill: 'F5F5F5' },
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
                      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
                      left: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
                      right: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
                    },
                    margins: { top: 120, bottom: 120, left: 120, right: 120 }
                  })
                ]
              })
            ],
            width: { size: 100, type: WidthType.PERCENTAGE }
          })
        )
      }
      continue
    }

    // 2. Empty Line
    if (line.trim() === '') {
      i++
      continue
    }

    // 3. Blockquote
    if (line.trimStart().startsWith('>')) {
      clearListStack()
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].trimStart().startsWith('>')) {
        const rawQuote = lines[i].trimStart()
        const m = rawQuote.match(/^>\s?(.*)$/)
        quoteLines.push(m ? m[1] : rawQuote.slice(1))
        i++
      }

      const innerElements = parseMarkdownWithMath(quoteLines.join('\n'), font, source)

      elements.push(
        new Table({
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: innerElements.length ? (innerElements as any) : [new Paragraph({ children: [new TextRun('')] })],
                  borders: {
                    left: { style: BorderStyle.SINGLE, size: 24, color: 'CCCCCC' },
                    top: { style: BorderStyle.NIL },
                    bottom: { style: BorderStyle.NIL },
                    right: { style: BorderStyle.NIL }
                  },
                  margins: { left: 240, top: 60, bottom: 60 }
                })
              ]
            })
          ],
          width: { size: 100, type: WidthType.PERCENTAGE }
        })
      )
      continue
    }

    // 4. Horizontal Rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      clearListStack()
      elements.push(new Paragraph({ thematicBreak: true, spacing: { before: 200, after: 200 } }))
      i++
      continue
    }

    // 5. Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      clearListStack()
      const level = headingMatch[1].length
      const text = headingMatch[2]
      elements.push(new Paragraph({
        children: inlineRunsWithMath(text, displayFont, source),
        heading: headingLevel(level),
        spacing: { before: 240, after: 120, line: 288, lineRule: LineRuleType.AUTO },
      }))
      i++
      continue
    }

    // 6. Lists
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)$/)
    const olMatch = line.match(/^(\s*)(\d+)[.)]\s+(.+)$/)

    if (ulMatch || olMatch) {
      const isUl = !!ulMatch
      const indentStr = isUl ? ulMatch![1] : olMatch![1]
      const text = isUl ? ulMatch![2] : olMatch![3]
      const indentVal = indentStr.length
      const type = isUl ? 'unordered' : 'ordered'

      while (listStack.length > 0 && indentVal < listStack[listStack.length - 1].indent) {
        listStack.pop()
      }

      let currentList = listStack[listStack.length - 1]
      if (!currentList || indentVal > currentList.indent) {
        const ref = isUl ? 'bullet' : nextListRef()
        currentList = { type, ref, indent: indentVal }
        listStack.push(currentList)
      } else if (currentList.indent === indentVal && currentList.type !== type) {
        listStack.pop()
        const ref = isUl ? 'bullet' : nextListRef()
        currentList = { type, ref, indent: indentVal }
        listStack.push(currentList)
      }

      const level = listStack.length - 1
      const pOpts: any = {
        children: inlineRunsWithMath(text, displayFont, source),
        spacing: { after: 120, line: 288, lineRule: LineRuleType.AUTO }
      }

      if (currentList.type === 'unordered') {
        pOpts.bullet = { level }
      } else {
        pOpts.numbering = { reference: currentList.ref, level }
      }

      elements.push(new Paragraph(pOpts))
      i++
      continue
    }

    // 7. Table
    const hasPipe = line.includes('|')
    const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : ''
    const isNextTableSep = nextLine.startsWith('|') && isTableSeparator(parseTableRow(nextLine))

    if (hasPipe && (line.trim().startsWith('|') || isNextTableSep)) {
      clearListStack()
      const tableRows: string[][] = []
      let alignments: any[] = []

      const headerCells = parseTableRow(line)
      tableRows.push(headerCells)
      i++

      if (i < lines.length) {
        const sepLine = lines[i].trim()
        if (sepLine.includes('|')) {
          const sepCells = parseTableRow(sepLine)
          if (isTableSeparator(sepCells)) {
            alignments = sepCells.map(cell => {
              const clean = cell.trim()
              const left = clean.startsWith(':')
              const right = clean.endsWith(':')
              if (left && right) return AlignmentType.CENTER
              if (right) return AlignmentType.END
              return AlignmentType.START
            })
            i++
          }
        }
      }

      while (i < lines.length) {
        const bodyLine = lines[i].trimEnd()
        if (!bodyLine.includes('|')) break
        tableRows.push(parseTableRow(bodyLine))
        i++
      }

      if (tableRows.length >= 1) {
        const columns = tableRows[0].length

        const headerRow = new TableRow({
          tableHeader: true,
          children: tableRows[0].map((c, colIdx) => {
            const align = alignments[colIdx] || AlignmentType.START
            return new TableCell({
              children: [
                new Paragraph({
                  children: inlineRunsWithMath(c, displayFont, source),
                  alignment: align,
                  spacing: { line: 288, lineRule: LineRuleType.AUTO }
                })
              ],
              width: { size: 100 / columns, type: WidthType.PERCENTAGE }
            })
          })
        })

        const rows = tableRows.slice(1).map(cells =>
          new TableRow({
            children: Array.from({ length: columns }).map((_, colIdx) => {
              const c = cells[colIdx] || ''
              const align = alignments[colIdx] || AlignmentType.START
              return new TableCell({
                children: [
                  new Paragraph({
                    children: inlineRunsWithMath(c, displayFont, source),
                    alignment: align,
                    spacing: { line: 288, lineRule: LineRuleType.AUTO }
                  })
                ]
              })
            })
          })
        )

        elements.push(
          new Table({
            rows: [headerRow, ...rows],
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            }
          })
        )
        continue
      }
    }

    // 8. Normal Paragraph
    clearListStack()
    const paraRuns: ParagraphChild[] = []
    paraRuns.push(...inlineRunsWithMath(line, displayFont, source))
    i++
    while (i < lines.length) {
      const nextLineRaw = lines[i]
      const nextLineTrim = nextLineRaw.trim()

      if (nextLineTrim === '') break
      if (/^(#{1,6}\s+|```|---|\*{3,}|_{3,}|>)/.test(nextLineTrim)) break
      if (nextLineTrim.match(/^[-*+]\s+/) || nextLineTrim.match(/^\d+[.)]\s+/)) break
      if (nextLineTrim.includes('|')) {
        const nextLineSep = i + 1 < lines.length ? lines[i + 1].trim() : ''
        if (nextLineRaw.trimStart().startsWith('|') || (nextLineSep.startsWith('|') && isTableSeparator(parseTableRow(nextLineSep)))) break
      }

      paraRuns.push(new TextRun({ text: ' ', font: displayFont, size: DEFAULT_SIZE, color: DEFAULT_COLOR }))
      paraRuns.push(...inlineRunsWithMath(nextLineRaw.trimEnd(), displayFont, source))
      i++
    }

    elements.push(new Paragraph({ children: paraRuns, spacing: DEF_SPACING }))
  }

  return elements
}

export async function exportWordWithMath(content: string, title: string, options?: ExportMathOptions): Promise<void> {
  const font = options?.font
  const source = options?.source
  const children = parseMarkdownWithMath(content, font, source)

  if (children.length === 0) {
    children.push(new Paragraph({ children: [new TextRun('')] }))
  }

  // Collect unique ordered list references used
  const usedRefs = new Set<string>()
  children.forEach(c => {
    if (c instanceof Paragraph) {
      const ref = (c as any).numbering?.reference
      if (ref && ref.startsWith('ordered-')) usedRefs.add(ref)
    }
  })

  const numberingConfig = Array.from(usedRefs).sort().map(ref => ({
    reference: ref,
    levels: Array.from({ length: 9 }, (_, i) => ({
      level: i,
      format: i % 3 === 0 ? LevelFormat.DECIMAL : i % 3 === 1 ? LevelFormat.LOWER_LETTER : LevelFormat.LOWER_ROMAN,
      text: `%${i + 1}.`,
      alignment: AlignmentType.START,
      start: 1,
      style: { paragraph: { indent: { left: 720 * (i + 1), hanging: 360 } } },
    })),
  }))

  const doc = new Document({
    title,
    numbering: { config: numberingConfig },
    sections: [{ properties: {}, children }],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.replace(/\.md$/i, '')}.docx`
  a.click()
  URL.revokeObjectURL(url)
}
