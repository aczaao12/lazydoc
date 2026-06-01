import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  LevelFormat,
  AlignmentType,
  LineRuleType,
} from 'docx'

const DEFAULT_FONT = 'Times New Roman'
const DEFAULT_SIZE = 26
const DEFAULT_COLOR = '000000'
const DEF_SPACING = { before: 120, after: 120, line: 288, lineRule: LineRuleType.AUTO }

function inlineRuns(text: string): TextRun[] {
  const runs: TextRun[] = []
  const regex = /(\*\*|__)(.*?)\1|(\*|_)(.*?)\3|`([^`]+)`|~~(.*?)~~|\[([^\]]+)\]\(([^)]+)\)/g
  let last = 0

  for (const m of text.matchAll(regex)) {
    if (m.index! > last) {
      runs.push(new TextRun({ text: text.slice(last, m.index), font: DEFAULT_FONT, size: DEFAULT_SIZE, color: DEFAULT_COLOR }))
    }
    if (m[2] !== undefined) {
      runs.push(new TextRun({ text: m[2], bold: true, font: DEFAULT_FONT, size: DEFAULT_SIZE, color: DEFAULT_COLOR }))
    } else if (m[4] !== undefined) {
      runs.push(new TextRun({ text: m[4], italics: true, font: DEFAULT_FONT, size: DEFAULT_SIZE, color: DEFAULT_COLOR }))
    } else if (m[5] !== undefined) {
      runs.push(new TextRun({ text: m[5], font: 'Courier New', size: 18 }))
    } else if (m[6] !== undefined) {
      runs.push(new TextRun({ text: m[6], strike: true, font: DEFAULT_FONT, size: DEFAULT_SIZE, color: DEFAULT_COLOR }))
    } else if (m[7] !== undefined && m[8] !== undefined) {
      runs.push(new TextRun({ text: m[7], style: 'Hyperlink' }))
    }
    last = m.index! + m[0].length
  }
  if (last < text.length) {
    runs.push(new TextRun({ text: text.slice(last), font: DEFAULT_FONT, size: DEFAULT_SIZE, color: DEFAULT_COLOR }))
  }
  return runs.length ? runs : [new TextRun({ text, font: DEFAULT_FONT, size: DEFAULT_SIZE, color: DEFAULT_COLOR })]
}

function headingLevel(level: number) {
  const map: Record<number, string> = {
    1: 'Heading1',
    2: 'Heading2',
    3: 'Heading3',
    4: 'Heading4',
    5: 'Heading5',
    6: 'Heading6',
  }
  return map[level] as any
}

function parseTableRow(line: string): string[] {
  return line
    .split('|')
    .slice(1, -1)
    .map(c => c.trim())
}

function isTableSeparator(cells: string[]): boolean {
  return cells.every(c => /^:?-+:?$/.test(c))
}

function parseMarkdown(md: string): (Paragraph | Table)[] {
  const lines = md.split('\n')
  const elements: (Paragraph | Table)[] = []
  let inCode = false
  let codeLines: string[] = []
  let tableRows: string[][] = []
  let inTable = false
  let inParagraph: string[] = []

  function flushParagraph() {
    if (!inParagraph.length) return
    const text = inParagraph.join(' ')
    elements.push(new Paragraph({ children: inlineRuns(text), spacing: DEF_SPACING }))
    inParagraph = []
  }

  function flushCode() {
    if (!codeLines.length) return
    elements.push(
      new Paragraph({
        children: [new TextRun({ text: codeLines.join('\n'), font: 'Courier New', size: 18 })],
        spacing: { before: 200, after: 200 },
        indent: { left: 400 },
      }),
    )
    codeLines = []
  }

  function flushTable() {
    if (tableRows.length < 2) return
    const headerCells = tableRows[0]
    const bodyRows = tableRows.slice(1)
    const columns = headerCells.length

    const headerRow = new TableRow({
      tableHeader: true,
      children: headerCells.map(
        c =>
          new TableCell({
            children: [new Paragraph({ children: inlineRuns(c), spacing: { line: 288, lineRule: LineRuleType.AUTO } })],
            width: { size: 100 / columns, type: WidthType.PERCENTAGE },
          }),
      ),
    })

    const rows = bodyRows.map(
      cells =>
        new TableRow({
          children: cells.map(
            c =>
              new TableCell({
                children: [new Paragraph({ children: inlineRuns(c), spacing: { line: 288, lineRule: LineRuleType.AUTO } })],
              }),
          ),
        }),
    )

    elements.push(
      new Table({
        rows: [headerRow, ...rows],
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
          insideVertical: { style: BorderStyle.SINGLE, size: 1 },
          top: { style: BorderStyle.SINGLE, size: 1 },
          bottom: { style: BorderStyle.SINGLE, size: 1 },
          left: { style: BorderStyle.SINGLE, size: 1 },
          right: { style: BorderStyle.SINGLE, size: 1 },
        },
      }),
    )
    tableRows = []
    inTable = false
  }

  for (const raw of lines) {
    const line = raw.trimEnd()

    if (inCode) {
      if (line.startsWith('```')) {
        inCode = false
        flushCode()
        continue
      }
      codeLines.push(line)
      continue
    }

    if (line.startsWith('```')) {
      flushParagraph()
      flushTable()
      inCode = true
      codeLines = []
      continue
    }

    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = parseTableRow(line)
      if (!isTableSeparator(cells)) {
        flushParagraph()
        if (!inTable) {
          inTable = true
          tableRows = []
        }
        tableRows.push(cells)
        continue
      }
      continue
    }

    if (inTable) {
      flushTable()
    }

    if (line === '') {
      flushParagraph()
      continue
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      flushParagraph()
      const level = headingMatch[1].length
      const text = headingMatch[2]
      elements.push(
        new Paragraph({
          children: inlineRuns(text),
          heading: headingLevel(level),
          spacing: { before: 240, after: 120, line: 288, lineRule: LineRuleType.AUTO },
        }),
      )
      continue
    }

    const hrMatch = line.match(/^(-{3,}|\*{3,}|_{3,})$/)
    if (hrMatch) {
      flushParagraph()
      elements.push(
        new Paragraph({
          thematicBreak: true,
          spacing: { before: 200, after: 200 },
        }),
      )
      continue
    }

    const blockquoteMatch = line.match(/^>\s?(.*)$/)
    if (blockquoteMatch) {
      flushParagraph()
      const text = blockquoteMatch[1]
      elements.push(
        new Paragraph({
          children: inlineRuns(text),
          indent: { left: 400 },
          spacing: DEF_SPACING,
        }),
      )
      continue
    }

    const ulMatch = line.match(/^[-*+]\s+(.+)$/)
    if (ulMatch) {
      flushParagraph()
      const text = ulMatch[1]
      elements.push(
        new Paragraph({
          children: inlineRuns(text),
          bullet: { level: 0 },
          spacing: { after: 120, line: 288, lineRule: LineRuleType.AUTO },
        }),
      )
      continue
    }

    const olMatch = line.match(/^\d+[.)]\s+(.+)$/)
    if (olMatch) {
      flushParagraph()
      const text = olMatch[1]
      elements.push(
        new Paragraph({
          children: inlineRuns(text),
          numbering: { reference: 'ordered', level: 0 },
          spacing: { after: 120, line: 288, lineRule: LineRuleType.AUTO },
        }),
      )
      continue
    }

    inParagraph.push(line)
  }

  flushParagraph()
  flushCode()
  flushTable()

  return elements
}

export async function exportWord(content: string, title: string): Promise<void> {
  const children = parseMarkdown(content)

  if (children.length === 0) {
    children.push(new Paragraph({ children: [new TextRun('')] }))
  }

  const doc = new Document({
    title,
    numbering: {
      config: [
        {
          reference: 'ordered',
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.START,
              start: 1,
              style: {
                paragraph: {
                  indent: { left: 720, hanging: 360 },
                },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {},
        children,
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.replace(/\.md$/i, '')}.docx`
  a.click()
  URL.revokeObjectURL(url)
}

export function exportPdf(): void {
  window.print()
}
