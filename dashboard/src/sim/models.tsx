/* ───────────────────────────────────────────────────────────────────────
 *  Robot model library for the Simulation page (Isaac Lab "showroom" style).
 *
 *  Add a robot: append one RobotModel entry to MODELS. Give it metadata and a
 *  Component that renders a three.js <group>.
 *
 *  Driving a model from REAL policy data (joint_state):
 *    1) Export that robot's rollout to outputs/dataset/<name>.hdf5
 *       (datasets: joint_state[T, dof], optional action/reward/rgb).
 *    2) Set `dataset: '<name>'` and `dataDriven: true` on the model.
 *  The page then fetches that trajectory and passes `joints` each frame; the
 *  component maps `joints[i]` onto its DOFs (see makeQuadruped/makeHumanoid).
 *  Procedural models (no dataset) animate from a clock instead.
 *
 *  Unreal/Unity: the same joint_state[i] -> DOF mapping is the rig contract —
 *  bind each joint index to the engine's bone/joint and stream the array.
 * ─────────────────────────────────────────────────────────────────────── */
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Trail, Html, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'

const NV = '#76b900'
export const JOINT_COLORS = ['#76b900', '#00d4ff', '#a855f7', '#f59e0b', '#ef4444', '#10b981', '#f97316']

const SHELL = { color: '#e9edf2', metalness: 0.55, roughness: 0.32 }
const HOUSING = { color: '#222a35', metalness: 0.9, roughness: 0.28 }
const DARK = { color: '#11161f', metalness: 0.7, roughness: 0.4 }
const mat = (color: string, metalness = 0.6, roughness = 0.4) => ({ color, metalness, roughness })
const accentMat = (c: string) => ({ color: c, emissive: c, emissiveIntensity: 0.45, metalness: 0.4, roughness: 0.4 })

export interface ModelProps {
  joints: number[]
  phase: number
  playing: boolean
  speed: number
  dataDriven?: boolean
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
  dataset?: string                 // outputs/dataset/<dataset>.hdf5
  ee?: boolean                     // has an end-effector (show EE readout/trail)
  target: [number, number, number]
  camera: [number, number, number]
  Component: React.FC<ModelProps>
}

function JointLabel({ text, color, show }: { text: string; color: string; show?: boolean }) {
  if (!show) return null
  return (
    <Html position={[0.2, 0, 0]} center distanceFactor={7} style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
      <div className="text-[10px] font-black px-1 rounded leading-none py-0.5" style={{ color: '#04060a', background: color }}>{text}</div>
    </Html>
  )
}

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

/* ── 7-DOF manipulator arm (driven by the real joint_state trajectory) ──
 *  Styled after the Franka Research 3: satin-white rounded covers, dark-grey
 *  joint caps, offset elbow, a white Hand with dark fingers and a status light
 *  ring on the base. The joint contract (AXES/GAIN/LINK_LEN) is unchanged. */
const LINK_LEN = [0.55, 0.6, 0.5, 0.45, 0.4, 0.32, 0.26]
const AXES: ('x' | 'y' | 'z')[] = ['y', 'z', 'y', 'z', 'y', 'z', 'y']
const GAIN = 1.4
const LINK_R = [0.1, 0.095, 0.088, 0.082, 0.075, 0.068, 0.06]   // cover radius per link
const ELBOW_X = [0, 0, 0.1, -0.1, 0, 0.09, 0]                   // Panda-style lateral offsets

const FR_WHITE = { color: '#f3f4f6', metalness: 0.04, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35 }
const FR_GREY = { color: '#2b2f36', metalness: 0.2, roughness: 0.55 }
const FR_SEAM = { color: '#121418', metalness: 0.1, roughness: 0.7 }

