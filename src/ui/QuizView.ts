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

  private lastQuestion = ''
  private lastLeft = ''
  private lastRight = ''
  private lastCountdown = ''
  private lastVerdict = ''
  private lastExplanation = ''
  private lastScore = ''
  private lastChosen: ChoiceSide | null = null

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

    this.hiddenQuiz()
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
