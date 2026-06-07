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
import type { MathComponent, ParagraphChild } from 'docx'
import { inlineRuns, DEF_SPACING, headingLevel, DEFAULT_FONT, DEFAULT_SIZE, DEFAULT_COLOR } from './export'
import katex from 'katex'

type Token =
  | { type: 'text'; value: string }
  | { type: 'cmd'; value: string }
  | { type: 'lbrace' }
  | { type: 'rbrace' }
  | { type: 'lbrack' }
  | { type: 'rbrack' }
  | { type: 'sup' }
  | { type: 'sub' }
  | { type: 'amp' }
  | { type: 'nl' }

const GREEK: Record<string, string> = {
  alpha: '\u03B1', beta: '\u03B2', gamma: '\u03B3', delta: '\u03B4',
  epsilon: '\u03B5', zeta: '\u03B6', eta: '\u03B7', theta: '\u03B8',
  iota: '\u03B9', kappa: '\u03BA', lambda: '\u03BB', mu: '\u03BC',
  nu: '\u03BD', xi: '\u03BE', omicron: '\u03BF', pi: '\u03C0',
  rho: '\u03C1', sigma: '\u03C3', tau: '\u03C4', upsilon: '\u03C5',
  phi: '\u03C6', chi: '\u03C7', psi: '\u03C8', omega: '\u03C9',
  vartheta: '\u03D1', varphi: '\u03C6', varsigma: '\u03C2',
  varepsilon: '\u03F5', varkappa: '\u03F0',
  Gamma: '\u0393', Delta: '\u0394', Theta: '\u0398', Lambda: '\u039B',
  Xi: '\u039E', Pi: '\u03A0', Sigma: '\u03A3', Phi: '\u03A6',
  Psi: '\u03A8', Omega: '\u03A9',
}

const SYMBOLS: Record<string, string> = {
  infty: '\u221E', partial: '\u2202', nabla: '\u2207',
  exists: '\u2203', forall: '\u2200', emptyset: '\u2205',
  dagger: '\u2020', ddagger: '\u2021',
  approx: '\u2248', equiv: '\u2261', propto: '\u221D',
  sim: '\u223C', cong: '\u2245', simeq: '\u2243',
  neq: '\u2260', ne: '\u2260', leq: '\u2264', geq: '\u2265',
  le: '\u2264', ge: '\u2265', ll: '\u226A', gg: '\u226B',
  subset: '\u2282', supset: '\u2283', subseteq: '\u2286', supseteq: '\u2287',
  in: '\u2208', notin: '\u2209', ni: '\u220B',
  perp: '\u22A5', parallel: '\u2225', therefore: '\u2234',
  wedge: '\u2227', vee: '\u2228', cap: '\u2229', cup: '\u222A',
  times: '\u00D7', pm: '\u00B1', mp: '\u2213', div: '\u00F7',
  cdot: '\u00B7', ast: '\u2217', circ: '\u2218', bullet: '\u2219',
  oplus: '\u2295', ominus: '\u2296', otimes: '\u2297', odot: '\u2299',
  to: '\u2192', gets: '\u2190',
  leftarrow: '\u2190', rightarrow: '\u2192',
  Leftarrow: '\u21D0', Rightarrow: '\u21D2',
  leftrightarrow: '\u2194', Rightleftarrow: '\u21D4',
  mapsto: '\u21A6', implies: '\u27F9', iff: '\u27F7',
  cdp: '\u22EF', ldp: '\u2026', vdp: '\u22EE', ddp: '\u22F1',
  angle: '\u2220', measuredangle: '\u2221', triangle: '\u25B3',
  aleph: '\u2135', hbar: '\u210F', ell: '\u2113',
  Re: '\u211C', Im: '\u2111',
  prime: '\u2032', backprime: '\u2035',
  imath: '\u0131', jmath: '\u0237',
  lnot: '\u00AC', land: '\u2227', lor: '\u2228',
  lvert: '|', rvert: '|', lVert: '\u2016', rVert: '\u2016',
  void: '', colon: ':', textdegree: '\u00B0',
  slashed: '\u00F8', smallsetminus: '\u2216',
  rightleftharpoons: '\u21CC', leftrightharpoons: '\u21CB',
  uparrow: '\u2191', downarrow: '\u2193', updownarrow: '\u2195',
  Uparrow: '\u21D1', Downarrow: '\u21D3', Updownarrow: '\u21D5',
  longleftrightarrow: '\u27F7', Longleftrightarrow: '\u27FA',
  longleftarrow: '\u27F5', longrightarrow: '\u27F6' ,
  Longleftarrow: '\u27F8', Longrightarrow: '\u27F9',
  because: '\u2235',
  degree: '\u00B0',
  AA: '\u00C5', angstrom: '\u00C5',
}

const FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
  'sinh', 'cosh', 'tanh', 'coth',
  'arcsin', 'arccos', 'arctan',
  'log', 'ln', 'lg', 'exp',
  'det', 'dim', 'hom', 'ker', 'tr',
  'max', 'min', 'sup', 'inf', 'lim', 'limsup', 'liminf',
  'arg', 'deg', 'gcd', 'lcm', 'mod', 'pmod', 'bmod',
  'Pr',
])

function tokenize(latex: string): Token[] {
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
      if (latex[i + 1] === ' ') { i += 2; continue }
      const start = i + 1
      let end = start
      if (/[a-zA-Z]/.test(latex[end])) {
        while (end < latex.length && /[a-zA-Z]/.test(latex[end])) end++
        tokens.push({ type: 'cmd', value: latex.slice(start - 1, end) })
        i = end
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

function collectRunText(nodes: MathComponent[]): string {
  return nodes.map(n => {
    if (n instanceof MathRun) return n.toString()
    return ''
  }).join('')
}

export function latexToMath(latex: string): Math {
  const cleaned = latex.trim()
  const tokens = tokenize(cleaned)
  const { nodes } = parseTokens(tokens, 0)
  return new Math({ children: nodes.length ? nodes : [new MathRun('')] })
}

export function hasLatex(text: string): boolean {
  return /\$\$.+?\$\$|\$.+?\$/s.test(text)
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

function preprocessMath(latex: string): string {
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

interface TextPart { type: 'text'; value: string }
interface MathPart { type: 'math'; value: string; display: boolean }
type Segment = TextPart | MathPart

export function extractLatexBlocks(md: string): Segment[] {
  const parts: Segment[] = []
  let last = 0
  const re = /\$\$(.+?)\$\$|\$(.+?)\$/gs
  for (const m of md.matchAll(re)) {
    if (m.index! > last) parts.push({ type: 'text', value: md.slice(last, m.index) })
    const raw = m[1] !== undefined ? m[1] : m[2]
    const processed = raw ? preprocessMath(raw) : raw
    if (m[1] !== undefined) parts.push({ type: 'math', value: processed, display: true })
    else if (m[2] !== undefined) parts.push({ type: 'math', value: processed, display: false })
    last = m.index! + m[0].length
  }
  if (last < md.length) parts.push({ type: 'text', value: md.slice(last) })
  return parts
}

function inlineRunsWithMath(text: string, font?: string): ParagraphChild[] {
  const displayFont = font || DEFAULT_FONT
  const result: ParagraphChild[] = []
  const regex = /\*\*\*(.+?)\*\*\*|(\*\*|__)(.+?)\2|(?<!\w)_(.+?)_(?!\w)|\*(.+?)\*|`([^`]+)`|~~(.*?)~~|\[([^\]]+)\]\(([^)]+)\)|\$\$(.+?)\$\$|\$(.+?)\$/gs
  let last = 0

  for (const m of text.matchAll(regex)) {
    if (m.index! > last) {
      result.push(new TextRun({ text: text.slice(last, m.index), font: displayFont, size: DEFAULT_SIZE, color: DEFAULT_COLOR }))
    }

    if (m[10] !== undefined) {
      // Display math $$...$$
      result.push(latexToMath(m[10] ? preprocessMath(m[10]) : ''))
    } else if (m[11] !== undefined) {
      // Inline math $...$
      result.push(latexToMath(m[11] ? preprocessMath(m[11]) : ''))
    } else {
      // Inline formatting match — may contain $...$ inside
      let innerText: string
      const baseProps: Record<string, any> = { font: displayFont, size: DEFAULT_SIZE, color: DEFAULT_COLOR }

      if (m[1] !== undefined) { innerText = m[1]; baseProps.bold = true; baseProps.italics = true }
      else if (m[3] !== undefined) { innerText = m[3]; baseProps.bold = true }
      else if (m[4] !== undefined) { innerText = m[4]; baseProps.italics = true }
      else if (m[5] !== undefined) { innerText = m[5]; baseProps.italics = true }
      else if (m[6] !== undefined) { innerText = m[6]; baseProps.font = 'Courier New'; baseProps.size = 18 }
      else if (m[7] !== undefined) { innerText = m[7]; baseProps.strike = true }
      else {
        // link
        if (m[8] !== undefined && m[9] !== undefined) {
          result.push(new TextRun({ text: m[8], style: 'Hyperlink' }))
        }
        last = m.index! + m[0].length
        continue
      }

      // Process inner text for $...$ math
      const mathRe = /\$\$(.+?)\$\$|\$(.+?)\$/gs
      let innerLast = 0
      for (const im of innerText.matchAll(mathRe)) {
        if (im.index! > innerLast) {
          result.push(new TextRun({ text: innerText.slice(innerLast, im.index), ...baseProps }))
        }
        const raw = im[1] !== undefined ? im[1] : im[2]
        result.push(latexToMath(raw ? preprocessMath(raw) : ''))
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
  return line
    .split('|')
    .slice(1, -1)
    .map(c => c.trim())
}

function isTableSeparator(cells: string[]): boolean {
  return cells.every(c => /^:?-+:?$/.test(c))
}

function parseMarkdownWithMath(md: string, font?: string): (Paragraph | Table)[] {
  const displayFont = font || DEFAULT_FONT
  const lines = md.split('\n')
  const elements: (Paragraph | Table)[] = []
  let inCode = false
  let inParagraph: ParagraphChild[] = []
  let tableRows: string[][] = []
  let inTable = false
  let listCount = 0

  function flushParagraph() {
    if (!inParagraph.length) return
    elements.push(new Paragraph({ children: inParagraph, spacing: DEF_SPACING }))
    inParagraph = []
  }

  function flushTable() {
    if (tableRows.length < 2) return
    const headerCells = tableRows[0]
    const bodyRows = tableRows.slice(1)
    const columns = headerCells.length

    const headerRow = new TableRow({
      tableHeader: true,
      children: headerCells.map(c => {
        const children = inlineRunsWithMath(c, displayFont)
        return new TableCell({
          children: [new Paragraph({ children, spacing: { line: 288, lineRule: LineRuleType.AUTO } })],
          width: { size: 100 / columns, type: WidthType.PERCENTAGE },
        })
      }),
    })

    const rows = bodyRows.map(cells =>
      new TableRow({
        children: cells.map(c => {
          const children = inlineRunsWithMath(c, displayFont)
          return new TableCell({
            children: [new Paragraph({ children, spacing: { line: 288, lineRule: LineRuleType.AUTO } })],
          })
        }),
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
      if (line.startsWith('```')) { inCode = false; continue }
      inParagraph.push(new TextRun({ text: line + '\n', font: 'Courier New', size: 18 }))
      continue
    }
    if (line.startsWith('```')) { flushParagraph(); flushTable(); inCode = true; continue }

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

    if (line === '') { flushParagraph(); continue }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      flushParagraph()
      const level = headingMatch[1].length
      const text = headingMatch[2]
      const children = inlineRunsWithMath(text, displayFont)
      elements.push(new Paragraph({
        children,
        heading: headingLevel(level),
        spacing: { before: 240, after: 120, line: 288, lineRule: LineRuleType.AUTO },
      }))
      continue
    }

    const hrMatch = line.match(/^(-{3,}|\*{3,}|_{3,})$/)
    if (hrMatch) {
      flushParagraph()
      elements.push(new Paragraph({ thematicBreak: true, spacing: { before: 200, after: 200 } }))
      continue
    }

    const blockquoteMatch = line.match(/^>\s?(.*)$/)
    if (blockquoteMatch) {
      flushParagraph()
      const text = blockquoteMatch[1]
      const children = inlineRunsWithMath(text, displayFont)
      elements.push(new Paragraph({ children, indent: { left: 400 }, spacing: DEF_SPACING }))
      continue
    }

    const ulMatch = line.match(/^[-*+]\s+(.+)$/)
    if (ulMatch) {
      flushParagraph()
      const text = ulMatch[1]
      const children = inlineRunsWithMath(text, displayFont)
      elements.push(new Paragraph({ children, bullet: { level: 0 }, spacing: { after: 120, line: 288, lineRule: LineRuleType.AUTO } }))
      continue
    }

    const olMatch = line.match(/^\d+[.)]\s+(.+)$/)
    if (olMatch) {
      flushParagraph()
      listCount++
      const ref = 'ordered-' + listCount
      const text = olMatch[1]
      const children = inlineRunsWithMath(text, displayFont)
      elements.push(new Paragraph({
        children,
        numbering: { reference: ref, level: 0 },
        spacing: { after: 120, line: 288, lineRule: LineRuleType.AUTO },
      }))
      continue
    }

    inParagraph.push(...inlineRunsWithMath(line, displayFont))
  }

  flushParagraph()
  flushTable()
  return elements
}

