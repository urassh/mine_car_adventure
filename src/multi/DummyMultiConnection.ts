import type {
  Member,
  MultiConnection,
  MultiConnectionHandlers,
  VoteSide,
} from './MultiConnection'

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

const POOL: readonly Member[] = NAMES.map((name, i) => ({
  id: `dummy-${i}`,
  name,
  avatar: AVATARS[i % AVATARS.length],
}))

interface DummyOptions {
  readonly minJoinMs?: number
  readonly maxJoinMs?: number
  readonly minVoteMs?: number
  readonly maxVoteMs?: number
}

export class DummyMultiConnection implements MultiConnection {
  private readonly minJoinMs: number
  private readonly maxJoinMs: number
  private readonly minVoteMs: number
  private readonly maxVoteMs: number
  private timers: number[] = []
  private members: Member[] = []
  private handlers: MultiConnectionHandlers | null = null
  private started = false

  constructor(options: DummyOptions = {}) {
    this.minJoinMs = options.minJoinMs ?? 200
    this.maxJoinMs = options.maxJoinMs ?? 900
    this.minVoteMs = options.minVoteMs ?? 1200
    this.maxVoteMs = options.maxVoteMs ?? 4500
  }

  start(handlers: MultiConnectionHandlers): void {
    this.handlers = handlers
    handlers.onUpdateMembers?.(this.members)
    if (this.started) return
    this.started = true
    this.scheduleJoins()
  }

  stop(): void {
    for (const id of this.timers) clearTimeout(id)
    this.timers = []
    this.members = []
    this.handlers = null
    this.started = false
  }

  private scheduleJoins(): void {
    let elapsed = 0
    for (const member of POOL) {
      elapsed += this.rand(this.minJoinMs, this.maxJoinMs)
      const joinAt = elapsed
      const id = window.setTimeout(() => {
        this.members = [...this.members, member]
        this.handlers?.onUpdateMembers?.(this.members)
        this.scheduleVote(member)
      }, joinAt)
      this.timers.push(id)
    }
  }

  private scheduleVote(member: Member): void {
    const delay = this.rand(this.minVoteMs, this.maxVoteMs)
    const id = window.setTimeout(() => {
      const side: VoteSide = Math.random() < 0.5 ? 'left' : 'right'
      this.handlers?.onVote?.({ member, side })
      if (this.started) this.scheduleVote(member)
    }, delay)
    this.timers.push(id)
  }

  private rand(min: number, max: number): number {
    return min + Math.random() * (max - min)
  }
}
