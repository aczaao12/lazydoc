import type { LaTeXSource } from './types'

function useBracketLatex(source?: LaTeXSource): boolean {
  return !source || source === 'auto' || source === 'chatgpt' || source === 'deepseek'
}

/** Build math regex: groups 1=$$, 2=\[, 3=$, 4=\( */
function buildMathRe(source?: LaTeXSource): RegExp {
  if (useBracketLatex(source)) {
    return /\$\$(.+?)\$\$|\\\[(.+?)\\\]|\$(.+?)\$|\\\((.+?)\\\)/gs
  }
  return /\$\$(.+?)\$\$|\$(.+?)\$/gs
}

function hasMath(text: string, source?: LaTeXSource): boolean {
  if (useBracketLatex(source)) {
    return /\$\$.+?\$\$|\\\[.+?\\\]|\$.+?\$|\\\(.+?\\\)/s.test(text)
  }
  return /\$\$.+?\$\$|\$.+?\$/s.test(text)
}

export function hasLatex(text: string, source?: LaTeXSource): boolean {
  return hasMath(text, source)
}

function extractBraceGroup(s: string, start: number): { content: string; end: number } {
  if (start >= s.length || s[start] !== '{') return { content: '', end: start }
  let depth = 1
  let i = start + 1
  while (i < s.length && depth > 0) {
    if (s[i] === '{') depth++
    else if (s[i] === '}') depth--
    i++
  }
  return { content: s.slice(start + 1, i - 1), end: i }
}

function extractBracketGroup(s: string, start: number): { content: string; end: number } {
  if (start >= s.length || s[start] !== '[') return { content: '', end: start }
  let depth = 1
  let i = start + 1
  while (i < s.length && depth > 0) {
    if (s[i] === '[') depth++
    else if (s[i] === ']') depth--
    i++
  }
  return { content: s.slice(start + 1, i - 1), end: i }
}

export function preprocessMath(latex: string): string {
  let result = latex
  let m: RegExpExecArray | null
  const re = /\\ce\{/g
  let parts: string[] = []
  let last = 0
  while ((m = re.exec(result)) !== null) {
    const { content, end } = extractBraceGroup(result, m.index + 3)
    if (end > m.index) {
      let out = ''
      let i = 0
      while (i < content.length) {
        const ch = content[i]
        if (ch === ' ') { i++; continue }
        if (content.startsWith('<=>', i)) { out += '\\rightleftharpoons '; i += 3; continue }
        if (content.startsWith('<->', i)) { out += '\\leftrightarrow '; i += 3; continue }
        if (content.startsWith('->', i)) {
          i += 2
          let above = '', below = ''
          const bg1 = extractBracketGroup(content, i)
          if (bg1.content) {
            above = bg1.content
            i = bg1.end
            const bg2 = extractBracketGroup(content, i)
            if (bg2.content) { below = bg2.content; i = bg2.end }
          }
          if (above) {
            if (below) out += '\\xrightarrow[' + below + ']{' + above + '}'
            else out += '\\xrightarrow{' + above + '}'
          } else {
            out += '\\rightarrow '
          }
          continue
        }
        if (content.startsWith('<-', i)) { out += '\\leftarrow '; i += 2; continue }
        if (ch === '^') {
          if (content[i + 1] === '{') {
            const g = extractBraceGroup(content, i + 1)
            out += '^{' + g.content + '}'
            i = g.end
          } else {
            const val = content[i + 1] || ''
            out += '^{' + val + '}'
            i += 2
          }
          continue
        }
        if (ch === '_') {
          if (content[i + 1] === '{') {
            const g = extractBraceGroup(content, i + 1)
            out += '_{' + g.content + '}'
            i = g.end
          } else {
            out += '_' + (content[i + 1] || '')
            i += 2
          }
          continue
        }
        if (ch === '+' && (i === 0 || !/[a-zA-Z0-9]/.test(content[i - 1]))) {
          out += '+'; i++; continue
        }
        if (ch === '(') {
          const st = content.slice(i).match(/^\((s|l|g|aq)\)/)
          if (st) { out += '\\text{' + st[0] + '}'; i += st[0].length; continue }
        }
        if (/[A-Z]/.test(ch)) {
          out += ch
          if (i + 1 < content.length && /[a-z]/.test(content[i + 1])) {
            out += content[i + 1]; i++
          }
          if (i + 1 < content.length && /[0-9]/.test(content[i + 1])) {
            out += '_' + content[i + 1]; i++
            while (i + 1 < content.length && /[0-9]/.test(content[i + 1])) {
              out += content[i + 1]; i++
            }
          }
          i++; continue
        }
        if (/[0-9]/.test(ch)) {
          const isSub = i > 0 && /[a-zA-Z)]/.test(content[i - 1])
          if (isSub) out += '_'
          out += ch; i++; continue
        }
        out += ch; i++
      }
      parts.push(result.slice(last, m.index))
      parts.push(out)
      last = end
      re.lastIndex = end
    }
  }
  if (last < result.length) parts.push(result.slice(last))
  return parts.join('')
}

export interface TextPart { type: 'text'; value: string }
export interface MathPart { type: 'math'; value: string; display: boolean }
export type Segment = TextPart | MathPart

export function extractLatexBlocks(md: string, source?: LaTeXSource): Segment[] {
  const parts: Segment[] = []
  let last = 0
  const re = buildMathRe(source)
  for (const m of md.matchAll(re)) {
    if (m.index! > last) parts.push({ type: 'text', value: md.slice(last, m.index) })
    const raw = m[1] ?? m[2] ?? m[3] ?? m[4]
    const processed = raw ? preprocessMath(raw) : raw
    const display = m[1] !== undefined || m[2] !== undefined
    if (raw !== undefined) parts.push({ type: 'math', value: processed, display })
    last = m.index! + m[0].length
  }
  if (last < md.length) parts.push({ type: 'text', value: md.slice(last) })
  return parts
}

export function preprocessMarkdownForMath(md: string): string {
  const codeOrMathRegex = /(`{3,}[\s\S]*?`{3,}|`[^`\n]*?`)|(\$\$(.+?)\$\$|\\\[(.+?)\\\]|\$(.+?)\$|\\\((.+?)\\\))/gs;
  return md.replace(codeOrMathRegex, (_match, code, _math, g1, g2, g3, g4) => {
    if (code) return _match;
    if (g1 !== undefined) return `\n\n\`\`\`math-display\n${g1.trim()}\n\`\`\`\n\n`;
    if (g2 !== undefined) return `\n\n\`\`\`math-display\n${g2.trim()}\n\`\`\`\n\n`;
    if (g3 !== undefined) {
      const inner = g3.trim();
      return inner ? `\`math-inline:${inner}\`` : _match;
    }
    if (g4 !== undefined) {
      const inner = g4.trim();
      return inner ? `\`math-inline:${inner}\`` : _match;
    }
    return _match;
  });
}
