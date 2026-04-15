/**
 * Howler 2.x levereras som UMD/CommonJS (exports.Howl), inte som ESM.
 * Vite/esbuild mappar det ofta till default eller namespace — vi plockar ut konstruktorn.
 * Samma API som i https://github.com/goldfire/howler.js#documentation
 */
import * as howlerPkg from 'howler'
import type { Howl as HowlInstance, HowlOptions } from 'howler'

type HowlConstructor = new (options: HowlOptions) => HowlInstance

const p = howlerPkg as unknown as {
  Howl?: HowlConstructor
  default?: { Howl?: HowlConstructor } | HowlConstructor
}

const HowlResolved: HowlConstructor | undefined =
  p.Howl ??
  (typeof p.default === 'function' ? (p.default as unknown as HowlConstructor) : p.default?.Howl)

if (!HowlResolved) {
  throw new Error('Howl kunde inte laddas från howler-paketet')
}

export const Howl = HowlResolved
