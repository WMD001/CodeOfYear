/** GitHub 常用语言色板；未知语言按名称哈希取辅助色 */
const LANGUAGE_COLORS: Record<string, string> = {
  Java: '#b07219',
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
  Markdown: '#083fa1',
  Go: '#00ADD8',
  Rust: '#dea584',
  C: '#555555',
  'C++': '#f34b7d',
  'C#': '#178600',
  PHP: '#4F5D95',
  Ruby: '#701516',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
  Vue: '#41b883',
  SQL: '#e38c00',
}

export function languageColor(lang: string): string {
  if (LANGUAGE_COLORS[lang]) return LANGUAGE_COLORS[lang]
  let hash = 0
  for (let i = 0; i < lang.length; i++) {
    hash = (hash * 31 + lang.charCodeAt(i)) >>> 0
  }
  const palette = ['#58a6ff', '#39c5cf', '#a371f7', '#d29922', '#f778ba', '#3fb950']
  return palette[hash % palette.length]
}

/** 在语言色实心背景上选择可读文本色 */
export function languageTextColor(lang: string): string {
  const hex = languageColor(lang)
  const n = Number.parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? '#0d1117' : '#ffffff'
}
