import type { Register } from 'claude-code'
import { toMainlandSimplified, toTaiwanTraditional } from './opencc'

type Converter = (text: string) => string

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
      // Preserve an unclosed code span instead of risking changes to
      // commands, paths, identifiers, or source fragments.
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
    // Do not rewrite prompts generated internally by another plugin.
    if (event.origin.kind === 'plugin') {
      return next(event)
    }

    // Deterministic local self-test. This never reaches the model.
    if (event.text.trim() === 'cn-converter-test') {
      const simplified = '忧郁的乌龟；软件；网络连接；代码'
      const traditional = toTaiwanTraditional(simplified)
      const roundTrip = toMainlandSimplified(traditional)

      return {
        drop:
          'Claude CN Converter 1.0.4 loaded\n' +
          'S → TW: ' + traditional + '\n' +
          'TW → S: ' + roundTrip,
      }
    }

    const converted = convertMarkdownAware(event.text, toTaiwanTraditional)

    return converted === event.text
      ? next(event)
      : next({ ...event, text: converted })
  })

  on('ui.render', { component: 'AssistantMessage' }, ($, event, next) => {
    if (typeof event.props.text !== 'string') {
      return next(event)
    }

    const converted = convertMarkdownAware(
      event.props.text,
      toMainlandSimplified,
    )

    return converted === event.props.text
      ? next(event)
      : next({
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

    const converted = convertMarkdownAware(
      event.props.text,
      toMainlandSimplified,
    )

    return converted === event.props.text
      ? next(event)
      : next({
          ...event,
          props: {
            ...event.props,
            text: converted,
          },
        })
  })
}