export interface ExportMathOptions {
  font?: string
  fontSize?: number
}

export async function exportWordWithMath(content: string, title: string, options?: ExportMathOptions): Promise<void> {
  const font = options?.font
  const children = parseMarkdownWithMath(content, font)

  if (children.length === 0) {
    children.push(new Paragraph({ children: [new TextRun('')] }))
  }

  // Build numbering config for each ordered list found
  const listCount = children.filter(c => c instanceof Paragraph && (c as any).numbering?.reference?.startsWith('ordered-')).length
  const numberingConfig = Array.from({ length: listCount }, (_, i) => ({
    reference: 'ordered-' + (i + 1),
    levels: [{
      level: 0,
      format: LevelFormat.DECIMAL,
      text: '%1.',
      alignment: AlignmentType.START,
      start: 1,
      style: { paragraph: { indent: { left: 720, hanging: 360 } } },
    }],
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
  | { type: 'table'; rows: string[][] }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'quote'; lines: string[] }
  | { type: 'heading'; level: number; text: string }
  | { type: 'hr' }
  | { type: 'para'; text: string }

function parseBlocks(md: string): HtmlBlock[] {
  const lines = md.split('\n')
  const blocks: HtmlBlock[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Code fence
    if (/^```/.test(line.trimStart())) {
      const lang = line.trimStart().slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !/^```/.test(lines[i].trimStart())) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing ```
      blocks.push({ type: 'code', lines: codeLines, lang })
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
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = parseTableRow(line)
      if (!isTableSeparator(cells)) {
        const startI = i
        const rows: string[][] = [cells]
        i++
        while (i < lines.length) {
          const next = lines[i].trimEnd()
          if (next.startsWith('|') && next.endsWith('|')) {
            const nc = parseTableRow(next)
            if (!isTableSeparator(nc)) { rows.push(nc); i++; continue }
          }
          break
        }
        if (rows.length >= 2) {
          blocks.push({ type: 'table', rows })
          continue
        }
        // Not enough rows → reset and treat as paragraph
        i = startI
      }
    }

    // Blockquote (collect consecutive > lines)
    if (/^>\s?/.test(line)) {
      const qLines: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        qLines.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      blocks.push({ type: 'quote', lines: qLines })
      continue
    }

    // List items (collect consecutive same type)
    const ulStart = line.match(/^[-*+]\s+(.+)$/)
    const olStart = line.match(/^\d+[.)]\s+(.+)$/)
    if (ulStart) {
      const items: string[] = [ulStart[1]]
      i++
      while (i < lines.length) {
        const m = lines[i].match(/^[-*+]\s+(.+)$/)
        if (m) { items.push(m[1]); i++; continue }
        break
      }
      blocks.push({ type: 'list', ordered: false, items })
      continue
    }
    if (olStart) {
      const items: string[] = [olStart[1]]
      i++
      while (i < lines.length) {
        const m = lines[i].match(/^\d+[.)]\s+(.+)$/)
        if (m) { items.push(m[1]); i++; continue }
        break
      }
      blocks.push({ type: 'list', ordered: true, items })
      continue
    }

    // Paragraph (collect consecutive non-empty, non-special lines)
    const paraLines: string[] = [line]
    i++
    while (i < lines.length) {
      const n = lines[i].trimEnd()
      if (n === '' || /^(#{1,6}\s+|```|---|\*{3,}|_{3,}|>)/.test(n)) break
      const m = n.match(/^[-*+]\s+/)
      if (m) break
      if (/^\d+[.)]\s+/.test(n)) break
      paraLines.push(n)
      i++
    }
    blocks.push({ type: 'para', text: paraLines.join(' ') })
  }

  return blocks
}

