import type { Member, MultiConnection, UpdateMembersCallback } from './MultiConnection'

const AVATARS = ['⛏️', '💎', '🚂', '🔦', '🪨', '🧭', '🎒', '🪓', '🕯️', '🗺️']
const NAMES = [
  'ホクト',
  'タロウ',
  'ガンモ',
  'ハナコ',
  'リンゴ',
  'ソラ',
  'カズキ',
  'ミドリ',
  'ユウト',
  'サクラ',
  'ケンタ',
  'アヤ',
  'ダイチ',
  'モモ',
  'リク',
  'ナナミ',
  'ハル',
  'アオイ',
  'ショウ',
  'ユイ',
  'タクミ',
  'コハル',
  'レン',
  'ミオ',
  'ジン',
  'ノゾミ',
  'カイ',
  'ヒナタ',
  'ソウタ',
  'ツバサ',
]

const ALL_MEMBERS: readonly Member[] = NAMES.map((name, i) => ({
  id: `dummy-${i}`,
  name,
  avatar: AVATARS[i % AVATARS.length],
}))

interface DummyOptions {
  readonly minDelayMs?: number
  readonly maxDelayMs?: number
}

export class DummyMultiConnection implements MultiConnection {
  private readonly minDelay: number
  private readonly maxDelay: number
  private timers: number[] = []
  private joined: Member[] = []

  constructor(options: DummyOptions = {}) {
    this.minDelay = options.minDelayMs ?? 200
    this.maxDelay = options.maxDelayMs ?? 900
  }

  start(onUpdateMembers: UpdateMembersCallback): void {
    this.stop()
    onUpdateMembers(this.joined)
    let elapsed = 0
    for (const member of ALL_MEMBERS) {
      elapsed += this.randomDelay()
      const id = window.setTimeout(() => {
        this.joined = [...this.joined, member]
        onUpdateMembers(this.joined)
      }, elapsed)
      this.timers.push(id)
    }
  }

  stop(): void {
    for (const id of this.timers) clearTimeout(id)
    this.timers = []
    this.joined = []
  }

  private randomDelay(): number {
    return this.minDelay + Math.random() * (this.maxDelay - this.minDelay)
  }
}
