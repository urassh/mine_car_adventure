export type ChoiceSide = 'left' | 'right'

export class QuizView {
  private readonly questionOverlay: HTMLDivElement
  private readonly choicesOverlay: HTMLDivElement
  private readonly leftChoice: HTMLDivElement
  private readonly rightChoice: HTMLDivElement
  private readonly leftLabel: HTMLDivElement
  private readonly rightLabel: HTMLDivElement
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
  private lastScore = ''
  private lastChosen: ChoiceSide | null = null
  private explanationTimer: number | null = null

  constructor(root: ParentNode) {
    this.questionOverlay = root.querySelector<HTMLDivElement>('#question-overlay')!
    this.choicesOverlay = root.querySelector<HTMLDivElement>('#choices-overlay')!
    this.leftChoice = root.querySelector<HTMLDivElement>('.choice[data-direction="left"]')!
    this.rightChoice = root.querySelector<HTMLDivElement>('.choice[data-direction="right"]')!
    this.leftLabel = root.querySelector<HTMLDivElement>('.choice[data-direction="left"] .choice-label')!
    this.rightLabel = root.querySelector<HTMLDivElement>('.choice[data-direction="right"] .choice-label')!
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

  renderScore(correct: number, answered: number): void {
    this.scoreOverlay.classList.remove('hidden')
    const txt = `正解 ${correct} / 回答 ${answered}`
    if (txt !== this.lastScore) {
      this.scoreOverlay.textContent = txt
      this.lastScore = txt
    }
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
