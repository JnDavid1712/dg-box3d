import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import './App.css'

const BOX = { width: 4.8, height: 3, depth: 2.8 }
const LABEL_WIDTH = 3072
const LABEL_HEIGHT = 2048

function makeCanvas(width = LABEL_WIDTH, height = LABEL_HEIGHT) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('No se pudo crear el contexto de etiquetas 2D')
  return { canvas, context }
}

function kraftBackground(context: CanvasRenderingContext2D, width: number, height: number) {
  context.fillStyle = '#b88d5a'
  context.fillRect(0, 0, width, height)
  const grain = context.createImageData(width, height)
  for (let i = 0; i < grain.data.length; i += 4) {
    const noise = (seededNoise(i / 4) - 0.5) * 21
    grain.data[i] = Math.max(0, Math.min(255, 184 + noise))
    grain.data[i + 1] = Math.max(0, Math.min(255, 141 + noise))
    grain.data[i + 2] = Math.max(0, Math.min(255, 90 + noise))
    grain.data[i + 3] = 28
  }
  context.putImageData(grain, 0, 0)
  context.globalAlpha = 0.16
  context.strokeStyle = '#f2d5a5'
  context.lineWidth = 2
  for (let y = 12; y < height; y += 24) {
    context.beginPath()
    context.moveTo(0, y)
    context.lineTo(width, y + Math.sin(y) * 4)
    context.stroke()
  }
  context.globalAlpha = 1
}

function seededNoise(seed: number) {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return value - Math.floor(value)
}

interface TextSection {
  text: string
  font?: string
  lineHeight: number
  letterSpacing?: string
  fillStyle?: string // opcional: útil si quieres partes en color rojo o negro
}

function drawMultiStyleBlock(
  context: CanvasRenderingContext2D,
  sections: TextSection[],
  x: number,
  startY: number,
  maxWidth: number,
) {
  let currentY = startY

  for (const section of sections) {
    if (section.font) context.font = section.font
    if (section.fillStyle) context.fillStyle = section.fillStyle
    context.letterSpacing = section.letterSpacing ?? '0px'

    for (const paragraph of section.text.split('\n')) {
      const trimmed = paragraph.trim()
      if (!trimmed) {
        currentY += section.lineHeight
        continue
      }

      let line = ''
      const words = trimmed.split(/\s+/)

      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word
        if (line && context.measureText(candidate).width > maxWidth) {
          context.fillText(line, x, currentY)
          currentY += section.lineHeight
          line = word
        } else {
          line = candidate
        }
      }

      if (line) {
        context.fillText(line, x, currentY)
        currentY += section.lineHeight
      }
    }
  }

  context.letterSpacing = '0px'
}

function drawFlammableLabel(context: CanvasRenderingContext2D, x: number, y: number, size: number) {
  context.save()
  context.translate(x, y)
  context.rotate(Math.PI / 4)
  context.fillRect(-size * 0.5, -size * 0.5, size, size)
  context.fillStyle = '#d52832'
  context.fillRect(-size * 0.46, -size * 0.46, size * 0.92, size * 0.92)
  context.restore()

  context.save()
  context.translate(x, y)
  context.rotate(Math.PI / 4)
  context.strokeStyle = '#fff'
  context.lineWidth = 6
  context.strokeRect(-size * 0.405, -size * 0.405, size * 0.81, size * 0.81)
  context.restore()

  context.save()
  context.translate(x, y - 180)
  context.fillStyle = '#fff'
  context.beginPath()
  context.moveTo(0, -108)
  context.bezierCurveTo(-11, -62, -58, -40, -57, 14)
  context.bezierCurveTo(-56, 57, -29, 82, 0, 82)
  context.bezierCurveTo(39, 82, 62, 52, 59, 17)
  context.bezierCurveTo(55, -19, 34, -42, 24, -67)
  context.bezierCurveTo(21, -34, 3, -23, 1, -2)
  context.bezierCurveTo(-16, -27, -7, -58, 0, -108)
  context.closePath()
  context.fill()
  context.fillStyle = '#d52832'
  context.beginPath()
  context.moveTo(3, 60)
  context.bezierCurveTo(-21, 57, -33, 36, -27, 14)
  context.bezierCurveTo(-22, -2, -11, -10, -8, -29)
  context.bezierCurveTo(3, -13, 9, 0, 5, 16)
  context.bezierCurveTo(18, 7, 24, -4, 24, -15)
  context.bezierCurveTo(42, 16, 33, 55, 3, 60)
  context.closePath()
  context.fill()
  context.restore()

  context.save()
  context.fillStyle = '#fff'
  context.textAlign = 'center'
  context.fillRect(x - size * 0.105, y - 82, size * 0.21, 9)
  context.font = 'bold 65px Arial, sans-serif'
  context.fillText('Líquidos Inflamables', x, y + 20, size * 1)
  context.font = 'bold 92px Arial, sans-serif'
  context.fillText('3', x, y + 20 + size * 0.42)
  context.restore()
}

