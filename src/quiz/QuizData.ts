export type ChoiceDirection = 'left' | 'right'

export type QuizChoice = {
  label: string
  direction: ChoiceDirection
  isCorrect: boolean
}

export type QuizQuestion = {
  id: number
  question: string
  choices: [QuizChoice, QuizChoice]
  explanation: string
}

export async function loadQuizData(
  url = '/quiz_data.json',
): Promise<QuizQuestion[]> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`quiz_data.json の読み込みに失敗: ${res.status} ${res.statusText}`)
  }
  return (await res.json()) as QuizQuestion[]
}
