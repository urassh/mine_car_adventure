import { DummyMultiConnection } from '../multi/DummyMultiConnection'
import type { Member, MultiConnection } from '../multi/MultiConnection'
import type { NextSceneNavigator } from './NextSceneNavigator'
import { Scene } from './Scene'

export class LobbyScene extends Scene {
  private overlay: HTMLDivElement | null = null
  private startButton: HTMLButtonElement | null = null
  private listEl: HTMLUListElement | null = null
  private navigator: NextSceneNavigator | null = null
  private readonly conn: MultiConnection

  constructor(connection: MultiConnection = new DummyMultiConnection()) {
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

    this.overlay?.classList.remove('hidden')
    this.startButton?.addEventListener('click', this.onStart)
    window.addEventListener('keydown', this.onKey)

    this.conn.start({ onUpdateMembers: this.onUpdateMembers })
  }

  unmount(): void {
    this.startButton?.removeEventListener('click', this.onStart)
    window.removeEventListener('keydown', this.onKey)
    this.overlay?.classList.add('hidden')
    if (this.listEl) this.listEl.innerHTML = ''
    this.navigator = null
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