function drawNfpa(context: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const half = size / 2
  const quarter = half / 2
  const top: [number, number] = [x, y - half]
  const right: [number, number] = [x + half, y]
  const bottom: [number, number] = [x, y + half]
  const left: [number, number] = [x - half, y]
  const topLeft: [number, number] = [x - quarter, y - quarter]
  const topRight: [number, number] = [x + quarter, y - quarter]
  const bottomRight: [number, number] = [x + quarter, y + quarter]
  const bottomLeft: [number, number] = [x - quarter, y + quarter]
  const center: [number, number] = [x, y]
  const cells = [
    { points: [top, topRight, center, topLeft], color: '#e92732', text: '3', textX: x, textY: y - half * 0.48 },
    { points: [left, topLeft, center, bottomLeft], color: '#1686d1', text: '2', textX: x - half * 0.52, textY: y },
    { points: [right, bottomRight, center, topRight], color: '#f5dc22', text: '0', textX: x + half * 0.52, textY: y },
    { points: [bottom, bottomLeft, center, bottomRight], color: '#fff', text: '', textX: x, textY: y },
  ]
  for (const cell of cells) {
    context.beginPath()
    cell.points.forEach(([px, py], index) => index ? context.lineTo(px, py) : context.moveTo(px, py))
    context.closePath()
    context.fillStyle = cell.color
    context.fill()
    if (cell.text) {
      context.fillStyle = '#111'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.font = 'bold 150px Arial, sans-serif'
      context.fillText(cell.text, cell.textX, cell.textY)
    }
  }
  context.beginPath()
  context.moveTo(top[0], top[1])
  context.lineTo(right[0], right[1])
  context.lineTo(bottom[0], bottom[1])
  context.lineTo(left[0], left[1])
  context.closePath()
  context.moveTo(topLeft[0], topLeft[1])
  context.lineTo(center[0], center[1])
  context.lineTo(topRight[0], topRight[1])
  context.moveTo(bottomLeft[0], bottomLeft[1])
  context.lineTo(center[0], center[1])
  context.lineTo(bottomRight[0], bottomRight[1])
  context.strokeStyle = '#111'
  context.lineWidth = 12
  context.stroke()
}

function drawUpLabel(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  context.fillStyle = '#f8f6ed'
  context.fillRect(x, y, width, height)
  context.strokeStyle = '#171717'
  context.lineWidth = 14
  context.strokeRect(x, y, width, height)
  context.fillStyle = '#111'
  for (const offset of [-width * 0.16, width * 0.16]) {
    const center = x + width / 2 + offset
    context.beginPath()
    context.moveTo(center, y + 42)
    context.lineTo(center + 58, y + 120)
    context.lineTo(center + 25, y + 120)
    context.lineTo(center + 25, y + height - 206)
    context.lineTo(center - 25, y + height - 206)
    context.lineTo(center - 25, y + 120)
    context.lineTo(center - 58, y + 120)
    context.closePath()
    context.fill()
  }
  context.textAlign = 'center'
  context.fillRect(x + width * 0.14, y + height - 190, width * 0.72, 30)
  context.font = 'bold 57px Arial, sans-serif'
  context.fillText('ESTE LADO', x + width / 2, y + height - 92)
  context.fillText('ARRIBA', x + width / 2, y + height - 30)
}

