import type { Vote } from '../../multi/MultiConnection'

export type ChoiceSide = 'left' | 'right'
export type ProgressBoxState = 'upcoming' | 'current' | 'correct' | 'wrong'

export class QuizView {
  private readonly questionOverlay: HTMLDivElement
  private readonly choicesOverlay: HTMLDivElement
  private readonly leftChoice: HTMLDivElement
  private readonly rightChoice: HTMLDivElement
  private readonly leftLabel: HTMLDivElement
  private readonly rightLabel: HTMLDivElement
  private readonly leftVoters: HTMLDivElement
  private readonly rightVoters: HTMLDivElement
  private readonly countdownOverlay: HTMLDivElement
  private readonly resultOverlay: HTMLDivElement
  private readonly resultVerdict: HTMLDivElement
  private readonly resultExplanation: HTMLDivElement
  private readonly scoreOverlay: HTMLDivElement
  private readonly sparkleLayer: HTMLDivElement

  private lastQuestion = ''
  private lastLeft = ''
  private lastRight = ''
  private lastCountdown = ''
  private lastVerdict = ''
  private lastExplanation = ''
  private lastChosen: ChoiceSide | null = null
  private explanationTimer: number | null = null
  private qboxes: HTMLDivElement[] = []
  private lastStates: ProgressBoxState[] = []
  private lastChoiceQuestionId: number | null = null
  private readonly imageStatus = new Map<string, 'loading' | 'ready' | 'missing'>()

  constructor(root: ParentNode) {
    this.questionOverlay = root.querySelector<HTMLDivElement>('#question-overlay')!
    this.choicesOverlay = root.querySelector<HTMLDivElement>('#choices-overlay')!
    this.leftChoice = root.querySelector<HTMLDivElement>('.choice[data-direction="left"]')!
    this.rightChoice = root.querySelector<HTMLDivElement>('.choice[data-direction="right"]')!
    this.leftLabel = root.querySelector<HTMLDivElement>('.choice[data-direction="left"] .choice-label')!
    this.rightLabel = root.querySelector<HTMLDivElement>('.choice[data-direction="right"] .choice-label')!
    this.leftVoters = root.querySelector<HTMLDivElement>('.choice[data-direction="left"] .choice-voters')!
    this.rightVoters = root.querySelector<HTMLDivElement>('.choice[data-direction="right"] .choice-voters')!
    this.countdownOverlay = root.querySelector<HTMLDivElement>('#countdown-overlay')!
    this.resultOverlay = root.querySelector<HTMLDivElement>('#result-overlay')!
    this.resultVerdict = this.resultOverlay.querySelector<HTMLDivElement>('.result-verdict')!
    this.resultExplanation = this.resultOverlay.querySelector<HTMLDivElement>('.result-explanation')!
    this.scoreOverlay = root.querySelector<HTMLDivElement>('#score-overlay')!
    this.sparkleLayer = root.querySelector<HTMLDivElement>('#sparkle-layer')!

    this.hiddenQuiz()
  }

