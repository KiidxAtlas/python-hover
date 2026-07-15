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
  const htmlTags = new Set([
    'a', 'abbr', 'article', 'aside', 'b', 'blockquote', 'body', 'br', 'button',
    'code', 'dd', 'details', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure',
    'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header',
    'hr', 'html', 'i', 'iframe', 'img', 'input', 'kbd', 'label', 'li', 'link',
    'main', 'meta', 'nav', 'ol', 'option', 'p', 'pre', 's', 'script', 'section',
    'select', 'small', 'span', 'strong', 'style', 'sub', 'summary', 'sup',
    'table', 'tbody', 'td', 'textarea', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul',
    'var', 'video', 'class',
  ])
  let out = ''
  for (let index = 0; index < input.length; index++) {
    if (input[index] !== '<') {
      out += input[index]
      continue
    }

    const close = input.indexOf('>', index + 1)
    if (close === -1) {
      out += input.slice(index)
      break
    }

    const candidate = input.slice(index, close + 1)
    const tagName = /^<\/?\s*([A-Za-z][\w-]*)/.exec(candidate)?.[1]?.toLowerCase()
    // Only consume syntactically tag-like spans. A bare comparison such as
    // `x < y and z > 0` is documentation text, not markup.
    if (
      (!!tagName && htmlTags.has(tagName) && /^<\/?[A-Za-z][^<>]*>$/.test(candidate)) ||
      /^<![A-Za-z][^<>]*>$/.test(candidate) ||
      /^<\?[^<>]*\?>$/.test(candidate) ||
      /^<!--[\s\S]*-->$/.test(candidate)
    ) {
      index = close
      continue
    }

    out += '<'
  }

  return out
}