function makeFrontTexture() {
  const { canvas, context } = makeCanvas()
  kraftBackground(context, canvas.width, canvas.height)
  drawFlammableLabel(context, 600, 550, 750)
  drawNfpa(context, 1820, 550, 700)
  drawUpLabel(context, 2500, 180, 450, 650)

  context.fillStyle = '#101010'
  context.textAlign = 'center'
  context.font = 'bold 190px Arial, sans-serif'
  context.fillText('UN 1133', 650, 1250)
  context.font = 'bold 68px Arial, sans-serif'
  drawMultiStyleBlock(
    context,
    [
      {
        text: 'NOMBRE PROPIO DE EXPEDICIÓN:',
        font: 'bold 65px Arial, sans-serif',
        lineHeight: 84,
        letterSpacing: '-1.5px',
      },
      {
        text: 'ADHESIVOS, que contienen\nlíquidos inflamables',
        font: 'bold 70px Arial, sans-serif',
        lineHeight: 84,
        letterSpacing: '-1.5px',
      },
    ],
    680,
    1390,
    1480,
  )

  context.fillStyle = 'rgba(248, 237, 211, .65)'
  context.strokeStyle = '#252019'
  context.lineWidth = 10
  context.strokeRect(1800, 1160, 1170, 580)
  context.textAlign = 'left'
  context.fillStyle = '#191612'
  context.font = 'bold 47px Arial, sans-serif'
  const details = [
    'NÚMERO ONU 1133 (Propiedades de adhesivo',
    'líquido inflamable).',
    'Clase / división: 3.',
    'GUÍA GRE: 128 (Líquidos inflamables -',
    'No mezclables con agua).',
    'PELIGROS: Riesgo de incendio o explosión.',
    'RECOMENDACIONES:',
    'NO USAR AGUA. Aislar área 50 metros.',
  ]
  details.forEach((line, index) => context.fillText(line, 1825, 1225 + index * 67))

  context.strokeStyle = '#28221b'
  context.lineWidth = 6
  context.strokeRect(1300, 1580, 355, 230)
  context.textAlign = 'center'

  drawMultiStyleBlock(
    context,
    [
      {
        font: 'bold 36px Arial, sans-serif',
        letterSpacing: '-1px',
        lineHeight: 44,
        text: `CEA - CENTRO DE
  ESTUDIOS
  AERONAUTICOS.
  TGTA III.`,
      },
    ],
    1480, 
    1630,
    500,
  )

  const planeX = 1620
  const planeY = 1775
  context.translate(planeX, planeY)
  const degrees = -90 

  context.rotate((degrees * Math.PI) / 180)

  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = '45px Arial, sans-serif'

  context.fillText('✈', 0, 0)

  context.restore()

  context.textAlign = 'left'

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function makeSideTexture() {
  const { canvas, context } = makeCanvas(2048, 2048)
  kraftBackground(context, canvas.width, canvas.height)
  drawUpLabel(context, 100, 180, 450, 650)
  drawUpLabel(context, 1500, 180, 450, 650)
  context.save()
  context.fillStyle = '#111'
  context.textAlign = 'center'
  context.font = 'bold 160px Arial Narrow, Arial, sans-serif'
  context.fillText('UN 4G/Y1.5/S/23/USA/XYZ', 1024, 1785)
  context.restore()
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function makeTopTexture() {
  const { canvas, context } = makeCanvas()
  kraftBackground(context, canvas.width, canvas.height)
  context.strokeStyle = 'rgba(72, 45, 22, .55)'
  context.lineWidth = 10
  context.strokeRect(80, 80, canvas.width - 160, canvas.height - 160)
  context.beginPath()
  context.moveTo(canvas.width / 2, 80)
  context.lineTo(canvas.width / 2, canvas.height - 80)
  context.moveTo(80, canvas.height / 2)
  context.lineTo(canvas.width - 80, canvas.height / 2)
  context.stroke()
  context.fillStyle = 'rgba(172, 136, 88, .8)'
  context.fillRect(canvas.width * 0.46, 0, canvas.width * 0.08, canvas.height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function makeRoughnessTexture() {
  const { canvas, context } = makeCanvas(512, 512)
  context.fillStyle = '#b5b5b5'
  context.fillRect(0, 0, 512, 512)
  const grain = context.createImageData(512, 512)
  for (let i = 0; i < grain.data.length; i += 4) {
    const value = 150 + Math.random() * 80
    grain.data[i] = value
    grain.data[i + 1] = value
    grain.data[i + 2] = value
    grain.data[i + 3] = 255
  }
  context.putImageData(grain, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(3, 2)
  return texture
}

type CartonProps = { xray: boolean }

function Carton({ xray }: CartonProps) {
  const materials = useRef<THREE.MeshStandardMaterial[]>([])
  const interior = useRef<THREE.Group>(null)
  const xrayProgress = useRef(0)
  const xrayTintProgress = useRef(0)
  const interiorProgress = useRef(0)
  const frontTexture = useMemo(() => makeFrontTexture(), [])
  const sideTexture = useMemo(() => makeSideTexture(), [])
  const topTexture = useMemo(() => makeTopTexture(), [])
  const roughnessMap = useMemo(() => makeRoughnessTexture(), [])
  const faceMaterials = useMemo(() => {
    const kraft = () => new THREE.MeshStandardMaterial({
      color: '#c19a6c',
      roughness: 0.92,
      roughnessMap,
    })
    const front = new THREE.MeshStandardMaterial({ color: '#fff', map: frontTexture, roughness: 0.86, roughnessMap })
    const top = new THREE.MeshStandardMaterial({ color: '#fff', map: topTexture, roughness: 0.88, roughnessMap })
    const mats = [kraft(), kraft(), top, kraft(), front, front.clone()]
    mats[0].map = sideTexture
    mats[1].map = sideTexture
    mats[0].color.set('#fff')
    mats[1].color.set('#fff')
    mats[3].map = topTexture
    mats[3].color.set('#fff')
    mats[4] = front
    mats[5] = front.clone()
    return mats
  }, [frontTexture, roughnessMap, sideTexture, topTexture])
  useLayoutEffect(() => {
    materials.current = faceMaterials
  }, [faceMaterials])
  const canTexture = useMemo(() => {
    const { canvas, context } = makeCanvas(1024, 1024)
    const gradient = context.createLinearGradient(0, 0, canvas.width, 0)
    gradient.addColorStop(0, '#59616a')
    gradient.addColorStop(0.25, '#d7dde0')
    gradient.addColorStop(0.5, '#87919a')
    gradient.addColorStop(0.75, '#e3e7e8')
    gradient.addColorStop(1, '#525b64')
    context.fillStyle = gradient
    context.fillRect(0, 0, canvas.width, canvas.height)
    return new THREE.CanvasTexture(canvas)
  }, [])

  // Three.js requires imperative material updates for smooth frame-by-frame interpolation.
  /* eslint-disable react-hooks/immutability */
  useFrame((_, delta) => {
    const target = xray ? 1 : 0
    xrayProgress.current = THREE.MathUtils.damp(xrayProgress.current, target, xray ? 4 : 20, delta)
    xrayTintProgress.current = THREE.MathUtils.damp(xrayTintProgress.current, target, xray ? 16 : 30, delta)
    interiorProgress.current = THREE.MathUtils.damp(interiorProgress.current, target, xray ? 12 : 20, delta)
    for (const material of materials.current) {
      const transparent = xrayProgress.current > 0.001
      const depthWrite = xrayProgress.current < 0.98
      if (material.transparent !== transparent || material.depthWrite !== depthWrite) {
        material.transparent = transparent
        material.depthWrite = depthWrite
        material.needsUpdate = true
      }
      material.opacity = 1 - xrayProgress.current * 0.76
      material.color.setRGB(
        1 - xrayTintProgress.current * 0.35,
        1 - xrayTintProgress.current * 0.2,
        1,
      )
      material.emissive.setRGB(
        xrayTintProgress.current * 0.08,
        xrayTintProgress.current * 0.16,
        xrayTintProgress.current * 0.28,
      )
    }
    if (interior.current) {
      interior.current.visible = interiorProgress.current > 0.001
      interior.current.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return
        const meshMaterials = Array.isArray(object.material) ? object.material : [object.material]
        for (const material of meshMaterials) {
          if (!(material instanceof THREE.MeshStandardMaterial)) continue
          material.transparent = true
          material.depthWrite = false
          material.opacity = interiorProgress.current
        }
      })
      /* eslint-enable react-hooks/immutability */
    }
  })

  const granules = useMemo(() => {
    const count = 115
    const positions: [number, number, number][] = []
    for (let index = 0; index < count; index += 1) {
      const angle = seededNoise(index * 3) * Math.PI * 2
      const radius = 0.6 + seededNoise(index * 3 + 1) * 0.72
      positions.push([
        Math.cos(angle) * radius,
        (seededNoise(index * 3 + 2) - 0.5) * 2.3,
        Math.sin(angle) * radius,
      ])
    }
    return positions
  }, [])
  const granuleRef = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    if (!granuleRef.current) return
    granules.forEach(([x, y, z], index) => {
      const matrix = new THREE.Matrix4()
      matrix.compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(
          seededNoise(index * 3),
          seededNoise(index * 3 + 1),
          seededNoise(index * 3 + 2),
        )),
        new THREE.Vector3(0.06, 0.05, 0.06),
      )
      granuleRef.current?.setMatrixAt(index, matrix)
    })
    granuleRef.current.instanceMatrix.needsUpdate = true
  }, [granules])

  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[BOX.width, BOX.height, BOX.depth]} />
        {faceMaterials.map((material, index) => <primitive object={material} attach={`material-${index}`} key={index} />)}
      </mesh>

      <mesh position={[0, BOX.height / 2 + 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[0.38, BOX.depth]} />
        <meshStandardMaterial color="#b18c60" roughness={0.48} metalness={0.05} transparent opacity={0.68} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (BOX.width / 2 + 0.014), 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[BOX.depth, 0.3]} />
          <meshStandardMaterial color="#b18c60" roughness={0.5} transparent opacity={0.58} />
        </mesh>
      ))}

      <group ref={interior}>
        <mesh position={[0, -0.02, 0]} castShadow>
          <cylinderGeometry args={[0.57, 0.57, 2.15, 64]} />
          <meshStandardMaterial map={canTexture} color="#cbd3d9" metalness={0.8} roughness={0.2} transparent opacity={0} depthWrite={false} />
        </mesh>
        <mesh position={[0, 1.06, 0]}>
          <cylinderGeometry args={[0.57, 0.57, 0.08, 64]} />
          <meshStandardMaterial color="#aeb8bf" metalness={0.82} roughness={0.2} transparent opacity={0} depthWrite={false} />
        </mesh>
        <instancedMesh ref={granuleRef} args={[undefined, undefined, granules.length]} castShadow>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#e5a744" roughness={0.78} transparent opacity={0} depthWrite={false} />
        </instancedMesh>
      </group>
    </group>
  )
}