function FrankaJoint({ axis, r }: { axis: 'x' | 'y' | 'z'; r: number }) {
  // Hinge joints (z) read as a sideways drum with dark caps — the Franka signature.
  // Roll joints (y) read as a collar with a thin dark seam.
  if (axis === 'y') {
    return (
      <group>
        <mesh castShadow receiveShadow><cylinderGeometry args={[r * 1.12, r * 1.12, r * 1.6, 40]} /><meshPhysicalMaterial {...FR_WHITE} /></mesh>
        <mesh><cylinderGeometry args={[r * 1.135, r * 1.135, r * 0.12, 40]} /><meshStandardMaterial {...FR_SEAM} /></mesh>
      </group>
    )
  }
  const rot: [number, number, number] = axis === 'x' ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]
  const w = r * 2.3
  return (
    <group rotation={rot}>
      <mesh castShadow receiveShadow><cylinderGeometry args={[r * 1.18, r * 1.18, w, 40]} /><meshPhysicalMaterial {...FR_WHITE} /></mesh>
      {[1, -1].map(s => (
        <group key={s} position={[0, (s * w) / 2, 0]}>
          <mesh castShadow><cylinderGeometry args={[r * 1.05, r * 1.05, 0.02, 40]} /><meshStandardMaterial {...FR_GREY} /></mesh>
          <mesh position={[0, s * 0.011, 0]}><cylinderGeometry args={[r * 0.45, r * 0.45, 0.004, 32]} /><meshStandardMaterial {...FR_SEAM} /></mesh>
        </group>
      ))}
    </group>
  )
}

