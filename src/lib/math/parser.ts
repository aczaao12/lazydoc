import {
  Math,
  MathRun,
  MathSubScript,
  MathSuperScript,
  MathSubSuperScript,
  MathFraction,
  MathRadical,
  MathFunction,
  MathSum,
  MathIntegral,
  MathSquareBrackets,
  MathCurlyBrackets,
  MathAngledBrackets,
  MathPreSubSuperScript,
  MathLimitUpper,
  MathLimitLower,
  MathRoundBrackets,
} from 'docx'
import type { MathComponent } from 'docx'
import type { Token } from './types'
import { GREEK, SYMBOLS, FUNCTIONS } from './types'
import { tokenize } from './tokenizer'

function parseTokens(tokens: Token[], start: number): { nodes: MathComponent[]; end: number } {
  const nodes: MathComponent[] = []
  let i = start

  while (i < tokens.length) {
    const tok = tokens[i]
    if (tok.type === 'rbrace' || tok.type === 'rbrack' || tok.type === 'amp' || tok.type === 'nl') break

    if (tok.type === 'lbrace') {
      const { nodes: inner, end: next } = parseTokens(tokens, i + 1)
      nodes.push(...inner)
      i = next
      if (i < tokens.length && tokens[i].type === 'rbrace') i++
      continue
    }

    if (tok.type === 'lbrack') {
      const { nodes: inner, end: next } = parseTokens(tokens, i + 1)
      nodes.push(new MathSquareBrackets({ children: inner }))
      i = next
      if (i < tokens.length && tokens[i].type === 'rbrack') i++
      continue
    }

    if (tok.type === 'text') {
      nodes.push(new MathRun(tok.value))
      i++
      continue
    }

    if (tok.type === 'cmd') {
      const cmd = tok.value
      const { comp, consumed } = handleCommand(cmd, tokens, i + 1)
      nodes.push(comp)
      i = consumed
      continue
    }

    if (tok.type === 'sup') {
      const { nodes: sup, end: next } = parseScriptArg(tokens, i + 1)
      if (nodes.length > 0) {
        const last = nodes.pop()!
        if (next < tokens.length && tokens[next].type === 'sub') {
          const r = parseScriptArg(tokens, next + 1)
          nodes.push(new MathSubSuperScript({ children: [last], superScript: sup, subScript: r.nodes }))
          i = r.end
        } else {
          nodes.push(new MathSuperScript({ children: [last], superScript: sup }))
          i = next
        }
      } else {
        nodes.push(...sup); i = next
      }
      continue
    }

    if (tok.type === 'sub') {
      const { nodes: sub, end: next } = parseScriptArg(tokens, i + 1)
      if (nodes.length > 0) {
        const last = nodes.pop()!
        if (next < tokens.length && tokens[next].type === 'sup') {
          const r = parseScriptArg(tokens, next + 1)
          nodes.push(new MathSubSuperScript({ children: [last], subScript: sub, superScript: r.nodes }))
          i = r.end
        } else {
          nodes.push(new MathSubScript({ children: [last], subScript: sub }))
          i = next
        }
      } else {
        nodes.push(...sub); i = next
      }
      continue
    }

    i++
  }

  return { nodes, end: i }
}

function parseScriptArg(tokens: Token[], start: number): { nodes: MathComponent[]; end: number } {
  if (start >= tokens.length) return { nodes: [], end: start }
  const t = tokens[start]
  if (t.type === 'lbrace') return parseTokens(tokens, start + 1)
  if (t.type === 'lbrack') {
    const { nodes, end } = parseTokens(tokens, start + 1)
    return { nodes: [new MathSquareBrackets({ children: nodes })], end: end + (end < tokens.length && tokens[end].type === 'rbrack' ? 1 : 0) }
  }
  if (t.type === 'cmd') {
    const { comp, consumed } = handleCommand(t.value, tokens, start + 1)
    return { nodes: [comp], end: consumed }
  }
  if (t.type === 'text') return { nodes: [new MathRun(t.value)], end: start + 1 }
  return { nodes: [], end: start + 1 }
}

function parseArg(tokens: Token[], start: number): { nodes: MathComponent[]; end: number } {
  if (start >= tokens.length) return { nodes: [], end: start }
  const t = tokens[start]
  if (t.type === 'lbrace') {
    const i = start + 1
    const { nodes: inner, end } = parseTokens(tokens, i)
    const after = end < tokens.length && tokens[end].type === 'rbrace' ? end + 1 : end
    return { nodes: inner, end: after }
  }
  if (t.type === 'text') return { nodes: [new MathRun(t.value)], end: start + 1 }
  if (t.type === 'cmd') {
    const { comp, consumed } = handleCommand(t.value, tokens, start + 1)
    return { nodes: [comp], end: consumed }
  }
  return { nodes: [], end: start + 1 }
}

