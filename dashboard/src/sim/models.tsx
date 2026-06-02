/* ───────────────────────────────────────────────────────────────────────
 *  Robot model library for the Simulation page (Isaac Lab "showroom" style).
 *
 *  Add a new robot by appending one entry to MODELS below: give it metadata
 *  and a Component that renders a three.js <group>. Data-driven models read the
 *  `joints` trajectory; procedural models animate from `phase`/`playing`/`speed`
 *  via useFrame. The page picks one model and renders <model.Component .../>.
 * ─────────────────────────────────────────────────────────────────────── */
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Trail, Html } from '@react-three/drei'
import * as THREE from 'three'

const NV = '#76b900'
export const JOINT_COLORS = ['#76b900', '#00d4ff', '#a855f7', '#f59e0b', '#ef4444', '#10b981', '#f97316']

const SHELL = { color: '#e9edf2', metalness: 0.55, roughness: 0.32 }
const HOUSING = { color: '#222a35', metalness: 0.9, roughness: 0.28 }
const DARK = { color: '#11161f', metalness: 0.7, roughness: 0.4 }
const ACCENT = { color: NV, emissive: NV, emissiveIntensity: 0.45, metalness: 0.4, roughness: 0.4 }

export interface ModelProps {
  joints: number[]
  phase: number
  playing: boolean
  speed: number
  showLabels?: boolean
  eeRef?: React.RefObject<THREE.Mesh>
}

export interface RobotModel {
  id: string
  name: string
  category: string
  dof: number
  desc: string
  dataDriven: boolean
  target: [number, number, number]   // OrbitControls target
  camera: [number, number, number]
  Component: React.FC<ModelProps>
}

function JointLabel({ text, color, show }: { text: string; color: string; show?: boolean }) {
  if (!show) return null
  return (
    <Html position={[0.14, 0, 0]} center distanceFactor={7} style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
      <div className="text-[10px] font-black px-1 rounded leading-none py-0.5" style={{ color: '#04060a', background: color }}>{text}</div>
    </Html>
  )
}

/* reads the EE marker world position each frame (throttled) for the readout */
export function EETracker({ targetRef, onPos }: {
  targetRef: React.RefObject<THREE.Mesh>; onPos: (p: [number, number, number]) => void
}) {
  const v = useRef(new THREE.Vector3())
  const last = useRef(0)
  useFrame(({ clock }) => {
    if (!targetRef.current) return
    const t = clock.getElapsedTime()
    if (t - last.current < 0.2) return
    last.current = t
    targetRef.current.getWorldPosition(v.current)
    onPos([v.current.x, v.current.y, v.current.z])
  })
  return null
}

/* ── 7-DOF manipulator arm (driven by the real joint_state trajectory) ── */
const LINK_LEN = [0.55, 0.6, 0.5, 0.45, 0.4, 0.32, 0.26]
const AXES: ('x' | 'y' | 'z')[] = ['y', 'z', 'y', 'z', 'y', 'z', 'y']
const GAIN = 1.4

function Knuckle({ axis }: { axis: 'x' | 'y' | 'z' }) {
  const rot: [number, number, number] = axis === 'y' ? [0, 0, 0] : axis === 'x' ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]
  return (
    <group rotation={rot}>
      <mesh castShadow receiveShadow><cylinderGeometry args={[0.095, 0.095, 0.17, 28]} /><meshStandardMaterial {...HOUSING} /></mesh>
      <mesh castShadow><cylinderGeometry args={[0.1, 0.1, 0.04, 28]} /><meshStandardMaterial {...ACCENT} /></mesh>
    </group>
  )
}

