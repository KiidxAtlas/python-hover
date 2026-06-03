export function stripDangerousTagBlocks(input: string, tagNames: string[]): string {
  let text = input
  for (const tagName of tagNames) {
    const lowerTag = tagName.toLowerCase()
    const openToken = `<${lowerTag}`
    const closeToken = `</${lowerTag}>`

    let cursor = 0
    let out = ''
    const lower = text.toLowerCase()

    while (cursor < text.length) {
      const start = lower.indexOf(openToken, cursor)
      if (start === -1) {
        out += text.slice(cursor)
        break
      }

      out += text.slice(cursor, start)
      const end = lower.indexOf(closeToken, start + openToken.length)
      if (end === -1) {
        cursor = text.length
        break
      }

      cursor = end + closeToken.length
    }

    text = out
  }

  return text
}

export function stripHtmlTags(input: string): string {
  let out = ''
  let inTag = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (ch === '<') {
      inTag = true
      continue
    }
    if (ch === '>' && inTag) {
      inTag = false
      continue
    }
    if (!inTag) {
      out += ch
    }
  }

  return out
}