function renderInline(text: string, enableLatex = true): string {
  if (!enableLatex) return mdInlineToHtml(text)
  // Combined regex: match both inline formatting and math in one pass
  // Group order: 1=***inner, 2=**|__ delim, 3=**|__ inner, 4=_inner, 5=*inner,
  // 6=`code`, 7=~~strike~~, 8=link text, 9=link url, 10=$$math$$, 11=$math$
  const regex = /\*\*\*(.+?)\*\*\*|(\*\*|__)(.+?)\2|(?<!\w)_(.+?)_(?!\w)|\*(.+?)\*|`([^`]+)`|~~(.*?)~~|\[([^\]]+)\]\(([^)]+)\)|\$\$(.+?)\$\$|\$(.+?)\$/gs
  let html = ''
  let last = 0
  for (const m of text.matchAll(regex)) {
    if (m.index! > last) html += mdInlineToHtml(text.slice(last, m.index))
    if (m[10] !== undefined) {
      try { html += katex.renderToString(m[10], { output: 'mathml', throwOnError: false, displayMode: true }) }
      catch { html += '$$' + m[10] + '$$' }
    } else if (m[11] !== undefined) {
      try { html += katex.renderToString(m[11], { output: 'mathml', throwOnError: false }) }
      catch { html += '$' + m[11] + '$' }
    } else if (m[1] !== undefined) {
      html += renderMathInText(m[1], 'strong><em')
    } else if (m[3] !== undefined) {
      html += renderMathInText(m[3], 'strong')
    } else if (m[4] !== undefined) {
      html += renderMathInText(m[4], 'em')
    } else if (m[5] !== undefined) {
      html += renderMathInText(m[5], 'em')
    } else if (m[6] !== undefined) {
      html += '<code>' + escapeHtml(m[6]) + '</code>'
    } else if (m[7] !== undefined) {
      html += renderMathInText(m[7], 's')
    } else if (m[8] !== undefined && m[9] !== undefined) {
      html += '<a href="' + escapeHtml(m[9]) + '">' + renderMathInText(m[8]) + '</a>'
    }
    last = m.index! + m[0].length
  }
  if (last < text.length) html += mdInlineToHtml(text.slice(last))
  return html
}

function renderMathInText(text: string, wrapperTag?: string): string {
  if (!wrapperTag) return mdInlineToHtml(text)
  const tags = wrapperTag.split('><')
  const openTag = '<' + tags.join('><') + '>'
  const closeTag = '</' + [...tags].reverse().join('></') + '>'
  const mathRe = /\$\$(.+?)\$\$|\$(.+?)\$/gs
  let result = ''
  let last = 0
  for (const m of text.matchAll(mathRe)) {
    if (m.index! > last) {
      const seg = mdInlineToHtml(text.slice(last, m.index))
      result += openTag + seg + closeTag
    }
    try {
      const mathHtml = katex.renderToString(m[1] || m[2], { output: 'mathml', throwOnError: false, displayMode: !!m[1] })
      result += openTag + mathHtml + closeTag
    } catch {
      result += openTag + (m[1] ? '$$' : '$') + (m[1] || m[2]) + (m[1] ? '$$' : '$') + closeTag
    }
    last = m.index! + m[0].length
  }
  if (last < text.length) {
    const seg = mdInlineToHtml(text.slice(last))
    result += openTag + seg + closeTag
  }
  return result
}

export function copyToWordHtml(content: string, font?: string, enableLatex = true): string {
  const displayFont = font || 'Times New Roman'
  const blocks = parseBlocks(content)
  const parts: string[] = []

  for (const b of blocks) {
    switch (b.type) {
      case 'heading': {
        const fontSize = [28, 24, 20, 18, 16, 14][b.level - 1]
        parts.push(`<h${b.level} style="font-size:${fontSize}pt;font-weight:bold;margin:10px 0 6px 0;font-family:${displayFont},serif">${renderInline(b.text, enableLatex)}</h${b.level}>`)
        break
      }
      case 'para':
        parts.push(`<p style="margin:6px 0;font-family:${displayFont},serif;font-size:12pt;line-height:1.5">${renderInline(b.text, enableLatex)}</p>`)
        break
      case 'hr':
        parts.push('<hr style="border:none;border-top:1px solid #000;margin:8px 0">')
        break
      case 'quote': {
        const inner = b.lines.map(l => renderInline(l, enableLatex)).join('<br>')
        parts.push(`<blockquote style="margin:6px 0 6px 20px;padding:0 0 0 12px;border-left:3px solid #ccc;color:#555">${inner}</blockquote>`)
        break
      }
      case 'list': {
        const tag = b.ordered ? 'ol' : 'ul'
        const items = b.items.map(it => `<li>${renderInline(it, enableLatex)}</li>`).join('')
        parts.push(`<${tag} style="margin:3px 0;padding-left:24px">${items}</${tag}>`)
        break
      }
      case 'code': {
        const code = b.lines.map(l => escapeHtml(l)).join('\n')
        parts.push(`<pre style="font-family:Consolas,monospace;font-size:10pt;background:#f5f5f5;padding:8px;border:1px solid #ddd;border-radius:4px;white-space:pre-wrap;margin:6px 0">${code}</pre>`)
        break
      }
      case 'table': {
        const cols = b.rows[0].length
        const colStyle = `style="border:1px solid #000;padding:4px;font-family:${displayFont},serif;font-size:11pt"`
        const headerCells = b.rows[0].map(c => `<th ${colStyle};font-weight:bold;background:#f0f0f0" width="${(100 / cols)}%">${renderInline(c, enableLatex)}</th>`).join('')
        const bodyRows = b.rows.slice(1).map(r =>
          `<tr>${r.map(c => `<td ${colStyle}>${renderInline(c, enableLatex)}</td>`).join('')}</tr>`
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