  playSparkle(): void {
    const count = 18
    const cx = window.innerWidth / 2
    const cy = window.innerHeight * 0.38
    const symbols = ['✦', '✧', '✨', '⋆']
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div')
      el.className = 'sparkle'
      el.textContent = symbols[Math.floor(Math.random() * symbols.length)]
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4
      const radius = 80 + Math.random() * 200
      const x = cx + Math.cos(angle) * radius
      const y = cy + Math.sin(angle) * radius * 0.75
      el.style.left = `${x}px`
      el.style.top = `${y}px`
      el.style.fontSize = `${22 + Math.random() * 28}px`
      el.style.animationDelay = `${Math.random() * 0.25}s`
      this.sparkleLayer.appendChild(el)
      el.addEventListener('animationend', () => el.remove(), { once: true })
    }
  }

  clearSparkle(): void {
    while (this.sparkleLayer.firstChild) {
      this.sparkleLayer.removeChild(this.sparkleLayer.firstChild)
    }
  }

  stageCorrectExplanation(delayMs = 1500): void {
    this.clearStage()
    this.resultOverlay.classList.add('staged')
    this.explanationTimer = window.setTimeout(() => {
      this.resultOverlay.classList.remove('staged')
      this.explanationTimer = null
    }, delayMs)
  }

  clearStage(): void {
    if (this.explanationTimer !== null) {
      clearTimeout(this.explanationTimer)
      this.explanationTimer = null
    }
    this.resultOverlay.classList.remove('staged')
  }

  renderQuestionBoard(text: string): void {
    this.questionOverlay.classList.remove('hidden')
    if (text !== this.lastQuestion) {
      this.questionOverlay.textContent = text
      this.lastQuestion = text
    }
  }

  renderLeftChoice(text: string): void {
    this.choicesOverlay.classList.remove('hidden')
    if (text !== this.lastLeft) {
      this.leftLabel.textContent = text
      this.lastLeft = text
    }
  }

  renderRightChoice(text: string): void {
    this.choicesOverlay.classList.remove('hidden')
    if (text !== this.lastRight) {
      this.rightLabel.textContent = text
      this.lastRight = text
    }
  }

  preloadChoiceImages(questionIds: readonly number[]): void {
    for (const id of questionIds) {
      this.preloadChoiceImage(id, 'left')
      this.preloadChoiceImage(id, 'right')
    }
  }

  applyChoiceImages(questionId: number): void {
    if (questionId === this.lastChoiceQuestionId) return
    this.lastChoiceQuestionId = questionId
    this.preloadChoiceImage(questionId, 'left')
    this.preloadChoiceImage(questionId, 'right')
    this.applyChoiceBg('left', questionId)
    this.applyChoiceBg('right', questionId)
  }

  private preloadChoiceImage(questionId: number, side: ChoiceSide): void {
    const key = `${questionId}:${side}`
    if (this.imageStatus.has(key)) return
    this.imageStatus.set(key, 'loading')
    const url = `/quiz/${questionId}/${side}.jpg`
    const img = new Image()
    img.onload = () => {
      this.imageStatus.set(key, 'ready')
      if (this.lastChoiceQuestionId === questionId) {
        this.applyChoiceBg(side, questionId)
      }
    }
    img.onerror = () => {
      this.imageStatus.set(key, 'missing')
    }
    img.src = url
  }

  private applyChoiceBg(side: ChoiceSide, questionId: number): void {
    const el = side === 'left' ? this.leftLabel : this.rightLabel
    const status = this.imageStatus.get(`${questionId}:${side}`)
    if (status === 'ready') {
      el.style.backgroundImage = `url("/quiz/${questionId}/${side}.jpg")`
    } else {
      el.style.backgroundImage = ''
    }
  }

  renderCountDown(time: number): void {
    this.countdownOverlay.classList.remove('hidden')
    const s = String(time)
    if (s !== this.lastCountdown) {
      this.countdownOverlay.textContent = s
      this.lastCountdown = s
    }
  }

  renderCorrect(description: string): void {
    this.showResult('正解!', 'correct', description)
  }

  renderWrong(description: string): void {
    this.showResult('不正解', 'wrong', description)
  }

  renderNone(description: string): void {
    this.showResult('未回答', 'wrong', description)
  }

  renderProgress(states: readonly ProgressBoxState[]): void {
    this.scoreOverlay.classList.remove('hidden')
    if (states.length !== this.qboxes.length) {
      this.scoreOverlay.textContent = ''
      this.qboxes = []
      for (let i = 0; i < states.length; i++) {
        const box = document.createElement('div')
        box.className = 'qbox'
        const label = document.createElement('div')
        label.className = 'qbox-label'
        label.textContent = String(i + 1)
        box.appendChild(label)
        this.scoreOverlay.appendChild(box)
        this.qboxes.push(box)
      }
      this.lastStates = new Array(states.length).fill('upcoming')
    }
    for (let i = 0; i < states.length; i++) {
      const s = states[i]
      if (s === this.lastStates[i]) continue
      const box = this.qboxes[i]
      box.classList.toggle('current', s === 'current')
      box.classList.toggle('correct', s === 'correct')
      box.classList.toggle('wrong', s === 'wrong')
      this.lastStates[i] = s
    }
  }

  renderVotes(votes: readonly Vote[]): void {
    this.leftVoters.replaceChildren(...this.buildVoterNodes(votes, 'left'))
    this.rightVoters.replaceChildren(...this.buildVoterNodes(votes, 'right'))
  }

  private buildVoterNodes(votes: readonly Vote[], side: ChoiceSide): HTMLDivElement[] {
    const nodes: HTMLDivElement[] = []
    for (const v of votes) {
      if (v.side !== side) continue
      const el = document.createElement('div')
      el.className = 'voter'

      const avatar = document.createElement('div')
      avatar.className = 'voter-avatar'
      avatar.textContent = v.member.avatar

      const name = document.createElement('div')
      name.className = 'voter-name'
      name.textContent = v.member.name

      el.append(avatar, name)
      nodes.push(el)
    }
    return nodes
  }

  setChosenSide(side: ChoiceSide | null): void {
    if (side === this.lastChosen) return
    this.choicesOverlay.classList.toggle('answering', side !== null)
    this.leftChoice.classList.toggle('chosen', side === 'left')
    this.rightChoice.classList.toggle('chosen', side === 'right')
    this.lastChosen = side
  }

  hiddenQuiz(): void {
    this.questionOverlay.classList.add('hidden')
    this.choicesOverlay.classList.add('hidden')
    this.countdownOverlay.classList.add('hidden')
    this.resultOverlay.classList.add('hidden')
    this.setChosenSide(null)
  }

  hideAll(): void {
    this.hiddenQuiz()
    this.scoreOverlay.classList.add('hidden')
    this.leftVoters.replaceChildren()
    this.rightVoters.replaceChildren()
    this.clearSparkle()
    this.clearStage()
  }

  private showResult(verdict: string, cls: 'correct' | 'wrong', description: string): void {
    this.resultOverlay.classList.remove('hidden')
    this.resultOverlay.classList.toggle('correct', cls === 'correct')
    this.resultOverlay.classList.toggle('wrong', cls === 'wrong')
    if (verdict !== this.lastVerdict) {
      this.resultVerdict.textContent = verdict
      this.lastVerdict = verdict
    }
    if (description !== this.lastExplanation) {
      this.resultExplanation.textContent = description
      this.lastExplanation = description
    }
  }
}
