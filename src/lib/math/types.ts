export type LaTeXSource = 'auto' | 'chatgpt' | 'gemini' | 'claude' | 'deepseek'

export const LATEX_SOURCES: { value: LaTeXSource; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'chatgpt', label: 'ChatGPT' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'claude', label: 'Claude' },
  { value: 'deepseek', label: 'DeepSeek' },
]

export type Token =
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

export const GREEK: Record<string, string> = {
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

export const SYMBOLS: Record<string, string> = {
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
  longleftarrow: '\u27F5', longrightarrow: '\u27F6',
  Longleftarrow: '\u27F8', Longrightarrow: '\u27F9',
  because: '\u2235',
  degree: '\u00B0',
  AA: '\u00C5', angstrom: '\u00C5',
}

export const FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
  'sinh', 'cosh', 'tanh', 'coth',
  'arcsin', 'arccos', 'arctan',
  'log', 'ln', 'lg', 'exp',
  'det', 'dim', 'hom', 'ker', 'tr',
  'max', 'min', 'sup', 'inf', 'lim', 'limsup', 'liminf',
  'arg', 'deg', 'gcd', 'lcm', 'mod', 'pmod', 'bmod',
  'Pr',
])
