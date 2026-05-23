export interface Member {
  readonly id: string
  readonly name: string
  readonly avatar: string
}

export type UpdateMembersCallback = (members: readonly Member[]) => void

export interface MultiConnection {
  start(onUpdateMembers: UpdateMembersCallback): void
  stop(): void
}