function Scene({ xray }: CartonProps) {
  return (
    <>
      <color attach="background" args={['#080d16']} />
      <ambientLight intensity={1.5} />
      <hemisphereLight args={['#dbe9ff', '#533d29', 1.4]} />
      <directionalLight position={[5, 8, 6]} intensity={3.2} castShadow shadow-mapSize={[2048, 2048]} />
      <directionalLight position={[-5, 3, -4]} intensity={1.7} color="#9ab8e8" />
      <spotLight position={[0, 6, 1]} angle={0.7} penumbra={0.8} intensity={1.5} />
      <Carton xray={xray} />
      <ContactShadows position={[0, -1.53, 0]} opacity={0.45} scale={11} blur={2.5} far={4} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={4.2}
        maxDistance={11}
        minPolarAngle={0.12}
        maxPolarAngle={Math.PI - 0.12}
        target={[0, 0, 0]}
      />
    </>
  )
}

function App() {
  const [xray, setXray] = useState(false)

  return (
    <main className="app-shell">
      <Canvas
        className="scene-canvas"
        shadows
        camera={{ position: [6.8, 4.7, 7.6], fov: 34, near: 0.1, far: 100 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <Scene xray={xray} />
      </Canvas>

      <aside className="info-panel">
        <div className="brand-mark" aria-hidden="true">CEA</div>
        <p className="eyebrow">TECNOLOGÍA EN GESTIÓN DE TRÁNSITO AÉREO</p>
        <h1>Embalaje 3D <span>UN 1133</span></h1>
        <p className="panel-copy">Visualización interactiva de mercancías peligrosas</p>

        <div className="details-list">
          <div className="detail-row"><span>Mercancía</span><strong>Soldadura PVC (Adhesivos)</strong></div>
          <div className="detail-row"><span>Clase IATA</span><strong><i className="class-dot" />3 · Líquidos inflamables</strong></div>
          <div className="detail-row"><span>Embalaje</span><strong>Caja combinada UN 4G</strong></div>
          <div className="detail-row"><span>Guía GRE</span><strong>128 · No usar agua / Aislar 50 m</strong></div>
        </div>

        <button className={`xray-button${xray ? ' is-active' : ''}`} type="button" onClick={() => setXray((value) => !value)}>
          <span className="button-icon" aria-hidden="true">◉</span>
          {xray ? 'Desactivar modo rayos X' : 'Activar modo rayos X'}
          <span className="button-arrow" aria-hidden="true">↗</span>
        </button>
        <div className="panel-footer">
          <span className={`status-dot${xray ? ' status-xray' : ''}`} />
          {xray ? 'Interior visible · recipiente metálico' : 'Vista exterior · cartón kraft'}
        </div>
      </aside>

      <div className="scene-heading">
        <span className="live-indicator" />
        <div>
          <strong>INSPECCIÓN DE EMBALAJE</strong>
          <span>MODELO INTERACTIVO <b>·</b> {xray ? 'RAYOS X' : 'VISTA 3D'}</span>
        </div>
      </div>

      <div className="interaction-hint">
        <span className="hint-mouse" aria-hidden="true"><i /></span>
        <span>Arrastra para girar <b>·</b> Rueda para acercar</span>
      </div>

      <div className="corner-label" aria-hidden="true">
        <span>DG</span>
        <i />
        <span>03</span>
      </div>
    </main>
  )
}

export default App
