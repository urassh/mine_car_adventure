import * as THREE from 'three'
import './style.css'
import { GameController } from './controllers/GameController'
import { KeyboardInput } from './controllers/KeyboardInput'
import { Arches } from './objects/Arches'
import { Branch } from './objects/Branch'
import { CameraRig } from './objects/CameraRig'
import { Dust } from './objects/Dust'
import { MineCart } from './objects/MineCart'
import { Rails } from './objects/Rails'
import { Ties } from './objects/Ties'
import { Torches } from './objects/Torches'
import { Tunnel } from './objects/Tunnel'
import { QuizController } from './quiz/QuizController'
import { loadQuizData } from './quiz/QuizData'

const app = document.querySelector<HTMLDivElement>('#app')!

const DARK = 0x050505

const scene = new THREE.Scene()
scene.background = new THREE.Color(DARK)
// 指数フォグで遠景を闇に。ループのつなぎ目もこれで隠れる。
scene.fog = new THREE.FogExp2(DARK, 0.07)

const cameraRig = new CameraRig()

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)
// Tunnel が clippingPlanes で前方を切り落とすのに必要。
renderer.localClippingEnabled = true
app.appendChild(renderer.domElement)

const ambient = new THREE.AmbientLight(0xffcfa3, 0.15)
scene.add(ambient)

const rails = new Rails()
const ties = new Ties()
const tunnel = new Tunnel()
const arches = new Arches()
const torches = new Torches()
const dust = new Dust()
scene.add(rails)
scene.add(ties)
scene.add(tunnel)
scene.add(arches)
scene.add(torches)
scene.add(dust)


// カートはカメラに追従させるため子にする。camera 自身も scene 下にないと子が描画されない。
const cart = new MineCart()
cameraRig.camera.add(cart)
scene.add(cameraRig.camera)

