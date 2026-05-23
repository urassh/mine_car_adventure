export type VoteSide = 'left' | 'right'

export interface Member {
  readonly id: string
  readonly name: string
  readonly avatar: string
}

export interface Vote {
  readonly member: Member
  readonly side: VoteSide
}

export type UpdateMembersCallback = (members: readonly Member[]) => void
export type OnVoteCallback = (vote: Vote) => void

export interface MultiConnectionHandlers {
  readonly onUpdateMembers?: UpdateMembersCallback
  readonly onVote?: OnVoteCallback
}

export interface MultiConnection {
  start(handlers: MultiConnectionHandlers): void
  stop(): void
}
