import type { Token } from './types'

const TEXT_CMDS = ['\\text', '\\mathrm', '\\mathbf', '\\mathit']

export function tokenize(latex: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < latex.length) {
    const ch = latex[i]
    if (ch === ' ' || ch === '\t') { i++; continue }
    if (ch === '{') { tokens.push({ type: 'lbrace' }); i++; continue }
    if (ch === '}') { tokens.push({ type: 'rbrace' }); i++; continue }
    if (ch === '[') { tokens.push({ type: 'lbrack' }); i++; continue }
    if (ch === ']') { tokens.push({ type: 'rbrack' }); i++; continue }
    if (ch === '^') { tokens.push({ type: 'sup' }); i++; continue }
    if (ch === '_') { tokens.push({ type: 'sub' }); i++; continue }
    if (ch === '&') { tokens.push({ type: 'amp' }); i++; continue }
    if (ch === '\n') { tokens.push({ type: 'nl' }); i++; continue }
    if (ch === '\\') {
      if (i + 1 >= latex.length) break
      if (latex[i + 1] === '\\') { tokens.push({ type: 'nl' }); i += 2; continue }
      if (latex[i + 1] === '(' || latex[i + 1] === ')' || latex[i + 1] === '[' || latex[i + 1] === ']') { i += 2; continue }
      if (latex[i + 1] === ' ') {
        tokens.push({ type: 'text', value: '\u00A0' })
        i += 2
        continue
      }
      const start = i + 1
      let end = start
      if (/[a-zA-Z]/.test(latex[end])) {
        while (end < latex.length && /[a-zA-Z]/.test(latex[end])) end++
        const cmdStr = latex.slice(start - 1, end)
        tokens.push({ type: 'cmd', value: cmdStr })
        i = end
        // For \text, \mathrm, \mathbf, \mathit: extract brace content preserving spaces
        if (TEXT_CMDS.includes(cmdStr)) {
          let j = i
          while (j < latex.length && (latex[j] === ' ' || latex[j] === '\t')) j++
          if (j < latex.length && latex[j] === '{') {
            tokens.push({ type: 'lbrace' })
            j++
            let depth = 1
            const contentStart = j
            while (j < latex.length && depth > 0) {
              if (latex[j] === '{') depth++
              else if (latex[j] === '}') depth--
              if (depth > 0) j++
            }
            const content = latex.slice(contentStart, j).replace(/ /g, '\u00A0')
            tokens.push({ type: 'text', value: content })
            if (j < latex.length && latex[j] === '}') {
              tokens.push({ type: 'rbrace' })
              j++
            }
            i = j
          }
        }
        continue
      }
      end = start + 1
      tokens.push({ type: 'cmd', value: latex.slice(start - 1, end) })
      i = end
      continue
    }
    if (ch === '%') {
      while (i < latex.length && latex[i] !== '\n') i++
      continue
    }
    let end = i
    while (end < latex.length && !/[\s{}[\]^_&%\\]/.test(latex[end])) end++
    if (end > i) {
      tokens.push({ type: 'text', value: latex.slice(i, end) })
    }
    i = end
  }
  return tokens
}
