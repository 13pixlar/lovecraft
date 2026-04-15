/** Trim plain text for meta description (no HTML). */
export function trimMetaDescription(text: string, maxLen = 160): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= maxLen) return t
  const cut = t.slice(0, maxLen)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim() + '…'
}