function ArmChain({ angles, eeRef, showLabels, i = 0 }: { angles: number[]; eeRef?: React.RefObject<THREE.Mesh>; showLabels?: boolean; i?: number }) {
  if (i >= LINK_LEN.length) {
    return (
      <group>
        <mesh castShadow><cylinderGeometry args={[0.07, 0.07, 0.05, 24]} /><meshStandardMaterial {...HOUSING} /></mesh>
        <mesh position={[0.055, 0.13, 0]} rotation={[0, 0, -0.12]} castShadow><boxGeometry args={[0.022, 0.13, 0.06]} /><meshStandardMaterial color="#cfd6df" metalness={0.7} roughness={0.3} /></mesh>
        <mesh position={[-0.055, 0.13, 0]} rotation={[0, 0, 0.12]} castShadow><boxGeometry args={[0.022, 0.13, 0.06]} /><meshStandardMaterial color="#cfd6df" metalness={0.7} roughness={0.3} /></mesh>
        <Trail width={2.2} length={5} color={'#a3e635'} attenuation={(t) => t * t} decay={1.2}>
          <mesh ref={eeRef} position={[0, 0.185, 0]}><sphereGeometry args={[0.03, 14, 14]} /><meshBasicMaterial color="#c4f06b" /></mesh>
        </Trail>
        <group position={[0, 0.2, 0]}><JointLabel text="EE" color="#c4f06b" show={showLabels} /></group>
      </group>
    )
  }
  const a = (angles[i] ?? 0) * GAIN
  const rot: [number, number, number] = AXES[i] === 'x' ? [a, 0, 0] : AXES[i] === 'y' ? [0, a, 0] : [0, 0, a]
  const len = LINK_LEN[i]
  return (
    <group rotation={rot}>
      <Knuckle axis={AXES[i]} />
      <JointLabel text={`J${i}`} color={JOINT_COLORS[i]} show={showLabels} />
      <mesh position={[0, len / 2, 0]} castShadow receiveShadow><cylinderGeometry args={[0.052, 0.062, len, 24]} /><meshStandardMaterial {...SHELL} /></mesh>
      <group position={[0, len, 0]}>
        <ArmChain angles={angles} eeRef={eeRef} showLabels={showLabels} i={i + 1} />
      </group>
    </group>
  )
}

const ArmModel: React.FC<ModelProps> = ({ joints, eeRef, showLabels }) => (
  <group>
    <mesh position={[0, 0.03, 0]} receiveShadow castShadow><cylinderGeometry args={[0.34, 0.4, 0.06, 40]} /><meshStandardMaterial {...DARK} /></mesh>
    <mesh position={[0, 0.1, 0]} receiveShadow castShadow><cylinderGeometry args={[0.26, 0.3, 0.1, 40]} /><meshStandardMaterial {...HOUSING} /></mesh>
    <mesh position={[0, 0.16, 0]} castShadow><cylinderGeometry args={[0.27, 0.27, 0.018, 40]} /><meshStandardMaterial {...ACCENT} /></mesh>
    <group position={[0, 0.17, 0]}><ArmChain angles={joints} eeRef={eeRef} showLabels={showLabels} /></group>
  </group>
)

/* ── helpers for procedural models ── */
function useGait() {
  const tRef = useRef(0)
  return tRef
}
function Capsuleish({ args, ...p }: any) {
  return <mesh castShadow {...p}><cylinderGeometry args={args} /><meshStandardMaterial {...SHELL} /></mesh>
}

/* ── Quadruped (ANYmal / Spot style) — procedural trot ── */
const QuadrupedModel: React.FC<ModelProps> = ({ playing, speed }) => {
  const t = useGait()
  const hips = useRef<(THREE.Group | null)[]>([])
  const knees = useRef<(THREE.Group | null)[]>([])
  const body = useRef<THREE.Group>(null!)
  // leg layout: [frontL, frontR, backL, backR]
  const pos: [number, number, number][] = [[0.28, 0, 0.16], [0.28, 0, -0.16], [-0.28, 0, 0.16], [-0.28, 0, -0.16]]
  useFrame((_, dt) => {
    if (playing) t.current += dt * speed * 4
    const tt = t.current
    hips.current.forEach((g, i) => {
      if (!g) return
      const phase = (i === 0 || i === 3) ? 0 : Math.PI // diagonal pairs
      g.rotation.z = Math.sin(tt + phase) * 0.35
    })
    knees.current.forEach((g, i) => {
      if (!g) return
      const phase = (i === 0 || i === 3) ? 0 : Math.PI
      g.rotation.z = -0.5 + Math.max(0, Math.sin(tt + phase + 0.6)) * 0.5
    })
    if (body.current) { body.current.position.y = 0.46 + Math.sin(tt * 2) * 0.012; body.current.rotation.z = Math.sin(tt) * 0.02 }
  })
  return (
    <group>
      <group ref={body} position={[0, 0.46, 0]}>
        {/* torso */}
        <mesh castShadow receiveShadow><boxGeometry args={[0.66, 0.16, 0.3]} /><meshStandardMaterial {...HOUSING} /></mesh>
        <mesh position={[0, 0.085, 0]} castShadow><boxGeometry args={[0.5, 0.03, 0.24]} /><meshStandardMaterial {...ACCENT} /></mesh>
        {/* head */}
        <mesh position={[0.37, 0.02, 0]} castShadow><boxGeometry args={[0.12, 0.1, 0.18]} /><meshStandardMaterial {...DARK} /></mesh>
        <mesh position={[0.43, 0.04, 0.06]}><sphereGeometry args={[0.022, 12, 12]} /><meshStandardMaterial color={NV} emissive={NV} emissiveIntensity={0.8} /></mesh>
        <mesh position={[0.43, 0.04, -0.06]}><sphereGeometry args={[0.022, 12, 12]} /><meshStandardMaterial color={NV} emissive={NV} emissiveIntensity={0.8} /></mesh>
        {/* legs */}
        {pos.map((p, i) => (
          <group key={i} position={p}>
            <group ref={el => (hips.current[i] = el)}>
              <Capsuleish args={[0.035, 0.035, 0.26, 12]} position={[0, -0.13, 0]} />
              <group ref={el => (knees.current[i] = el)} position={[0, -0.26, 0]}>
                <mesh position={[0, -0.13, 0]} castShadow><cylinderGeometry args={[0.028, 0.022, 0.26, 12]} /><meshStandardMaterial {...DARK} /></mesh>
                <mesh position={[0, -0.27, 0]} castShadow><sphereGeometry args={[0.035, 14, 14]} /><meshStandardMaterial color="#0c1018" metalness={0.6} roughness={0.6} /></mesh>
              </group>
            </group>
          </group>
        ))}
      </group>
    </group>
  )
}