function FrankaHand({ eeRef, showLabels }: { eeRef?: React.RefObject<THREE.Mesh>; showLabels?: boolean }) {
  return (
    <group>
      {/* flange + pilot ring */}
      <mesh castShadow><cylinderGeometry args={[0.065, 0.065, 0.04, 32]} /><meshStandardMaterial {...FR_GREY} /></mesh>
      <mesh position={[0, 0.022, 0]}><torusGeometry args={[0.062, 0.006, 10, 40]} /><meshStandardMaterial color="#9ca3af" metalness={0.6} roughness={0.3} /></mesh>
      {/* hand body */}
      <RoundedBox args={[0.24, 0.1, 0.1]} radius={0.035} smoothness={4} position={[0, 0.08, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial {...FR_WHITE} />
      </RoundedBox>
      <mesh position={[0, 0.131, 0]}><boxGeometry args={[0.17, 0.004, 0.06]} /><meshStandardMaterial {...FR_SEAM} /></mesh>
      {/* fingers with grip pads */}
      {[1, -1].map(s => (
        <group key={s} position={[s * 0.04, 0.19, 0]}>
          <RoundedBox args={[0.026, 0.11, 0.045]} radius={0.008} smoothness={3} castShadow><meshStandardMaterial {...FR_GREY} /></RoundedBox>
          <mesh position={[-s * 0.0135, 0.025, 0]}><boxGeometry args={[0.003, 0.05, 0.036]} /><meshStandardMaterial color="#4b5563" roughness={0.9} /></mesh>
        </group>
      ))}
      <Trail width={2.2} length={5} color={'#a3e635'} attenuation={(t) => t * t} decay={1.2}>
        <mesh ref={eeRef} position={[0, 0.235, 0]}><sphereGeometry args={[0.022, 14, 14]} /><meshBasicMaterial color="#c4f06b" /></mesh>
      </Trail>
      <group position={[0, 0.25, 0]}><JointLabel text="EE" color="#c4f06b" show={showLabels} /></group>
    </group>
  )
}

function ArmChain({ angles, eeRef, showLabels, i = 0 }: { angles: number[]; eeRef?: React.RefObject<THREE.Mesh>; showLabels?: boolean; i?: number }) {
  if (i >= LINK_LEN.length) return <FrankaHand eeRef={eeRef} showLabels={showLabels} />
  const a = (angles[i] ?? 0) * GAIN
  const rot: [number, number, number] = AXES[i] === 'x' ? [a, 0, 0] : AXES[i] === 'y' ? [0, a, 0] : [0, 0, a]
  const len = LINK_LEN[i]
  const r = LINK_R[i]
  const off = ELBOW_X[i]
  return (
    <group rotation={rot}>
      <FrankaJoint axis={AXES[i]} r={r} />
      <JointLabel text={`J${i}`} color={JOINT_COLORS[i]} show={showLabels} />
      {/* rounded link cover */}
      <mesh position={[0, len / 2, 0]} castShadow receiveShadow>
        <capsuleGeometry args={[r * 0.95, Math.max(len - r * 1.9, 0.01), 8, 32]} />
        <meshPhysicalMaterial {...FR_WHITE} />
      </mesh>
      {/* lateral elbow offset */}
      {off !== 0 && (
        <mesh position={[off / 2, len, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
          <capsuleGeometry args={[r * 0.95, Math.abs(off), 8, 32]} />
          <meshPhysicalMaterial {...FR_WHITE} />
        </mesh>
      )}
      <group position={[off, len, 0]}><ArmChain angles={angles} eeRef={eeRef} showLabels={showLabels} i={i + 1} /></group>
    </group>
  )
}

const ArmModel: React.FC<ModelProps> = ({ joints, eeRef, showLabels, playing }) => {
  // Status light: white = idle, green = trajectory playing.
  const led = playing ? '#4ade80' : '#e5f0ff'
  return (
    <group>
      {/* mounting plate */}
      <RoundedBox args={[0.62, 0.04, 0.72]} radius={0.015} smoothness={3} position={[0, 0.02, -0.04]} receiveShadow castShadow>
        <meshStandardMaterial {...FR_GREY} />
      </RoundedBox>
      {/* base foot */}
      <RoundedBox args={[0.46, 0.14, 0.58]} radius={0.06} smoothness={4} position={[0, 0.11, -0.05]} receiveShadow castShadow>
        <meshPhysicalMaterial {...FR_WHITE} />
      </RoundedBox>
      <mesh position={[0, 0.11, -0.345]}><boxGeometry args={[0.16, 0.07, 0.01]} /><meshStandardMaterial {...FR_SEAM} /></mesh>
      {/* status light ring */}
      <mesh position={[0, 0.185, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.135, 0.008, 12, 64]} />
        <meshStandardMaterial color={led} emissive={led} emissiveIntensity={1.2} toneMapped={false} />
      </mesh>
      <group position={[0, 0.25, 0]}><ArmChain angles={joints} eeRef={eeRef} showLabels={showLabels} /></group>
    </group>
  )
}

interface RigOpts { body: string; accent: string; eye?: string }

/* ── Quadruped factory (ANYmal / Spot style) ── */
function makeQuadruped({ body, accent, eye = NV }: RigOpts): React.FC<ModelProps> {
  return function Quadruped({ joints, playing, speed, dataDriven }) {
    const jref = useRef<number[]>([]); jref.current = joints
    const hips = useRef<(THREE.Group | null)[]>([])
    const knees = useRef<(THREE.Group | null)[]>([])
    const root = useRef<THREE.Group>(null!)
    const t = useRef(0)
    const pos: [number, number, number][] = [[0.28, 0, 0.16], [0.28, 0, -0.16], [-0.28, 0, 0.16], [-0.28, 0, -0.16]]
    useFrame((_, dt) => {
      if (dataDriven) {
        // direct joint_state -> rotation: joints[0..3]=hip(HFE), [4..7]=knee(KFE)
        const j = jref.current
        hips.current.forEach((g, i) => g && (g.rotation.z = (j[i] ?? 0)))
        knees.current.forEach((g, i) => g && (g.rotation.z = (j[i + 4] ?? 0)))
      } else {
        if (playing) t.current += dt * speed * 4
        const tt = t.current
        hips.current.forEach((g, i) => g && (g.rotation.z = Math.sin(tt + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.35))
        knees.current.forEach((g, i) => g && (g.rotation.z = -0.5 + Math.max(0, Math.sin(tt + (i === 0 || i === 3 ? 0 : Math.PI) + 0.6)) * 0.5))
        if (root.current) { root.current.position.y = 0.46 + Math.sin(tt * 2) * 0.012; root.current.rotation.z = Math.sin(tt) * 0.02 }
      }
    })
    return (
      <group ref={root} position={[0, 0.46, 0]}>
        <mesh castShadow receiveShadow><boxGeometry args={[0.66, 0.16, 0.3]} /><meshStandardMaterial {...mat(body, 0.6, 0.4)} /></mesh>
        <mesh position={[0, 0.085, 0]} castShadow><boxGeometry args={[0.5, 0.03, 0.24]} /><meshStandardMaterial {...accentMat(accent)} /></mesh>
        <mesh position={[0.37, 0.02, 0]} castShadow><boxGeometry args={[0.12, 0.1, 0.18]} /><meshStandardMaterial {...DARK} /></mesh>
        {[0.06, -0.06].map(z => <mesh key={z} position={[0.43, 0.04, z]}><sphereGeometry args={[0.022, 12, 12]} /><meshStandardMaterial color={eye} emissive={eye} emissiveIntensity={0.8} /></mesh>)}
        {pos.map((p, i) => (
          <group key={i} position={p}>
            <group ref={el => (hips.current[i] = el)}>
              <mesh position={[0, -0.13, 0]} castShadow><cylinderGeometry args={[0.035, 0.035, 0.26, 12]} /><meshStandardMaterial {...mat(body, 0.6, 0.4)} /></mesh>
              <group ref={el => (knees.current[i] = el)} position={[0, -0.26, 0]}>
                <mesh position={[0, -0.13, 0]} castShadow><cylinderGeometry args={[0.028, 0.022, 0.26, 12]} /><meshStandardMaterial {...DARK} /></mesh>
                <mesh position={[0, -0.27, 0]} castShadow><sphereGeometry args={[0.035, 14, 14]} /><meshStandardMaterial color="#0c1018" metalness={0.6} roughness={0.6} /></mesh>
              </group>
            </group>
          </group>
        ))}
      </group>
    )
  }
}

/* ── Humanoid biped factory (H1 / G1 style) ── */
function makeHumanoid({ body, accent, eye = NV }: RigOpts): React.FC<ModelProps> {
  return function Humanoid({ joints, playing, speed, dataDriven }) {
    const jref = useRef<number[]>([]); jref.current = joints
    const legL = useRef<THREE.Group>(null!), legR = useRef<THREE.Group>(null!)
    const armL = useRef<THREE.Group>(null!), armR = useRef<THREE.Group>(null!)
    const root = useRef<THREE.Group>(null!)
    const t = useRef(0)
    useFrame((_, dt) => {
      if (dataDriven) {
        const j = jref.current
        if (legL.current) legL.current.rotation.x = j[0] ?? 0
        if (legR.current) legR.current.rotation.x = j[1] ?? 0
        if (armL.current) armL.current.rotation.x = j[2] ?? 0
        if (armR.current) armR.current.rotation.x = j[3] ?? 0
      } else {
        if (playing) t.current += dt * speed * 3.2
        const tt = t.current
        if (legL.current) legL.current.rotation.x = Math.sin(tt) * 0.5
        if (legR.current) legR.current.rotation.x = Math.sin(tt + Math.PI) * 0.5
        if (armL.current) armL.current.rotation.x = Math.sin(tt + Math.PI) * 0.45
        if (armR.current) armR.current.rotation.x = Math.sin(tt) * 0.45
        if (root.current) root.current.position.y = 0.92 + Math.abs(Math.sin(tt)) * 0.03
      }
    })
    const limb = (len: number, r = 0.05, m: any = SHELL) => <mesh position={[0, -len / 2, 0]} castShadow><cylinderGeometry args={[r, r * 0.85, len, 16]} /><meshStandardMaterial {...m} /></mesh>
    return (
      <group ref={root} position={[0, 0.92, 0]}>
        <mesh castShadow><boxGeometry args={[0.26, 0.14, 0.16]} /><meshStandardMaterial {...HOUSING} /></mesh>
        <mesh position={[0, 0.26, 0]} castShadow receiveShadow><boxGeometry args={[0.3, 0.36, 0.18]} /><meshStandardMaterial {...mat(body, 0.55, 0.35)} /></mesh>
        <mesh position={[0, 0.3, 0.095]} castShadow><boxGeometry args={[0.18, 0.18, 0.02]} /><meshStandardMaterial {...accentMat(accent)} /></mesh>
        <mesh position={[0, 0.56, 0]} castShadow><boxGeometry args={[0.16, 0.16, 0.16]} /><meshStandardMaterial {...DARK} /></mesh>
        <mesh position={[0, 0.57, 0.085]}><boxGeometry args={[0.1, 0.03, 0.02]} /><meshStandardMaterial color={eye} emissive={eye} emissiveIntensity={0.8} /></mesh>
        <group ref={armL} position={[0.19, 0.4, 0]}>{limb(0.34, 0.05, mat(body, 0.55, 0.35))}<group position={[0, -0.34, 0]}>{limb(0.3, 0.04, DARK)}</group></group>
        <group ref={armR} position={[-0.19, 0.4, 0]}>{limb(0.34, 0.05, mat(body, 0.55, 0.35))}<group position={[0, -0.34, 0]}>{limb(0.3, 0.04, DARK)}</group></group>
        <group ref={legL} position={[0.08, -0.07, 0]}>{limb(0.4, 0.06, mat(body, 0.55, 0.35))}<group position={[0, -0.4, 0]}>{limb(0.4, 0.05, DARK)}<mesh position={[0.03, -0.42, 0]} castShadow><boxGeometry args={[0.14, 0.05, 0.1]} /><meshStandardMaterial {...HOUSING} /></mesh></group></group>
        <group ref={legR} position={[-0.08, -0.07, 0]}>{limb(0.4, 0.06, mat(body, 0.55, 0.35))}<group position={[0, -0.4, 0]}>{limb(0.4, 0.05, DARK)}<mesh position={[0.03, -0.42, 0]} castShadow><boxGeometry args={[0.14, 0.05, 0.1]} /><meshStandardMaterial {...HOUSING} /></mesh></group></group>
      </group>
    )
  }
}

/* ── Quadcopter factory (Crazyflie style) ── */
function makeQuadcopter({ body, accent }: RigOpts): React.FC<ModelProps> {
  return function Quadcopter({ joints, playing, speed, dataDriven }) {
    const jref = useRef<number[]>([]); jref.current = joints
    const rotors = useRef<(THREE.Group | null)[]>([])
    const root = useRef<THREE.Group>(null!)
    const t = useRef(0)
    const arms: [number, number][] = [[0.26, 0.26], [0.26, -0.26], [-0.26, 0.26], [-0.26, -0.26]]
    useFrame((_, dt) => {
      rotors.current.forEach((g, i) => g && (g.rotation.y += (playing ? 1 : 0) * (i % 2 ? -1 : 1) * dt * speed * 40))
      if (dataDriven) {
        const j = jref.current
        if (root.current) { root.current.rotation.x = j[0] ?? 0; root.current.rotation.z = j[1] ?? 0 }
      } else {
        if (playing) t.current += dt * speed
        if (root.current) { root.current.position.y = 1.0 + Math.sin(t.current * 1.5) * 0.05; root.current.rotation.z = Math.sin(t.current) * 0.04 }
      }
    })
    return (
      <group ref={root} position={[0, 1.0, 0]}>
        <mesh castShadow><boxGeometry args={[0.2, 0.07, 0.2]} /><meshStandardMaterial {...mat(body, 0.8, 0.3)} /></mesh>
        <mesh position={[0, 0.045, 0]}><boxGeometry args={[0.12, 0.02, 0.12]} /><meshStandardMaterial {...accentMat(accent)} /></mesh>
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
        {arms.map(([x, z], i) => <mesh key={`l${i}`} position={[x * 0.6, -0.12, z * 0.6]} castShadow><cylinderGeometry args={[0.008, 0.008, 0.16, 8]} /><meshStandardMaterial {...DARK} /></mesh>)}
      </group>
    )
  }
}

/* ── Model registry — add robots here ── */
export const MODELS: RobotModel[] = [
  { id: 'arm', name: 'Franka 7-DOF Arm', category: 'Manipulator', dof: 7, dataDriven: true, dataset: 'synthetic_v1', ee: true,
    desc: '학습된 정책 궤적(joint_state)으로 구동되는 7축 산업용 암 + 그리퍼. Isaac Lab `FRANKA_PANDA_CFG`.',
    target: [0, 1.75, 0], camera: [3.9, 2.7, 4.5], Component: ArmModel },

  { id: 'anymal', name: 'ANYmal-D', category: 'Quadruped', dof: 12, dataDriven: true, dataset: 'anymal_v1',
    desc: 'ANYbotics 4족 보행 로봇. Isaac Lab `ANYMAL_D_CFG`. 궤적(joint_state[12])으로 보행 구동.',
    target: [0, 0.4, 0], camera: [1.7, 1.1, 2.0], Component: makeQuadruped({ body: '#2a3340', accent: NV, eye: NV }) },

  { id: 'spot', name: 'Boston Dynamics Spot', category: 'Quadruped', dof: 12, dataDriven: true, dataset: 'spot_v1',
    desc: 'Boston Dynamics Spot. Isaac Lab `SPOT_CFG`. 궤적(joint_state[12])으로 대각 트로트 보행.',
    target: [0, 0.4, 0], camera: [1.7, 1.1, 2.0], Component: makeQuadruped({ body: '#caa915', accent: '#1c1c1c', eye: '#ffcc33' }) },

  { id: 'h1', name: 'Unitree H1', category: 'Humanoid', dof: 19, dataDriven: true, dataset: 'h1_v1',
    desc: 'Unitree H1 이족 휴머노이드. Isaac Lab `H1_CFG`. 궤적(joint_state[19])으로 보행 구동.',
    target: [0, 0.9, 0], camera: [1.8, 1.4, 2.2], Component: makeHumanoid({ body: '#e9edf2', accent: NV, eye: NV }) },

  { id: 'g1', name: 'Unitree G1', category: 'Humanoid', dof: 23, dataDriven: true, dataset: 'g1_v1',
    desc: 'Unitree G1 소형 휴머노이드. Isaac Lab `G1_CFG`. 궤적(joint_state[23])으로 보행 구동.',
    target: [0, 0.9, 0], camera: [1.7, 1.3, 2.1], Component: makeHumanoid({ body: '#2b3442', accent: '#00d4ff', eye: '#00d4ff' }) },

  { id: 'crazyflie', name: 'Crazyflie Quadcopter', category: 'Aerial', dof: 4, dataDriven: true, dataset: 'crazyflie_v1',
    desc: 'Bitcraze Crazyflie 드론. Isaac Lab `CRAZYFLIE_CFG`. 궤적(joint_state[4])으로 자세 + 로터 회전.',
    target: [0, 1.0, 0], camera: [1.4, 1.3, 1.7], Component: makeQuadcopter({ body: '#222a35', accent: NV }) },
]

export const MODEL_ICON: Record<string, string> = { arm: '🦾', anymal: '🐾', spot: '🐕', h1: '🧍', g1: '🤖', crazyflie: '🚁' }

/* shared selection so the Demos gallery can deep-link into a Simulation model */
export const simSelection = { id: 'arm' }