function handleCommand(cmd: string, tokens: Token[], pos: number): { comp: MathComponent; consumed: number } {
  const name = cmd.replace(/^\\/, '')

  if (FUNCTIONS.has(name)) {
    const { nodes: children, end } = parseTokens(tokens, pos)
    return {
      comp: new MathFunction({ name: [new MathRun(name)], children }),
      consumed: end,
    }
  }

  if (name === 'begin') {
    let env = ''
    const envTok = tokens[pos]
    if (envTok?.type === 'lbrace' && pos + 1 < tokens.length) {
      const next = tokens[pos + 1]
      if (next.type === 'text') env = next.value
    }
    let j = pos
    let depth = 1
    while (j < tokens.length && depth > 0) {
      const t = tokens[j]
      if (t.type === 'cmd' && t.value === '\\begin') depth++
      if (t.type === 'cmd' && t.value === '\\end') depth--
      if (depth === 0) break
      j++
    }
    const contentStart = pos + (envTok?.type === 'lbrace' ? 3 : 1)
    const contentEnd = j
    const innerTokens = tokens.slice(contentStart, contentEnd).filter(t => t.type !== 'amp' && t.type !== 'nl')
    const { nodes: inner } = parseTokens(innerTokens, 0)

    if (env === 'cases') {
      return { comp: new MathCurlyBrackets({ children: [new MathRun('\u007B'), ...inner] }), consumed: j + 4 }
    }
    if (env === 'pmatrix' || env === 'matrix') {
      return { comp: new MathRoundBrackets({ children: inner }), consumed: j + 4 }
    }
    if (env === 'bmatrix') {
      return { comp: new MathSquareBrackets({ children: inner }), consumed: j + 4 }
    }
    return { comp: new MathRun(''), consumed: j + 4 }
  }

  if (name === 'end') {
    return { comp: new MathRun(''), consumed: pos + 1 }
  }

  if (name === 'frac') {
    const num = parseArg(tokens, pos)
    const den = parseArg(tokens, num.end)
    return { comp: new MathFraction({ numerator: num.nodes, denominator: den.nodes }), consumed: den.end }
  }

  if (name === 'sqrt') {
    if (pos < tokens.length && tokens[pos].type === 'lbrack') {
      const { nodes: deg, end: dEnd } = parseTokens(tokens, pos + 1)
      let next = dEnd
      if (next < tokens.length && tokens[next].type === 'rbrack') next++
      const rad = parseArg(tokens, next)
      return { comp: new MathRadical({ children: rad.nodes, degree: deg }), consumed: rad.end }
    }
    const rad = parseArg(tokens, pos)
    return { comp: new MathRadical({ children: rad.nodes }), consumed: rad.end }
  }

  if (name === 'root') {
    const deg = parseArg(tokens, pos)
    const rad = parseArg(tokens, deg.end)
    return { comp: new MathRadical({ children: rad.nodes, degree: deg.nodes }), consumed: rad.end }
  }

  if (name === 'sum' || name === 'prod' || name === 'coprod') {
    let next = pos
    let sub: MathComponent[] | undefined
    let sup: MathComponent[] | undefined
    if (next < tokens.length && tokens[next].type === 'sub') {
      const r = parseScriptArg(tokens, next + 1); sub = r.nodes; next = r.end
    }
    if (next < tokens.length && tokens[next].type === 'sup') {
      const r = parseScriptArg(tokens, next + 1); sup = r.nodes; next = r.end
    }
    const sym = name === 'sum' ? '\u2211' : name === 'prod' ? '\u220F' : '\u2210'
    return { comp: new MathSum({ children: [new MathRun(sym)], subScript: sub, superScript: sup }), consumed: next }
  }

  if (name === 'int' || name === 'iint' || name === 'iiint' || name === 'oint') {
    let next = pos
    let sub: MathComponent[] | undefined
    let sup: MathComponent[] | undefined
    if (next < tokens.length && tokens[next].type === 'sub') {
      const r = parseScriptArg(tokens, next + 1); sub = r.nodes; next = r.end
    }
    if (next < tokens.length && tokens[next].type === 'sup') {
      const r = parseScriptArg(tokens, next + 1); sup = r.nodes; next = r.end
    }
    const sym = name === 'iint' ? '\u222C' : name === 'iiint' ? '\u222D' : name === 'oint' ? '\u222E' : '\u222B'
    return { comp: new MathIntegral({ children: [new MathRun(sym)], subScript: sub, superScript: sup }), consumed: next }
  }

  if (name === 'lim') {
    let next = pos
    let sub: MathComponent[] | undefined
    let sup: MathComponent[] | undefined
    if (next < tokens.length && tokens[next].type === 'sub') {
      const r = parseScriptArg(tokens, next + 1); sub = r.nodes; next = r.end
    }
    if (next < tokens.length && tokens[next].type === 'sup') {
      const r = parseScriptArg(tokens, next + 1); sup = r.nodes; next = r.end
    }
    const limFunc = new MathFunction({ name: [new MathRun('lim')], children: [] })
    if (sub || sup) {
      return { comp: new MathPreSubSuperScript({ children: [limFunc], subScript: sub || [], superScript: sup || [] }), consumed: next }
    }
    return { comp: limFunc, consumed: next }
  }

  if (name === 'overset') {
    const above = parseArg(tokens, pos)
    const base = parseArg(tokens, above.end)
    return { comp: new MathLimitUpper({ children: base.nodes, limit: above.nodes }), consumed: base.end }
  }

  if (name === 'underset') {
    const below = parseArg(tokens, pos)
    const base = parseArg(tokens, below.end)
    return { comp: new MathLimitLower({ children: base.nodes, limit: below.nodes }), consumed: base.end }
  }

  if (name === 'xrightarrow' || name === 'xleftarrow' || name === 'xRightarrow' || name === 'xLeftarrow') {
    let sub: MathComponent[] = []
    let next = pos
    if (next < tokens.length && tokens[next].type === 'lbrack') {
      const r = parseTokens(tokens, next + 1)
      sub = r.nodes
      next = r.end
      if (next < tokens.length && tokens[next].type === 'rbrack') next++
    }
    const above = parseArg(tokens, next)
    const arrowMap: Record<string, string> = {
      xrightarrow: '\u27F6', xleftarrow: '\u27F5',
      xRightarrow: '\u27F9', xLeftarrow: '\u27F8',
    }
    const arrowChar = arrowMap[name] || '\u27F6'
    const arrowRun = new MathRun(arrowChar)
    if (sub.length > 0) {
      const withUnder = new MathLimitLower({ children: [arrowRun], limit: sub })
      return { comp: new MathLimitUpper({ children: [withUnder], limit: above.nodes }), consumed: above.end }
    }
    return { comp: new MathLimitUpper({ children: [arrowRun], limit: above.nodes }), consumed: above.end }
  }

  if (name === 'left') {
    let delim = ''
    if (pos < tokens.length) {
      const t = tokens[pos]
      if (t.type === 'text') delim = t.value
      else if (t.type === 'lbrace') delim = '{'
      else if (t.type === 'lbrack') delim = '['
      else if (t.type === 'cmd') delim = t.value.replace('\\', '')
    }
    const bracketContent: Token[] = []
    let j = pos + 1
    let depth = 1
    while (j < tokens.length && depth > 0) {
      const t = tokens[j]
      if (t.type === 'cmd') {
        const v = t.value.replace('\\', '')
        if (v === 'left' || v === 'bigl' || v === 'Bigl' || v === 'biggl' || v === 'Biggl') depth++
        if (v === 'right' || v === 'bigr' || v === 'Bigr' || v === 'biggr' || v === 'Biggr') depth--
      }
      if (depth > 0) bracketContent.push(t)
      j++
    }
    const { nodes: inner } = parseTokens(bracketContent, 0)
    if (delim === '(') return { comp: new MathRoundBrackets({ children: inner }), consumed: j + 1 }
    if (delim === '[') return { comp: new MathSquareBrackets({ children: inner }), consumed: j + 1 }
    if (delim === '{' || delim === '\\{') return { comp: new MathCurlyBrackets({ children: inner }), consumed: j + 1 }
    if (delim === '.' || delim === '|') return { comp: new MathRun(''), consumed: j + 1 }
    return { comp: new MathRun(delim), consumed: j + 1 }
  }

  if (name === 'right') {
    return { comp: new MathRun(''), consumed: pos + 1 }
  }

  if (name === 'overrightarrow') {
    const arg = parseArg(tokens, pos)
    const text = collectRunText(arg.nodes)
    const combined = text.split('').map(c => c + '\u20D7').join('')
    return { comp: new MathRun(combined), consumed: arg.end }
  }

  if (name === 'overline') {
    const arg = parseArg(tokens, pos)
    const text = collectRunText(arg.nodes)
    const combined = text.split('').map(c => c + '\u0305').join('')
    return { comp: new MathRun(combined), consumed: arg.end }
  }

  if (name === 'vec') return { comp: accentRun(tokens, pos, '\u20D7'), consumed: pos + 1 }
  if (name === 'hat') return { comp: accentRun(tokens, pos, '\u0302'), consumed: pos + 1 }
  if (name === 'bar') return { comp: accentRun(tokens, pos, '\u0304'), consumed: pos + 1 }
  if (name === 'tilde') return { comp: accentRun(tokens, pos, '\u0303'), consumed: pos + 1 }
  if (name === 'dot') return { comp: accentRun(tokens, pos, '\u0307'), consumed: pos + 1 }
  if (name === 'ddot') return { comp: accentRun(tokens, pos, '\u0308'), consumed: pos + 1 }

  if (name === 'text' || name === 'mathrm' || name === 'mathbf' || name === 'mathit') {
    const arg = parseArg(tokens, pos)
    return { comp: new MathRun(collectRunText(arg.nodes)), consumed: arg.end }
  }

  if (name === 'quad') return { comp: new MathRun('    '), consumed: pos }
  if (name === 'qquad') return { comp: new MathRun('        '), consumed: pos }
  if (name === ',' || name === 'thinspace') return { comp: new MathRun('\u2006'), consumed: pos }
  if (name === ':' || name === 'medspace') return { comp: new MathRun('\u2005'), consumed: pos }
  if (name === ';' || name === 'thickspace') return { comp: new MathRun('\u2004'), consumed: pos }
  if (name === '!' || name === 'negthinspace') return { comp: new MathRun('\u200A'), consumed: pos }
  if (name === 'space' || name === ' ') return { comp: new MathRun(' '), consumed: pos }

  if (name === 'lbrace' || name === '{') {
    const { nodes: inner, end } = parseTokens(tokens, pos)
    return { comp: new MathCurlyBrackets({ children: inner }), consumed: end }
  }

  if (name === 'lbrack' || name === '[') return { comp: new MathRun('['), consumed: pos }
  if (name === 'rbrack' || name === ']') return { comp: new MathRun(']'), consumed: pos }

  if (name === 'langle' || name === 'lang') {
    const { nodes: inner, end } = parseTokens(tokens, pos)
    return { comp: new MathAngledBrackets({ children: inner }), consumed: end }
  }
  if (name === 'rangle' || name === 'rang') return { comp: new MathRun('\u27E9'), consumed: pos }

  if (name === '%') return { comp: new MathRun('%'), consumed: pos }
  if (name === 'backslash') return { comp: new MathRun('\\'), consumed: pos }
  if (name === 'underscore') return { comp: new MathRun('_'), consumed: pos }
  if (name === 'ldots') return { comp: new MathRun('\u2026'), consumed: pos }
  if (name === 'cdots') return { comp: new MathRun('\u22EF'), consumed: pos }
  if (name === 'vdots') return { comp: new MathRun('\u22EE'), consumed: pos }
  if (name === 'ddots') return { comp: new MathRun('\u22F1'), consumed: pos }

  if (SYMBOLS[name] !== undefined) return { comp: new MathRun(SYMBOLS[name]), consumed: pos }
  if (GREEK[name] !== undefined) return { comp: new MathRun(GREEK[name]), consumed: pos }

  if (name === 'rbrace' || name === '}') return { comp: new MathRun('}'), consumed: pos }
  if (name === '|') return { comp: new MathRun('|'), consumed: pos }

  return { comp: new MathRun(cmd), consumed: pos }
}