window.addEventListener('resize', () => {
  cameraRig.resize()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

const game = new GameController()
const keyboard = new KeyboardInput(game)
keyboard.attach()

// Step 7/8: 選択 10s → 分岐 → 結果 → 次。Quiz の状態を毎フレーム観察して UI を切替。
const quiz = new QuizController(game)

const questionOverlay = document.querySelector<HTMLDivElement>('#question-overlay')!
const choicesOverlay = document.querySelector<HTMLDivElement>('#choices-overlay')!
const leftChoice = document.querySelector<HTMLDivElement>('.choice[data-direction="left"]')!
const rightChoice = document.querySelector<HTMLDivElement>('.choice[data-direction="right"]')!
const countdownOverlay = document.querySelector<HTMLDivElement>('#countdown-overlay')!
const resultOverlay = document.querySelector<HTMLDivElement>('#result-overlay')!
const resultVerdict = resultOverlay.querySelector<HTMLDivElement>('.result-verdict')!
const resultExplanation = resultOverlay.querySelector<HTMLDivElement>('.result-explanation')!
const scoreOverlay = document.querySelector<HTMLDivElement>('#score-overlay')!
const leftLabel = document.querySelector<HTMLDivElement>(
  '.choice[data-direction="left"] .choice-label',
)!
const rightLabel = document.querySelector<HTMLDivElement>(
  '.choice[data-direction="right"] .choice-label',
)!
// 初期状態 (Idle) では問題系オーバーレイは隠す。
questionOverlay.classList.add('hidden')
choicesOverlay.classList.add('hidden')
countdownOverlay.classList.add('hidden')
resultOverlay.classList.add('hidden')

loadQuizData()
  .then((questions) => {
    console.table(questions)
    quiz.setQuestions(questions)
  })
  .catch((err) => {
    console.error(err)
  })

// 表示中の問題 ID を覚えておき、変わった時だけテキストを差し替える (毎フレーム DOM 触らない)。
let renderedQuestionId: number | null = null
let lastRenderedCountdown: number | null = null
let lastRenderedResultId: number | null = null
let lastRenderedScore = ''

function renderQuestion(): void {
  const q = quiz.currentQuestion
  if (!q || renderedQuestionId === q.id) return
  questionOverlay.textContent = q.question
  leftLabel.textContent = q.choices.find((c) => c.direction === 'left')?.label ?? ''
  rightLabel.textContent = q.choices.find((c) => c.direction === 'right')?.label ?? ''
  renderedQuestionId = q.id
}

function renderCountdown(): void {
  const d = quiz.countdownDigit
  if (d === lastRenderedCountdown) return
  lastRenderedCountdown = d
  countdownOverlay.textContent = d === null ? '' : String(d)
}

function renderResult(): void {
  const r = quiz.lastResult
  // Resolved に入った瞬間に lastResult が更新される。表示は state==='Resolved' のときだけ。
  if (quiz.state !== 'Resolved' || !r) {
    lastRenderedResultId = null
    return
  }
  // 同じ result を毎フレーム書き直さないよう、判定済みかは question.id で識別。
  if (lastRenderedResultId === r.question.id) return
  if (r.answeredDirection === 'none') {
    resultVerdict.textContent = '未回答'
    resultOverlay.classList.remove('correct')
    resultOverlay.classList.add('wrong')
  } else if (r.isCorrect) {
    resultVerdict.textContent = '正解!'
    resultOverlay.classList.remove('wrong')
    resultOverlay.classList.add('correct')
  } else {
    resultVerdict.textContent = '不正解'
    resultOverlay.classList.remove('correct')
    resultOverlay.classList.add('wrong')
  }
  resultExplanation.textContent = r.question.explanation
  lastRenderedResultId = r.question.id
}

function renderScore(): void {
  const next = `正解 ${quiz.correctCount} / 回答 ${quiz.answeredCount}`
  if (next === lastRenderedScore) return
  scoreOverlay.textContent = next
  lastRenderedScore = next
}

// 分岐に乗るとき、本線とカメラを同じだけ横シフトする。分岐ピース自体は動かさないので
// 視野内で横に流れて見え、「片腕に乗って反対側が外れる」効果になる。
const laterallyShifted = [rails, ties, tunnel, arches, torches, dust]

let branchView: Branch | null = null

let prevTime = 0
renderer.setAnimationLoop((time) => {
  const dt = prevTime === 0 ? 0 : (time - prevTime) / 1000
  prevTime = time

  rails.update(dt)
  ties.update(dt)
  tunnel.update(dt)
  arches.update(dt)
  torches.update(dt)
  dust.update(dt)

  quiz.update(dt)
  game.update(dt)

  // 状態 → UI の振り分け。
  //   Selecting: 問題 + 2 択 + (残り 5s から) カウントダウン
  //   Answering: 問題 + 2 択 (操作確定後の余韻)
  //   Resolved : 結果のみ
  //   Idle     : すべて非表示
  const showQuestion = quiz.state === 'Selecting' || quiz.state === 'Answering'
  const showChoices = quiz.state === 'Selecting' || quiz.state === 'Answering'
  const showCountdown = quiz.countdownDigit !== null
  const showResult = quiz.state === 'Resolved'
  questionOverlay.classList.toggle('hidden', !showQuestion)
  choicesOverlay.classList.toggle('hidden', !showChoices)
  countdownOverlay.classList.toggle('hidden', !showCountdown)
  resultOverlay.classList.toggle('hidden', !showResult)

  // Answering 中は選択した方だけを中央に出す。game.branch.side で判定。
  // ( -1 → 左, 1 → 右。Answering 中は branch が必ず非 null になっている)
  const inAnswering = quiz.state === 'Answering'
  const chosenSide =
    inAnswering && game.branch ? (game.branch.side === 1 ? 'right' : 'left') : null
  choicesOverlay.classList.toggle('answering', inAnswering)
  leftChoice.classList.toggle('chosen', chosenSide === 'left')
  rightChoice.classList.toggle('chosen', chosenSide === 'right')

  renderQuestion()
  renderCountdown()
  renderResult()
  renderScore()

  if (game.branch) {
    if (!branchView) {
      branchView = new Branch()
      branchView.position.x = game.baseLateral
      scene.add(branchView)
    }
    branchView.position.z = game.branch.z
    tunnel.setClip(game.branch.z)
  } else if (branchView) {
    scene.remove(branchView)
    branchView = null
    tunnel.clearClip()
  }

  for (const obj of laterallyShifted) {
    obj.position.x = game.lateral
  }

  cameraRig.setLateral(game.lateral)
  cameraRig.setRoll(game.roll)
  cameraRig.tick(time)

  renderer.render(scene, cameraRig.camera)
})
