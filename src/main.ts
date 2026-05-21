import * as THREE from 'three'
import './style.css'
import { CAMERA_HEIGHT, CAMERA_LOOK_AHEAD } from './constants'
import { Rails } from './objects/Rails'
import { Ties } from './objects/Ties'

const app = document.querySelector<HTMLDivElement>('#app')!

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0a0a0a)

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.set(0, CAMERA_HEIGHT, 0)
camera.lookAt(0, CAMERA_HEIGHT, -CAMERA_LOOK_AHEAD)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)
app.appendChild(renderer.domElement)

// Step 1 は仮ライト。Step 4 で松明・フォグに置き換える
const ambient = new THREE.AmbientLight(0xffffff, 0.35)
scene.add(ambient)

const dirLight = new THREE.DirectionalLight(0xffffff, 0.9)
dirLight.position.set(4, 10, 2)
scene.add(dirLight)

const rails = new Rails()
const ties = new Ties()
scene.add(rails)
scene.add(ties)

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

let prevTime = 0
renderer.setAnimationLoop((time) => {
  // time は ms。初回フレームは dt=0 として扱う
  const dt = prevTime === 0 ? 0 : (time - prevTime) / 1000
  prevTime = time
  rails.update(dt)
  ties.update(dt)
  renderer.render(scene, camera)
})