/* ── Humanoid biped (H1 style) — procedural walk ── */
const HumanoidModel: React.FC<ModelProps> = ({ playing, speed }) => {
  const t = useGait()
  const legL = useRef<THREE.Group>(null!), legR = useRef<THREE.Group>(null!)
  const armL = useRef<THREE.Group>(null!), armR = useRef<THREE.Group>(null!)
  const root = useRef<THREE.Group>(null!)
  useFrame((_, dt) => {
    if (playing) t.current += dt * speed * 3.2
    const tt = t.current
    if (legL.current) legL.current.rotation.x = Math.sin(tt) * 0.5
    if (legR.current) legR.current.rotation.x = Math.sin(tt + Math.PI) * 0.5
    if (armL.current) armL.current.rotation.x = Math.sin(tt + Math.PI) * 0.45
    if (armR.current) armR.current.rotation.x = Math.sin(tt) * 0.45
    if (root.current) root.current.position.y = 0.92 + Math.abs(Math.sin(tt)) * 0.03
  })
  const limb = (len: number, r = 0.05, mat: any = SHELL) => (
    <mesh position={[0, -len / 2, 0]} castShadow><cylinderGeometry args={[r, r * 0.85, len, 16]} /><meshStandardMaterial {...mat} /></mesh>
  )
  return (
    <group ref={root} position={[0, 0.92, 0]}>
      {/* pelvis + torso + head */}
      <mesh castShadow><boxGeometry args={[0.26, 0.14, 0.16]} /><meshStandardMaterial {...HOUSING} /></mesh>
      <mesh position={[0, 0.26, 0]} castShadow receiveShadow><boxGeometry args={[0.3, 0.36, 0.18]} /><meshStandardMaterial {...SHELL} /></mesh>
      <mesh position={[0, 0.3, 0.095]} castShadow><boxGeometry args={[0.18, 0.18, 0.02]} /><meshStandardMaterial {...ACCENT} /></mesh>
      <mesh position={[0, 0.56, 0]} castShadow><boxGeometry args={[0.16, 0.16, 0.16]} /><meshStandardMaterial {...DARK} /></mesh>
      <mesh position={[0, 0.57, 0.085]}><boxGeometry args={[0.1, 0.03, 0.02]} /><meshStandardMaterial color={NV} emissive={NV} emissiveIntensity={0.8} /></mesh>
      {/* arms */}
      <group ref={armL} position={[0.19, 0.4, 0]}>{limb(0.34)}<group position={[0, -0.34, 0]}>{limb(0.3, 0.04, DARK)}</group></group>
      <group ref={armR} position={[-0.19, 0.4, 0]}>{limb(0.34)}<group position={[0, -0.34, 0]}>{limb(0.3, 0.04, DARK)}</group></group>
      {/* legs */}
      <group ref={legL} position={[0.08, -0.07, 0]}>{limb(0.4, 0.06)}<group position={[0, -0.4, 0]}>{limb(0.4, 0.05, DARK)}<mesh position={[0.03, -0.42, 0]} castShadow><boxGeometry args={[0.14, 0.05, 0.1]} /><meshStandardMaterial {...HOUSING} /></mesh></group></group>
      <group ref={legR} position={[-0.08, -0.07, 0]}>{limb(0.4, 0.06)}<group position={[0, -0.4, 0]}>{limb(0.4, 0.05, DARK)}<mesh position={[0.03, -0.42, 0]} castShadow><boxGeometry args={[0.14, 0.05, 0.1]} /><meshStandardMaterial {...HOUSING} /></mesh></group></group>
    </group>
  )
}

