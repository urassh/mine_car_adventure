import type {
  Member,
  MultiConnection,
  MultiConnectionHandlers,
  Vote,
} from './MultiConnection'

type ServerToHostMessage =
  | { readonly type: 'member_joined'; readonly member: Member }
  | { readonly type: 'vote'; readonly vote: Vote }

interface WebSocketMultiConnectionOptions {
  readonly url: string
}

export class WebSocketMultiConnection implements MultiConnection {
  private readonly url: string
  private ws: WebSocket | null = null
  private members: Member[] = []
  private handlers: MultiConnectionHandlers | null = null

  constructor(options: WebSocketMultiConnectionOptions) {
    this.url = options.url
  }

  start(handlers: MultiConnectionHandlers): void {
    this.handlers = handlers
    handlers.onUpdateMembers?.(this.members)
    if (this.ws) return
    const ws = new WebSocket(this.url)
    ws.addEventListener('message', this.onMessage)
    ws.addEventListener('error', (e) => console.error('[ws] error', e))
    ws.addEventListener('close', () => console.log('[ws] closed'))
    ws.addEventListener('open', () => console.log('[ws] connected', this.url))
    this.ws = ws
  }

  stop(): void {
    this.ws?.removeEventListener('message', this.onMessage)
    this.ws?.close()
    this.ws = null
    this.members = []
    this.handlers = null
  }

  private onMessage = (event: MessageEvent): void => {
    let msg: ServerToHostMessage
    try {
      msg = JSON.parse(event.data) as ServerToHostMessage
    } catch (err) {
      console.error('[ws] invalid message', err)
      return
    }
    if (msg.type === 'member_joined') {
      this.members = [...this.members, msg.member]
      this.handlers?.onUpdateMembers?.(this.members)
    } else if (msg.type === 'vote') {
      this.handlers?.onVote?.(msg.vote)
    }
  }
}
