import type { Register } from 'claude-code'
import OpenCC from 'opencc-js'

type Converter = (text: string) => string

const toTraditional = OpenCC.Converter({
  from: 'cn',
  to: 'twp',
})

const toSimplified = OpenCC.Converter({
  from: 'twp',
  to: 'cn',
})

function convertInlineCodeAware(line: string, convert: Converter): string {
  let output = ''
  let cursor = 0

  while (cursor < line.length) {
    const tickStart = line.indexOf('`', cursor)

    if (tickStart === -1) {
      output += convert(line.slice(cursor))
      break
    }

    output += convert(line.slice(cursor, tickStart))

    let tickEnd = tickStart
    while (tickEnd < line.length && line[tickEnd] === '`') {
      tickEnd += 1
    }

    const delimiter = line.slice(tickStart, tickEnd)
    const closing = line.indexOf(delimiter, tickEnd)

    if (closing === -1) {
      // Unclosed inline code: preserve the remainder rather than risk
      // modifying a command, path, identifier, or source fragment.
      output += line.slice(tickStart)
      break
    }

    output += line.slice(tickStart, closing + delimiter.length)
    cursor = closing + delimiter.length
  }

  return output
}

function convertMarkdownAware(text: string, convert: Converter): string {
  let inFence = false
  let fenceChar = ''
  let fenceLength = 0

  return text
    .split(/(?<=\n)/)
    .map((lineWithEnding) => {
      const endingMatch = lineWithEnding.match(/(\r?\n)$/)
      const ending = endingMatch?.[1] ?? ''
      const line = ending ? lineWithEnding.slice(0, -ending.length) : lineWithEnding

      const fenceMatch = line.match(/^\s{0,3}(`{3,}|~{3,})/)

      if (fenceMatch) {
        const fence = fenceMatch[1]

        if (!inFence) {
          inFence = true
          fenceChar = fence[0]
          fenceLength = fence.length
        } else if (fence[0] === fenceChar && fence.length >= fenceLength) {
          inFence = false
          fenceChar = ''
          fenceLength = 0
        }

        return lineWithEnding
      }

      if (inFence) {
        return lineWithEnding
      }

      return convertInlineCodeAware(line, convert) + ending
    })
    .join('')
}

export const register: Register = (on) => {
  on('prompt.submit', ($, event, next) => {
    // Avoid touching prompts generated internally by another plugin.
    if (event.origin?.kind === 'plugin') {
      return next(event)
    }

    const converted = convertMarkdownAware(event.text, toTraditional)

    if (converted === event.text) {
      return next(event)
    }

    return next({
      ...event,
      text: converted,
    })
  })

  on('ui.render', { component: 'AssistantMessage' }, ($, event, next) => {
    if (typeof event.props.text !== 'string') {
      return next(event)
    }

    const converted = convertMarkdownAware(event.props.text, toSimplified)

    if (converted === event.props.text) {
      return next(event)
    }

    return next({
      ...event,
      props: {
        ...event.props,
        text: converted,
      },
    })
  })

  on('ui.render', { component: 'UserMessage' }, ($, event, next) => {
    if (typeof event.props.text !== 'string') {
      return next(event)
    }

    const converted = convertMarkdownAware(event.props.text, toSimplified)

    if (converted === event.props.text) {
      return next(event)
    }

    return next({
      ...event,
      props: {
        ...event.props,
        text: converted,
      },
    })
  })
}