/* ── Quadcopter — spinning rotors + hover bob ── */
const QuadcopterModel: React.FC<ModelProps> = ({ playing, speed }) => {
  const rotors = useRef<(THREE.Group | null)[]>([])
  const root = useRef<THREE.Group>(null!)
  const t = useGait()
  const arms: [number, number][] = [[0.26, 0.26], [0.26, -0.26], [-0.26, 0.26], [-0.26, -0.26]]
  useFrame((_, dt) => {
    if (playing) t.current += dt * speed
    rotors.current.forEach((g, i) => { if (g) g.rotation.y += (playing ? 1 : 0) * (i % 2 ? -1 : 1) * dt * speed * 40 })
    if (root.current) { root.current.position.y = 1.0 + Math.sin(t.current * 1.5) * 0.05; root.current.rotation.z = Math.sin(t.current) * 0.04 }
  })
  return (
    <group ref={root} position={[0, 1.0, 0]}>
      <mesh castShadow><boxGeometry args={[0.2, 0.07, 0.2]} /><meshStandardMaterial {...HOUSING} /></mesh>
      <mesh position={[0, 0.045, 0]}><boxGeometry args={[0.12, 0.02, 0.12]} /><meshStandardMaterial {...ACCENT} /></mesh>
      {arms.map(([x, z], i) => (
        <group key={i}>
          <mesh position={[x / 2, 0, z / 2]} rotation={[0, -Math.atan2(z, x), 0]} castShadow><boxGeometry args={[Math.hypot(x, z), 0.025, 0.03]} /><meshStandardMaterial {...DARK} /></mesh>
          <mesh position={[x, -0.01, z]} castShadow><cylinderGeometry args={[0.04, 0.04, 0.05, 12]} /><meshStandardMaterial {...HOUSING} /></mesh>
          <group ref={el => (rotors.current[i] = el)} position={[x, 0.03, z]}>
            <mesh><boxGeometry args={[0.34, 0.006, 0.03]} /><meshStandardMaterial color="#cfd6df" metalness={0.3} roughness={0.5} transparent opacity={0.55} /></mesh>
            <mesh rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[0.34, 0.006, 0.03]} /><meshStandardMaterial color="#cfd6df" metalness={0.3} roughness={0.5} transparent opacity={0.55} /></mesh>
          </group>
        </group>
      ))}
      {/* landing legs */}
      {arms.map(([x, z], i) => (
        <mesh key={`l${i}`} position={[x * 0.6, -0.12, z * 0.6]} castShadow><cylinderGeometry args={[0.008, 0.008, 0.16, 8]} /><meshStandardMaterial {...DARK} /></mesh>
      ))}
    </group>
  )
}

/* ── Model registry — add new robots here ── */
export const MODELS: RobotModel[] = [
  { id: 'arm', name: '7-DOF Manipulator', category: 'Manipulator', dof: 7, dataDriven: true,
    desc: '학습된 정책 궤적(joint_state)으로 구동되는 7축 산업용 암 + 그리퍼.',
    target: [0, 1.15, 0], camera: [2.8, 2.0, 3.2], Component: ArmModel },
  { id: 'quadruped', name: 'Quadruped', category: 'Legged', dof: 12, dataDriven: false,
    desc: 'ANYmal/Spot 스타일 4족 보행 로봇. 대각 트로트 보행을 절차적으로 재생.',
    target: [0, 0.4, 0], camera: [1.6, 1.1, 1.9], Component: QuadrupedModel },
  { id: 'humanoid', name: 'Humanoid (H1)', category: 'Humanoid', dof: 19, dataDriven: false,
    desc: 'H1 스타일 이족 휴머노이드. 팔·다리 스윙 보행을 절차적으로 재생.',
    target: [0, 0.9, 0], camera: [1.8, 1.4, 2.2], Component: HumanoidModel },
  { id: 'quadcopter', name: 'Quadcopter', category: 'Aerial', dof: 4, dataDriven: false,
    desc: '4-로터 드론. 로터 회전과 호버링 보브를 절차적으로 재생.',
    target: [0, 1.0, 0], camera: [1.4, 1.3, 1.7], Component: QuadcopterModel },
]
