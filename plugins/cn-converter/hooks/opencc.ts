import {
  CJK as S2T_CJK,
  ST_PHRASES_REGIONAL,
  ST_CHARS,
  TW_PHRASES,
  TW_VARIANT_PHRASES,
  TW_VARIANTS,
} from './opencc-s2t-small-data'
import { ST_PHRASES_1 } from './opencc-s2t-st-phrases-01'
import { ST_PHRASES_2 } from './opencc-s2t-st-phrases-02'
import { ST_PHRASES_3 } from './opencc-s2t-st-phrases-03'
import { ST_PHRASES_4 } from './opencc-s2t-st-phrases-04'
import { ST_PHRASES_5 } from './opencc-s2t-st-phrases-05'

import {
  CJK as T2S_CJK,
  TW_PHRASES_REV,
  TW_VARIANT_PHRASES_REV,
  TW_VARIANTS_REV,
  TS_PHRASES,
  TS_CHARS,
} from './opencc-t2s-data'

type TrieNode = {
  children?: Map<number, TrieNode>
  value?: string
}

class Trie {
  private readonly root: TrieNode = {}

  addIfAbsent(source: string, target: string): void {
    let node = this.root

    for (const char of source) {
      const cp = char.codePointAt(0)!
      node.children ??= new Map<number, TrieNode>()

      let child = node.children.get(cp)
      if (!child) {
        child = {}
        node.children.set(cp, child)
      }

      node = child
    }

    // Earlier dictionaries have higher priority, matching OpenCC's
    // short-circuit groups for identical keys.
    if (node.value === undefined) {
      node.value = target
    }
  }

  match(text: string, start: number): { end: number; value: string } | null {
    let node = this.root
    let bestEnd = -1
    let bestValue: string | undefined

    for (let i = start; i < text.length;) {
      const cp = text.codePointAt(i)!
      const child = node.children?.get(cp)

      if (!child) {
        break
      }

      i += cp > 0xffff ? 2 : 1
      node = child

      if (node.value !== undefined) {
        bestEnd = i
        bestValue = node.value
      }
    }

    return bestEnd >= 0 && bestValue !== undefined
      ? { end: bestEnd, value: bestValue }
      : null
  }

  convert(text: string): string {
    const out: string[] = []
    let plainStart = -1

    for (let i = 0; i < text.length;) {
      const matched = this.match(text, i)

      if (matched) {
        if (plainStart >= 0) {
          out.push(text.slice(plainStart, i))
          plainStart = -1
        }

        out.push(matched.value)
        i = matched.end
        continue
      }

      if (plainStart < 0) {
        plainStart = i
      }

      const cp = text.codePointAt(i)!
      i += cp > 0xffff ? 2 : 1
    }

    if (plainStart >= 0) {
      out.push(text.slice(plainStart))
    }

    return out.join('')
  }
}

function firstTarget(raw: string): string {
  const space = raw.search(/\s/)
  return space < 0 ? raw : raw.slice(0, space)
}

function loadDictionary(trie: Trie, data: string): void {
  for (const line of data.split('\n')) {
    if (!line) continue

    const tab = line.indexOf('\t')
    if (tab <= 0) continue

    const source = line.slice(0, tab)
    const targetField = line.slice(tab + 1).trim()
    if (!targetField) continue

    trie.addIfAbsent(source, firstTarget(targetField))
  }
}

function makeStage(...dicts: string[]): Trie {
  const trie = new Trie()

  for (const dict of dicts) {
    loadDictionary(trie, dict)
  }

  return trie
}

const s2tNormalize = makeStage(S2T_CJK)
const s2tStage1 = makeStage(
  ST_PHRASES_1,
  ST_PHRASES_2,
  ST_PHRASES_3,
  ST_PHRASES_4,
  ST_PHRASES_5,
  ST_PHRASES_REGIONAL,
  ST_CHARS,
)
const s2tStage2 = makeStage(TW_PHRASES, TW_VARIANT_PHRASES, TW_VARIANTS)

const t2sNormalize = makeStage(T2S_CJK)
const t2sStage1 = makeStage(
  TW_PHRASES_REV,
  TW_VARIANT_PHRASES_REV,
  TW_VARIANTS_REV,
)
const t2sStage2 = makeStage(TS_PHRASES, TS_CHARS)

export function toTaiwanTraditional(text: string): string {
  return s2tStage2.convert(s2tStage1.convert(s2tNormalize.convert(text)))
}

export function toMainlandSimplified(text: string): string {
  return t2sStage2.convert(t2sStage1.convert(t2sNormalize.convert(text)))
}
