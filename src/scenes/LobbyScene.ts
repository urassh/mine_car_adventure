import QRCode from 'qrcode'

import type { Member, MultiConnection } from '../multi/MultiConnection'
import { WebSocketMultiConnection } from '../multi/WebSocketMultiConnection'
import type { NextSceneNavigator } from './NextSceneNavigator'
import { Scene } from './Scene'

const DEFAULT_WS_URL =
  (import.meta.env.VITE_SERVER_WS_URL as string | undefined) ??
  'ws://localhost:3002/host'

const CLIENT_URL =
  (import.meta.env.VITE_CLIENT_URL as string | undefined) ??
  'http://localhost:5174'

export class LobbyScene extends Scene {
  private overlay: HTMLDivElement | null = null
  private startButton: HTMLButtonElement | null = null
  private listEl: HTMLUListElement | null = null
  private qrCanvas: HTMLCanvasElement | null = null
  private qrLink: HTMLAnchorElement | null = null
  private navigator: NextSceneNavigator | null = null
  private readonly conn: MultiConnection

  constructor(
    connection: MultiConnection = new WebSocketMultiConnection({ url: DEFAULT_WS_URL }),
  ) {
    super()
    this.conn = connection
  }

  get connection(): MultiConnection {
    return this.conn
  }

  mount(navigator: NextSceneNavigator): void {
    this.navigator = navigator

    this.overlay = document.querySelector<HTMLDivElement>('#lobby-overlay')
    this.startButton = this.overlay?.querySelector<HTMLButtonElement>('.lobby-start') ?? null
    this.listEl = this.overlay?.querySelector<HTMLUListElement>('.lobby-members') ?? null
    this.qrCanvas = this.overlay?.querySelector<HTMLCanvasElement>('.lobby-qr') ?? null
    this.qrLink = this.overlay?.querySelector<HTMLAnchorElement>('.lobby-join-url') ?? null

    this.overlay?.classList.remove('hidden')
    this.startButton?.addEventListener('click', this.onStart)
    window.addEventListener('keydown', this.onKey)

    this.renderJoinQr()
    this.conn.start({ onUpdateMembers: this.onUpdateMembers })
  }

  unmount(): void {
    this.startButton?.removeEventListener('click', this.onStart)
    window.removeEventListener('keydown', this.onKey)
    this.overlay?.classList.add('hidden')
    if (this.listEl) this.listEl.innerHTML = ''
    this.navigator = null
  }

  private renderJoinQr(): void {
    if (this.qrLink) {
      this.qrLink.textContent = CLIENT_URL
      this.qrLink.href = CLIENT_URL
    }
    if (!this.qrCanvas) return
    // QR レンダリングは非同期だが結果を待つ必要はない (失敗してもロビーは動く)。
    void QRCode.toCanvas(this.qrCanvas, CLIENT_URL, {
      width: 220,
      margin: 1,
      color: { dark: '#1a1208', light: '#f7e6c4' },
    }).catch((e: unknown) => {
      console.error('QR generation failed', e)
    })
  }

  private onUpdateMembers = (members: readonly Member[]): void => {
    if (!this.listEl) return
    this.listEl.innerHTML = ''
    for (const m of members) {
      const li = document.createElement('li')
      li.className = 'lobby-member'

      const avatar = document.createElement('div')
      avatar.className = 'lobby-member-avatar'
      avatar.textContent = m.avatar

      const name = document.createElement('div')
      name.className = 'lobby-member-name'
      name.textContent = m.name

      li.append(avatar, name)
      this.listEl.append(li)
    }
  }

  private onStart = (): void => {
    this.navigator?.navigate_next_scene()
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' || e.code === 'Space') {
      e.preventDefault()
      this.onStart()
    }
  }
}