function accentRun(tokens: Token[], start: number, accent: string): MathComponent {
  if (start < tokens.length) {
    const t = tokens[start]
    if (t.type === 'lbrace') {
      const { nodes: inner } = parseTokens(tokens, start + 1)
      const text = collectRunText(inner)
      return new MathRun(text.split('').map(c => c + accent).join(''))
    }
    if (t.type === 'text') return new MathRun(t.value.split('').map(c => c + accent).join(''))
  }
  return new MathRun('')
}

function extractTextFromComponent(n: MathComponent): string {
  const any = n as any
  if (any.rootKey === 'm:r') {
    const inner = any.root?.[0]
    if (inner?.rootKey === 'm:t') {
      return Array.isArray(inner.root) ? inner.root.join('') : ''
    }
  }
  if (Array.isArray(any.root)) {
    return any.root.map((child: any) => extractTextFromComponent(child)).join('')
  }
  return ''
}

function collectRunText(nodes: MathComponent[]): string {
  return nodes.map(n => extractTextFromComponent(n)).join('')
}

export function latexToMath(latex: string): Math {
  const cleaned = latex.trim()
  const tokens = tokenize(cleaned)
  const { nodes } = parseTokens(tokens, 0)
  return new Math({ children: nodes.length ? nodes : [new MathRun('')] })
}
