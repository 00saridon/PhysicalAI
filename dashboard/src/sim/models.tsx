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
 *  component maps `joints[i]` onto its DOFs (see useQuadrupedRig/useHumanoidRig).
 *  Procedural models (no dataset) animate from a clock instead.
 *
 *  Unreal/Unity: the same joint_state[i] -> DOF mapping is the rig contract —
 *  bind each joint index to the engine's bone/joint and stream the array.
 * ─────────────────────────────────────────────────────────────────────── */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Trail, Html, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'

const NV = '#76b900'
export const JOINT_COLORS = ['#76b900', '#00d4ff', '#a855f7', '#f59e0b', '#ef4444', '#10b981', '#f97316']

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

/* ── Quadruped rig (shared by ANYmal / Spot) ──
 *  joint_state contract: joints[0..3] = hip (HFE), joints[4..7] = knee (KFE),
 *  both rotating about z. Without data, a diagonal trot is generated. */
const QUAD_HIPS: [number, number, number][] = [[0.28, 0, 0.16], [0.28, 0, -0.16], [-0.28, 0, 0.16], [-0.28, 0, -0.16]]

function useQuadrupedRig({ joints, playing, speed, dataDriven }: ModelProps) {
  const jref = useRef<number[]>([]); jref.current = joints
  const hips = useRef<(THREE.Group | null)[]>([])
  const knees = useRef<(THREE.Group | null)[]>([])
  const root = useRef<THREE.Group>(null!)
  const t = useRef(0)
  useFrame((_, dt) => {
    if (playing) t.current += dt * speed * 4
    if (dataDriven) {
      const j = jref.current
      hips.current.forEach((g, i) => g && (g.rotation.z = (j[i] ?? 0)))
      knees.current.forEach((g, i) => g && (g.rotation.z = (j[i + 4] ?? 0)))
    } else {
      const tt = t.current
      hips.current.forEach((g, i) => g && (g.rotation.z = Math.sin(tt + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.35))
      knees.current.forEach((g, i) => g && (g.rotation.z = -0.5 + Math.max(0, Math.sin(tt + (i === 0 || i === 3 ? 0 : Math.PI) + 0.6)) * 0.5))
      if (root.current) { root.current.position.y = 0.46 + Math.sin(tt * 2) * 0.012; root.current.rotation.z = Math.sin(tt) * 0.02 }
    }
  })
  return { hips, knees, root, t }
}

/* ── ANYmal-D: red shell over a dark chassis, big grey actuators, pan-tilt
 *  inspection head (zoom / thermal / spotlight), rear lidar and carry handle. ── */
const AN_RED = { color: '#d9302a', metalness: 0.1, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3 }
const AN_DARK = { color: '#2d3036', metalness: 0.35, roughness: 0.5 }
const AN_MID = { color: '#464b53', metalness: 0.3, roughness: 0.45 }
const AN_BLACK = { color: '#121417', metalness: 0.2, roughness: 0.65 }
const AN_GLASS = { color: '#0b0d10', metalness: 0.9, roughness: 0.08 }

function Actuator({ r, len, axis }: { r: number; len: number; axis: 'x' | 'z' }) {
  // Cylindrical drive: dark housing, lighter end cap, bolt circle.
  const rot: [number, number, number] = axis === 'x' ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]
  return (
    <group rotation={rot}>
      <mesh castShadow receiveShadow><cylinderGeometry args={[r, r, len, 32]} /><meshStandardMaterial {...AN_DARK} /></mesh>
      {[1, -1].map(s => (
        <group key={s} position={[0, (s * len) / 2, 0]}>
          <mesh><cylinderGeometry args={[r * 0.86, r * 0.86, 0.008, 32]} /><meshStandardMaterial {...AN_MID} /></mesh>
          <mesh position={[0, s * 0.005, 0]}><torusGeometry args={[r * 0.6, 0.004, 6, 24]} /><meshStandardMaterial {...AN_BLACK} /></mesh>
        </group>
      ))}
    </group>
  )
}

const AnymalModel: React.FC<ModelProps> = (props) => {
  const { hips, knees, root, t } = useQuadrupedRig(props)
  const head = useRef<THREE.Group>(null!)
  const lidar = useRef<THREE.Group>(null!)
  useFrame((_, dt) => {
    // payload pans slowly; lidar spins while playing
    if (head.current) head.current.rotation.y = Math.sin(t.current * 0.25) * 0.5
    if (lidar.current && props.playing) lidar.current.rotation.y += dt * props.speed * 3
  })
  return (
    <group ref={root} position={[0, 0.46, 0]}>
      {/* red upper shell + dark lower chassis */}
      <RoundedBox args={[0.6, 0.15, 0.27]} radius={0.045} smoothness={4} position={[0, 0.035, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial {...AN_RED} />
      </RoundedBox>
      <RoundedBox args={[0.64, 0.08, 0.23]} radius={0.03} smoothness={3} position={[0, -0.06, 0]} castShadow receiveShadow>
        <meshStandardMaterial {...AN_DARK} />
      </RoundedBox>
      {[1, -1].map(s => (
        <mesh key={s} position={[0, -0.02, s * 0.136]}><boxGeometry args={[0.5, 0.012, 0.004]} /><meshStandardMaterial {...AN_BLACK} /></mesh>
      ))}
      {/* front & rear sensor bumpers with depth cameras */}
      {[1, -1].map(s => (
        <group key={s} position={[s * 0.315, 0.0, 0]}>
          <RoundedBox args={[0.05, 0.11, 0.19]} radius={0.015} smoothness={3} castShadow><meshStandardMaterial {...AN_DARK} /></RoundedBox>
          {[0.045, -0.045].map(z => (
            <mesh key={z} position={[s * 0.027, 0.01, z]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.018, 0.018, 0.008, 20]} /><meshStandardMaterial {...AN_GLASS} />
            </mesh>
          ))}
        </group>
      ))}
      {/* pan-tilt inspection payload */}
      <group position={[0.2, 0.11, 0]}>
        <mesh position={[0, 0.03, 0]} castShadow><cylinderGeometry args={[0.03, 0.04, 0.06, 20]} /><meshStandardMaterial {...AN_BLACK} /></mesh>
        <group ref={head} position={[0, 0.13, 0]}>
          <RoundedBox args={[0.13, 0.14, 0.17]} radius={0.02} smoothness={3} castShadow><meshStandardMaterial {...AN_MID} /></RoundedBox>
          <mesh position={[0.066, 0.035, 0.035]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.026, 0.026, 0.006, 24]} /><meshStandardMaterial color="#a8834a" metalness={0.8} roughness={0.25} /></mesh>
          <mesh position={[0.066, 0.035, -0.035]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.02, 0.02, 0.006, 24]} /><meshStandardMaterial color="#fff6dc" emissive="#fff1c4" emissiveIntensity={0.9} toneMapped={false} /></mesh>
          {[0.03, -0.03].map(z => (
            <mesh key={z} position={[0.066, -0.035, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.022, 0.022, 0.008, 24]} /><meshStandardMaterial {...AN_GLASS} /></mesh>
          ))}
        </group>
      </group>
      {/* carry handle */}
      <mesh position={[-0.02, 0.11, 0]}><torusGeometry args={[0.1, 0.011, 10, 32, Math.PI]} /><meshStandardMaterial {...AN_BLACK} /></mesh>
      {/* rear lidar */}
      <group position={[-0.21, 0.11, 0]}>
        <mesh position={[0, 0.012, 0]} castShadow><cylinderGeometry args={[0.058, 0.058, 0.025, 28]} /><meshStandardMaterial {...AN_BLACK} /></mesh>
        <group ref={lidar} position={[0, 0.055, 0]}>
          <mesh><cylinderGeometry args={[0.052, 0.052, 0.06, 28]} /><meshStandardMaterial color="#1d5f7a" metalness={0.9} roughness={0.12} emissive="#0b3a4d" emissiveIntensity={0.4} /></mesh>
        </group>
        <mesh position={[0, 0.095, 0]} castShadow><cylinderGeometry args={[0.055, 0.055, 0.02, 28]} /><meshStandardMaterial {...AN_BLACK} /></mesh>
      </group>
      {/* legs: HAA drive on the body, HFE drive outboard, thigh, KFE drive, shank, foot */}
      {QUAD_HIPS.map((p, i) => {
        const s = Math.sign(p[2])
        return (
          <group key={i} position={p}>
            <group position={[Math.sign(p[0]) * -0.02, 0, 0]}><Actuator r={0.058} len={0.1} axis="x" /></group>
            <group ref={el => (hips.current[i] = el)} position={[0, 0, s * 0.07]}>
              <Actuator r={0.062} len={0.075} axis="z" />
              <RoundedBox args={[0.075, 0.26, 0.055]} radius={0.02} smoothness={3} position={[0, -0.13, 0]} castShadow>
                <meshStandardMaterial {...AN_DARK} />
              </RoundedBox>
              <mesh position={[0, -0.12, s * 0.029]}><boxGeometry args={[0.05, 0.16, 0.004]} /><meshStandardMaterial {...AN_MID} /></mesh>
              <group ref={el => (knees.current[i] = el)} position={[0, -0.26, 0]}>
                <Actuator r={0.048} len={0.07} axis="z" />
                <mesh position={[0, -0.13, 0]} castShadow><cylinderGeometry args={[0.022, 0.018, 0.26, 14]} /><meshStandardMaterial {...AN_BLACK} /></mesh>
                <mesh position={[0, -0.27, 0]} castShadow><sphereGeometry args={[0.036, 18, 18]} /><meshStandardMaterial color="#1a1c20" roughness={0.9} /></mesh>
              </group>
            </group>
          </group>
        )
      })}
    </group>
  )
}

/* ── Spot: long, flat yellow-covered body over a black chassis, top payload
 *  rails, black sensor nose with V-angled stereo camera pairs, side/rear
 *  stereo cameras, yellow upper legs with black joints, shanks and feet. ── */
const SP_YELLOW = { color: '#f2c318', metalness: 0.08, roughness: 0.4, clearcoat: 0.4, clearcoatRoughness: 0.35 }
const SP_BLACK = { color: '#17191c', metalness: 0.25, roughness: 0.55 }
const SP_GREY = { color: '#34383f', metalness: 0.3, roughness: 0.5 }

function StereoPair({ position, rotation }: { position: [number, number, number]; rotation: [number, number, number] }) {
  // Dark plate with two lenses, facing +x in its local frame.
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[0.012, 0.04, 0.085]} radius={0.005} smoothness={2}><meshStandardMaterial {...SP_GREY} /></RoundedBox>
      {[0.025, -0.025].map(z => (
        <mesh key={z} position={[0.007, 0, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.011, 0.011, 0.004, 18]} /><meshStandardMaterial {...AN_GLASS} />
        </mesh>
      ))}
    </group>
  )
}

const SpotModel: React.FC<ModelProps> = (props) => {
  const { hips, knees, root } = useQuadrupedRig(props)
  return (
    <group ref={root} position={[0, 0.46, 0]}>
      {/* black chassis + yellow top & side covers */}
      <RoundedBox args={[0.74, 0.1, 0.2]} radius={0.03} smoothness={3} position={[0, -0.02, 0]} castShadow receiveShadow>
        <meshStandardMaterial {...SP_BLACK} />
      </RoundedBox>
      <RoundedBox args={[0.6, 0.06, 0.25]} radius={0.025} smoothness={4} position={[0, 0.045, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial {...SP_YELLOW} />
      </RoundedBox>
      {[1, -1].map(s => (
        <RoundedBox key={s} args={[0.46, 0.07, 0.02]} radius={0.008} smoothness={3} position={[0, -0.005, s * 0.11]} castShadow>
          <meshPhysicalMaterial {...SP_YELLOW} />
        </RoundedBox>
      ))}
      {/* payload rails */}
      {[0.065, -0.065].map(z => (
        <mesh key={z} position={[0, 0.082, z]} castShadow><boxGeometry args={[0.5, 0.014, 0.022]} /><meshStandardMaterial {...SP_BLACK} /></mesh>
      ))}
      {/* front sensor nose with V-angled stereo pairs */}
      <RoundedBox args={[0.1, 0.1, 0.22]} radius={0.03} smoothness={3} position={[0.37, 0.005, 0]} castShadow>
        <meshStandardMaterial {...SP_BLACK} />
      </RoundedBox>
      {[1, -1].map(s => (
        <StereoPair key={s} position={[0.415, 0.01, s * 0.055]} rotation={[0, s * -0.45, -0.2]} />
      ))}
      {/* side and rear stereo pairs */}
      {[1, -1].map(s => (
        <StereoPair key={`side${s}`} position={[0, -0.03, s * 0.102]} rotation={[0, s * -Math.PI / 2, 0]} />
      ))}
      <RoundedBox args={[0.06, 0.09, 0.19]} radius={0.02} smoothness={3} position={[-0.375, -0.005, 0]} castShadow>
        <meshStandardMaterial {...SP_BLACK} />
      </RoundedBox>
      <StereoPair position={[-0.408, 0, 0]} rotation={[0, Math.PI, 0]} />
      {/* legs: black hip drive, yellow upper leg, black knee, shank and foot */}
      {QUAD_HIPS.map((p, i) => {
        const s = Math.sign(p[2])
        return (
          <group key={i} position={p}>
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.048, 0.048, 0.1, 28]} /><meshStandardMaterial {...SP_BLACK} /></mesh>
            <group ref={el => (hips.current[i] = el)} position={[0, 0, s * 0.06]}>
              <mesh rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.052, 0.052, 0.07, 28]} /><meshStandardMaterial {...SP_BLACK} /></mesh>
              <RoundedBox args={[0.075, 0.25, 0.06]} radius={0.025} smoothness={4} position={[0, -0.125, 0]} castShadow>
                <meshPhysicalMaterial {...SP_YELLOW} />
              </RoundedBox>
              <mesh position={[0, -0.13, s * 0.031]}><boxGeometry args={[0.03, 0.15, 0.004]} /><meshStandardMaterial {...SP_BLACK} /></mesh>
              <group ref={el => (knees.current[i] = el)} position={[0, -0.26, 0]}>
                <mesh rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.036, 0.036, 0.06, 24]} /><meshStandardMaterial {...SP_GREY} /></mesh>
                <mesh position={[0, -0.13, 0]} castShadow><cylinderGeometry args={[0.024, 0.016, 0.26, 16]} /><meshStandardMaterial {...SP_BLACK} /></mesh>
                <mesh position={[0, -0.27, 0]} castShadow><sphereGeometry args={[0.032, 18, 18]} /><meshStandardMaterial color="#1a1c20" roughness={0.9} /></mesh>
              </group>
            </group>
          </group>
        )
      })}
    </group>
  )
}

/* ── Humanoid rig (shared by H1 / G1) ──
 *  joint_state contract: joints[0..1] = left/right hip pitch,
 *  joints[2..3] = left/right shoulder pitch (rotation about x).
 *  Without data, a walking gait is generated. */
function useHumanoidRig({ joints, playing, speed, dataDriven }: ModelProps) {
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
  return { legL, legR, armL, armR, root }
}

/* ── Unitree H1: smooth light-grey torso shell with panel seams, open oval
 *  head ring with lidar, dark pelvis with large hip drives, long slim dark
 *  limbs, five-finger hands and wedge-shaped feet. ── */
const H1_DARK = { color: '#25282d', metalness: 0.3, roughness: 0.5 }
const H1_BLACK = { color: '#141619', metalness: 0.25, roughness: 0.6 }
const H1_SHELL = { color: '#c3c7cd', metalness: 0.05, roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.45 }

function Drive({ r, len }: { r: number; len: number }) {
  // joint drive whose axis is x (the pitch axis of the humanoid rig)
  return (
    <group rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow><cylinderGeometry args={[r, r, len, 28]} /><meshStandardMaterial {...H1_DARK} /></mesh>
      {[1, -1].map(s => (
        <mesh key={s} position={[0, (s * len) / 2, 0]}><cylinderGeometry args={[r * 0.7, r * 0.7, 0.006, 28]} /><meshStandardMaterial {...H1_BLACK} /></mesh>
      ))}
    </group>
  )
}

function H1Arm({ side }: { side: 1 | -1 }) {
  return (
    <group>
      <Drive r={0.055} len={0.08} />
      <mesh position={[side * 0.005, -0.17, 0]} castShadow>
        <capsuleGeometry args={[0.042, 0.24, 6, 20]} /><meshStandardMaterial {...H1_DARK} />
      </mesh>
      <group position={[0, -0.34, 0]}>
        <Drive r={0.04} len={0.07} />
        <mesh position={[0, -0.14, 0.01]} castShadow>
          <capsuleGeometry args={[0.034, 0.2, 6, 20]} /><meshStandardMaterial {...H1_DARK} />
        </mesh>
        <group position={[0, -0.265, 0.012]} scale={1.4}><H1Hand side={side} /></group>
      </group>
    </group>
  )
}

function H1Hand({ side }: { side: 1 | -1 }) {
  // Palm faces the body (-side·x); fingers hang down and curl toward the palm.
  const curl = -side * 0.55
  return (
    <group>
      <mesh position={[0, -0.005, 0]} castShadow><cylinderGeometry args={[0.026, 0.03, 0.02, 20]} /><meshStandardMaterial {...H1_BLACK} /></mesh>
      <RoundedBox args={[0.026, 0.06, 0.055]} radius={0.01} smoothness={3} position={[0, -0.045, 0]} castShadow>
        <meshStandardMaterial {...H1_DARK} />
      </RoundedBox>
      {[-0.019, -0.0065, 0.0065, 0.019].map((z, k) => (
        <group key={z} position={[0, -0.075, z]} rotation={[0, 0, curl * 0.4]}>
          <mesh position={[0, -0.014, 0]} castShadow><capsuleGeometry args={[0.0058, 0.018, 4, 10]} /><meshStandardMaterial {...H1_BLACK} /></mesh>
          <group position={[0, -0.03, 0]} rotation={[0, 0, curl]}>
            <mesh position={[0, -0.011, 0]} castShadow><capsuleGeometry args={[0.0052, k === 0 || k === 3 ? 0.011 : 0.015, 4, 10]} /><meshStandardMaterial {...H1_BLACK} /></mesh>
          </group>
        </group>
      ))}
      {/* thumb, opposed toward the palm side */}
      <group position={[-side * 0.008, -0.035, 0.03]} rotation={[0.5, 0, curl * 1.2]}>
        <mesh position={[0, -0.014, 0]} castShadow><capsuleGeometry args={[0.0065, 0.018, 4, 10]} /><meshStandardMaterial {...H1_BLACK} /></mesh>
        <group position={[0, -0.03, 0]} rotation={[0, 0, curl * 0.6]}>
          <mesh position={[0, -0.01, 0]} castShadow><capsuleGeometry args={[0.006, 0.012, 4, 10]} /><meshStandardMaterial {...H1_BLACK} /></mesh>
        </group>
      </group>
    </group>
  )
}

function H1Foot() {
  // Side profile (forward = +z, up = +y): tall at the ankle, tapering to a
  // thin toe, short rounded heel. Extruded across the foot width (x).
  const geo = useMemo(() => {
    const w = 0.07
    const shape = new THREE.Shape()
    shape.moveTo(-0.07, 0.006)
    shape.lineTo(0.15, 0.004)
    shape.quadraticCurveTo(0.17, 0.006, 0.165, 0.016)
    shape.quadraticCurveTo(0.07, 0.03, 0.035, 0.075)
    shape.quadraticCurveTo(0.0, 0.09, -0.045, 0.06)
    shape.quadraticCurveTo(-0.075, 0.04, -0.07, 0.006)
    const g = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 3, curveSegments: 16 })
    g.translate(0, 0, -w / 2)
    g.rotateY(-Math.PI / 2)
    g.computeVertexNormals()
    return g
  }, [])
  return (
    <group>
      <mesh geometry={geo} castShadow receiveShadow><meshStandardMaterial {...H1_DARK} /></mesh>
      {/* rubber sole */}
      <RoundedBox args={[0.074, 0.008, 0.235]} radius={0.003} smoothness={2} position={[0, 0.002, 0.048]} receiveShadow>
        <meshStandardMaterial color="#0d0e10" roughness={0.95} />
      </RoundedBox>
    </group>
  )
}

function H1Leg() {
  return (
    <group>
      <Drive r={0.068} len={0.09} />
      <mesh position={[0, -0.2, 0]} castShadow><cylinderGeometry args={[0.066, 0.05, 0.34, 24]} /><meshStandardMaterial {...H1_DARK} /></mesh>
      <group position={[0, -0.4, 0]}>
        <Drive r={0.05} len={0.08} />
        <mesh position={[0, -0.2, -0.005]} castShadow><cylinderGeometry args={[0.048, 0.032, 0.34, 24]} /><meshStandardMaterial {...H1_DARK} /></mesh>
        <group position={[0, -0.385, 0]}><Drive r={0.03} len={0.06} /></group>
        <group position={[0, -0.445, 0]}><H1Foot /></group>
      </group>
    </group>
  )
}

// (radius, height) profile of the torso, centred on its mid-height
const TORSO_PROFILE: [number, number][] = [
  [0, -0.17], [0.105, -0.17], [0.118, -0.15], [0.128, -0.1], [0.145, -0.03], [0.162, 0.04],
  [0.17, 0.09], [0.165, 0.13], [0.145, 0.158], [0.1, 0.172], [0.04, 0.178], [0, 0.178],
]
const TORSO_SEAMS: [number, number][] = [[-0.06, 0.1395], [-0.135, 0.1205]]

const H1Model: React.FC<ModelProps> = (props) => {
  const { legL, legR, armL, armR, root } = useHumanoidRig(props)
  const torsoGeo = useMemo(() => {
    const pts = new THREE.SplineCurve(TORSO_PROFILE.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(48)
    return new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(Math.max(p.x, 0), p.y)), 64)
  }, [])
  return (
    <group ref={root} position={[0, 0.92, 0]}>
      {/* pelvis + hip-yaw drives */}
      <RoundedBox args={[0.24, 0.09, 0.13]} radius={0.025} smoothness={3} castShadow><meshStandardMaterial {...H1_DARK} /></RoundedBox>
      {[0.08, -0.08].map(x => (
        <mesh key={x} position={[x, -0.035, 0]} castShadow><cylinderGeometry args={[0.045, 0.045, 0.05, 24]} /><meshStandardMaterial {...H1_BLACK} /></mesh>
      ))}
      {/* waist */}
      <mesh position={[0, 0.075, 0]} castShadow><cylinderGeometry args={[0.07, 0.08, 0.06, 28]} /><meshStandardMaterial {...H1_BLACK} /></mesh>
      {/* smooth torso shell: lathed profile (rounded shoulders, full chest,
          tapered waist), flattened front-to-back, with seam rings */}
      <group position={[0, 0.27, 0]} scale={[1, 1, 0.62]}>
        <mesh geometry={torsoGeo} castShadow receiveShadow><meshPhysicalMaterial {...H1_SHELL} /></mesh>
        {TORSO_SEAMS.map(([y, r]) => (
          <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[r + 0.0005, 0.0022, 6, 64]} /><meshStandardMaterial {...H1_BLACK} />
          </mesh>
        ))}
      </group>
      {[1, -1].map(s => (
        <mesh key={s} position={[s * 0.03, 0.33, 0.1]} rotation={[-0.25, 0, s * 0.7]}><boxGeometry args={[0.0035, 0.06, 0.003]} /><meshStandardMaterial {...H1_BLACK} /></mesh>
      ))}
      {/* neck + open oval head ring with lidar */}
      <mesh position={[0, 0.47, 0]} castShadow><cylinderGeometry args={[0.025, 0.035, 0.05, 20]} /><meshStandardMaterial {...H1_BLACK} /></mesh>
      <group position={[0, 0.58, 0]} scale={[1, 1.35, 1]}>
        <mesh castShadow><torusGeometry args={[0.065, 0.016, 14, 40]} /><meshStandardMaterial {...H1_BLACK} /></mesh>
        <mesh position={[0, 0, -0.012]}><circleGeometry args={[0.05, 32]} /><meshStandardMaterial color="#0a0b0d" metalness={0.8} roughness={0.15} side={THREE.DoubleSide} /></mesh>
      </group>
      <mesh position={[0, 0.505, 0.012]}><sphereGeometry args={[0.012, 12, 12]} /><meshStandardMaterial color={NV} emissive={NV} emissiveIntensity={1} toneMapped={false} /></mesh>
      {/* limbs (pivot positions are the rig contract) */}
      <group ref={armL} position={[0.215, 0.39, 0]}><H1Arm side={1} /></group>
      <group ref={armR} position={[-0.215, 0.39, 0]}><H1Arm side={-1} /></group>
      <group ref={legL} position={[0.08, -0.07, 0]}><H1Leg /></group>
      <group ref={legR} position={[-0.08, -0.07, 0]}><H1Leg /></group>
    </group>
  )
}

/* ── Unitree G1: brushed-silver shell, boxy rounded torso with a dark lower
 *  panel, dark helmet head with blue LED visor ring, black joint bands and
 *  drives, organically curved limbs, articulated gloved hands, ankle
 *  push-rods and shoe-like feet. ── */
const G1_SILVER = { color: '#d3d7dc', metalness: 0.5, roughness: 0.38 }
const G1_PANEL = { color: '#5b6169', metalness: 0.7, roughness: 0.35 }
const G1_BLACK = { color: '#15171a', metalness: 0.3, roughness: 0.55 }
const G1_VISOR = '#3b82f6'

function Band({ r, y, h = 0.018 }: { r: number; y: number; h?: number }) {
  return <mesh position={[0, y, 0]}><cylinderGeometry args={[r, r, h, 24]} /><meshStandardMaterial {...G1_BLACK} /></mesh>
}

const G1_GLOVE = { color: '#1c1e22', metalness: 0.1, roughness: 0.75 }
const G1_SHOE = { color: '#202226', metalness: 0.15, roughness: 0.6 }

/* Organic limb shells: (radius, y) profiles lathed around the bone axis, so
 * the silhouette swells and narrows like muscle (deltoid, biceps, forearm,
 * quadriceps, calf). y runs downward from the joint. */
type Profile = [number, number][]
const P_UPPER_ARM: Profile = [[0, 0.012], [0.04, 0.002], [0.055, -0.03], [0.053, -0.09], [0.047, -0.16], [0.04, -0.24], [0.036, -0.3], [0.028, -0.335], [0, -0.34]]
const P_FOREARM: Profile = [[0, 0], [0.032, -0.006], [0.042, -0.04], [0.043, -0.08], [0.036, -0.15], [0.029, -0.215], [0.026, -0.24], [0, -0.245]]
const P_THIGH: Profile = [[0, 0.005], [0.062, -0.008], [0.079, -0.06], [0.075, -0.14], [0.065, -0.24], [0.053, -0.33], [0.046, -0.37], [0, -0.38]]
const P_SHIN: Profile = [[0, -0.02], [0.046, -0.03], [0.057, -0.1], [0.053, -0.17], [0.041, -0.26], [0.032, -0.34], [0.03, -0.365], [0, -0.37]]

function LimbShell({ profile, scale = [1, 1, 1], position = [0, 0, 0] }: {
  profile: Profile; scale?: [number, number, number]; position?: [number, number, number]
}) {
  const geo = useMemo(() => {
    const pts = new THREE.SplineCurve(profile.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(48)
    return new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(Math.max(p.x, 0), p.y)), 48)
  }, [profile])
  return (
    <mesh geometry={geo} scale={scale} position={position} castShadow receiveShadow>
      <meshStandardMaterial {...G1_SILVER} />
    </mesh>
  )
}

/* Articulated glove-like hand: 4 three-segment fingers of different lengths,
 * slightly splayed and relaxed-curled toward the palm, plus an opposed thumb. */
const FINGERS: { z: number; f: number }[] = [
  { z: 0.024, f: 1.0 },   // index (thumb side, +z)
  { z: 0.008, f: 1.1 },   // middle
  { z: -0.008, f: 1.0 },  // ring
  { z: -0.024, f: 0.8 },  // pinky
]

function Digit({ lens, r, curl }: { lens: number[]; r: number; curl: number }) {
  // nested phalanges: each segment hangs from the previous one's tip
  const [l, ...rest] = lens
  return (
    <group>
      <mesh><sphereGeometry args={[r * 1.12, 12, 10]} /><meshStandardMaterial {...G1_GLOVE} /></mesh>
      <mesh position={[0, -l / 2, 0]} castShadow><capsuleGeometry args={[r, Math.max(l - 2 * r, 0.002), 4, 10]} /><meshStandardMaterial {...G1_GLOVE} /></mesh>
      {rest.length > 0 && (
        <group position={[0, -l, 0]} rotation={[0, 0, curl]}>
          <Digit lens={rest} r={r * 0.92} curl={curl * 1.15} />
        </group>
      )}
    </group>
  )
}

function G1Hand({ side }: { side: 1 | -1 }) {
  const curl = -side * 0.3
  return (
    <group>
      <mesh position={[0, -0.006, 0]} castShadow><cylinderGeometry args={[0.022, 0.025, 0.016, 20]} /><meshStandardMaterial {...G1_BLACK} /></mesh>
      <RoundedBox args={[0.03, 0.078, 0.07]} radius={0.012} smoothness={3} position={[0, -0.05, 0]} castShadow>
        <meshStandardMaterial {...G1_GLOVE} />
      </RoundedBox>
      {/* knuckle ridge */}
      <RoundedBox args={[0.012, 0.012, 0.066]} radius={0.005} smoothness={2} position={[side * 0.012, -0.084, 0]}>
        <meshStandardMaterial {...G1_BLACK} />
      </RoundedBox>
      {FINGERS.map(({ z, f }) => (
        <group key={z} position={[0, -0.09, z]} rotation={[-z * 4, 0, curl * 0.6]}>
          <Digit lens={[0.03 * f, 0.022 * f, 0.018 * f]} r={0.0085} curl={curl} />
        </group>
      ))}
      <group position={[-side * 0.006, -0.032, 0.036]} rotation={[-0.75, 0, curl * 1.3]}>
        <Digit lens={[0.026, 0.02, 0.016]} r={0.0095} curl={curl * 0.8} />
      </group>
    </group>
  )
}

/* Shoe-like foot: rounded footprint sole + side-profile upper with a domed
 * toe box, raised instep and heel counter. Forward = +z. */
function G1Foot() {
  const { upper, sole } = useMemo(() => {
    const prof = new THREE.Shape()
    prof.moveTo(-0.075, 0.012)
    prof.lineTo(0.13, 0.012)
    prof.quadraticCurveTo(0.158, 0.014, 0.152, 0.036)
    prof.quadraticCurveTo(0.135, 0.056, 0.085, 0.06)
    prof.quadraticCurveTo(0.045, 0.066, 0.025, 0.088)
    prof.lineTo(-0.045, 0.088)
    prof.quadraticCurveTo(-0.082, 0.08, -0.084, 0.045)
    prof.quadraticCurveTo(-0.085, 0.02, -0.075, 0.012)
    const w = 0.056
    const upper = new THREE.ExtrudeGeometry(prof, { depth: w, bevelEnabled: true, bevelSize: 0.011, bevelThickness: 0.011, bevelSegments: 4, curveSegments: 20 })
    upper.translate(0, 0, -w / 2)
    upper.rotateY(-Math.PI / 2)
    upper.computeVertexNormals()

    const fp = new THREE.Shape()   // footprint in (x = lateral, y = forward)
    fp.moveTo(0.034, -0.07)
    fp.lineTo(0.044, 0.07)
    fp.quadraticCurveTo(0.046, 0.165, 0, 0.17)
    fp.quadraticCurveTo(-0.046, 0.165, -0.044, 0.07)
    fp.lineTo(-0.034, -0.07)
    fp.absarc(0, -0.07, 0.034, Math.PI, 0, false)
    const sole = new THREE.ExtrudeGeometry(fp, { depth: 0.014, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2, curveSegments: 24 })
    sole.rotateX(Math.PI / 2)
    sole.translate(0, 0.017, 0)
    sole.computeVertexNormals()
    return { upper, sole }
  }, [])
  return (
    <group>
      <mesh geometry={upper} castShadow receiveShadow><meshStandardMaterial {...G1_SHOE} /></mesh>
      <mesh geometry={sole} castShadow receiveShadow><meshStandardMaterial color="#0e0f11" roughness={0.95} /></mesh>
    </group>
  )
}

function G1Arm({ side }: { side: 1 | -1 }) {
  return (
    <group>
      <mesh castShadow><sphereGeometry args={[0.056, 24, 18]} /><meshStandardMaterial {...G1_SILVER} /></mesh>
      <group position={[-side * 0.03, 0, 0]}><Drive r={0.045} len={0.03} /></group>
      <LimbShell profile={P_UPPER_ARM} scale={[1, 1, 1.08]} />
      <Band r={0.045} y={-0.075} h={0.012} />
      <Band r={0.038} y={-0.29} h={0.022} />
      <group position={[0, -0.34, 0]}>
        <Drive r={0.04} len={0.08} />
        <LimbShell profile={P_FOREARM} scale={[0.92, 1, 1.05]} position={[0, 0, 0.006]} />
        <Band r={0.028} y={-0.232} h={0.026} />
        <group position={[0, -0.25, 0.008]}><G1Hand side={side} /></group>
      </group>
    </group>
  )
}

function G1Leg() {
  return (
    <group>
      <Drive r={0.07} len={0.1} />
      <LimbShell profile={P_THIGH} scale={[0.88, 1, 1.08]} position={[0, -0.01, 0.006]} />
      <group position={[0, -0.4, 0]}>
        <Drive r={0.052} len={0.09} />
        {/* knee cap */}
        <mesh position={[0, 0.005, 0.042]} scale={[1, 1.2, 0.6]} castShadow><sphereGeometry args={[0.034, 20, 16]} /><meshStandardMaterial {...G1_SILVER} /></mesh>
        {/* shin with posterior calf swell */}
        <LimbShell profile={P_SHIN} scale={[0.86, 1, 1.0]} position={[0, 0, 0.006]} />
        <LimbShell profile={P_SHIN} scale={[0.7, 0.75, 0.75]} position={[0, -0.02, -0.018]} />
        {/* calf drive and ankle push-rods */}
        <RoundedBox args={[0.05, 0.07, 0.03]} radius={0.01} smoothness={3} position={[0, -0.08, -0.05]} castShadow>
          <meshStandardMaterial {...G1_BLACK} />
        </RoundedBox>
        {[0.018, -0.018].map(x => (
          <mesh key={x} position={[x, -0.29, -0.036]} castShadow><cylinderGeometry args={[0.005, 0.005, 0.16, 10]} /><meshStandardMaterial {...G1_PANEL} /></mesh>
        ))}
        <group position={[0, -0.39, 0]}><Drive r={0.03} len={0.07} /></group>
        <group position={[0, -0.445, 0]}><G1Foot /></group>
      </group>
    </group>
  )
}

const G1Model: React.FC<ModelProps> = (props) => {
  const { legL, legR, armL, armR, root } = useHumanoidRig(props)
  return (
    <group ref={root} position={[0, 0.92, 0]}>
      {/* pelvis + waist joint */}
      <RoundedBox args={[0.2, 0.1, 0.13]} radius={0.035} smoothness={3} castShadow><meshStandardMaterial {...G1_SILVER} /></RoundedBox>
      <mesh position={[0, 0.07, 0]} castShadow><cylinderGeometry args={[0.06, 0.07, 0.05, 28]} /><meshStandardMaterial {...G1_BLACK} /></mesh>
      <mesh position={[0, 0.1, 0]}><cylinderGeometry args={[0.075, 0.075, 0.012, 28]} /><meshStandardMaterial {...G1_PANEL} /></mesh>
      {/* boxy rounded torso, dark lower panel, chest notch */}
      <RoundedBox args={[0.28, 0.31, 0.17]} radius={0.05} smoothness={5} position={[0, 0.27, 0]} castShadow receiveShadow>
        <meshStandardMaterial {...G1_SILVER} />
      </RoundedBox>
      <RoundedBox args={[0.2, 0.075, 0.02]} radius={0.008} smoothness={3} position={[0, 0.17, 0.08]} castShadow>
        <meshStandardMaterial {...G1_PANEL} />
      </RoundedBox>
      <mesh position={[0, 0.39, 0.086]} rotation={[Math.PI / 2, 0, Math.PI]}><coneGeometry args={[0.012, 0.004, 3]} /><meshStandardMaterial {...G1_BLACK} /></mesh>
      {/* black shoulder yoke + neck */}
      <RoundedBox args={[0.14, 0.03, 0.1]} radius={0.012} smoothness={3} position={[0, 0.425, 0]} castShadow>
        <meshStandardMaterial {...G1_BLACK} />
      </RoundedBox>
      <mesh position={[0, 0.465, 0]} castShadow><cylinderGeometry args={[0.025, 0.03, 0.05, 20]} /><meshStandardMaterial {...G1_BLACK} /></mesh>
      {/* helmet head with blue LED visor ring */}
      <group position={[0, 0.55, 0]}>
        <mesh scale={[0.85, 1.05, 0.95]} castShadow><sphereGeometry args={[0.075, 32, 24]} /><meshStandardMaterial {...G1_BLACK} /></mesh>
        <group position={[0, -0.005, 0.058]} scale={[1, 0.8, 1]}>
          <mesh><torusGeometry args={[0.045, 0.006, 10, 40]} /><meshStandardMaterial color={G1_VISOR} emissive={G1_VISOR} emissiveIntensity={1.6} toneMapped={false} /></mesh>
          <mesh position={[0, 0, -0.004]}><circleGeometry args={[0.043, 32]} /><meshStandardMaterial color="#05070b" metalness={0.9} roughness={0.1} /></mesh>
        </group>
      </group>
      {/* limbs (pivot positions are the rig contract) */}
      <group ref={armL} position={[0.19, 0.4, 0]}><G1Arm side={1} /></group>
      <group ref={armR} position={[-0.19, 0.4, 0]}><G1Arm side={-1} /></group>
      <group ref={legL} position={[0.08, -0.07, 0]}><G1Leg /></group>
      <group ref={legR} position={[-0.08, -0.07, 0]}><G1Leg /></group>
    </group>
  )
}

/* ── Crazyflie 2.x nano quadcopter: the PCB is the frame (black board with
 *  expansion-deck pin headers and gold pads), translucent motor-mount arms,
 *  silver coreless motors with legs, two-blade props, LiPo battery underneath
 *  and status LEDs (front red/green, rear blue). Front = +x.
 *  joint_state contract: joints[0] = roll (about x), joints[1] = pitch
 *  (about z); without data it hovers. ── */
const CF_ARMS: [number, number][] = [[0.26, 0.26], [0.26, -0.26], [-0.26, 0.26], [-0.26, -0.26]]
const CF_PCB = { color: '#16181c', metalness: 0.2, roughness: 0.55 }
const CF_GOLD = { color: '#c9a24a', metalness: 0.9, roughness: 0.3 }
const CF_MOUNT = { color: '#e8ecef', metalness: 0.0, roughness: 0.35, transparent: true, opacity: 0.82 }
const CF_MOTOR = { color: '#b9bec5', metalness: 0.9, roughness: 0.25 }
const CF_PROP = { color: '#2a2d33', metalness: 0.1, roughness: 0.5, transparent: true, opacity: 0.9 }
const CF_LED = ['#ef4444', '#22c55e', '#3b82f6', '#3b82f6']   // front-left, front-right, rear, rear

function Prop() {
  // two tapered, slightly pitched blades around a hub
  return (
    <group>
      <mesh><cylinderGeometry args={[0.012, 0.012, 0.012, 16]} /><meshStandardMaterial {...CF_PROP} /></mesh>
      {[0, Math.PI].map(a => (
        <group key={a} rotation={[0, a, 0]}>
          <mesh position={[0.085, 0, 0]} rotation={[0.22, 0, 0]} scale={[0.085, 0.004, 0.022]}>
            <sphereGeometry args={[1, 20, 8]} /><meshStandardMaterial {...CF_PROP} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

const CrazyflieModel: React.FC<ModelProps> = ({ joints, playing, speed, dataDriven }) => {
  const jref = useRef<number[]>([]); jref.current = joints
  const rotors = useRef<(THREE.Group | null)[]>([])
  const blur = useRef<(THREE.Mesh | null)[]>([])
  const root = useRef<THREE.Group>(null!)
  const t = useRef(0)
  useFrame((_, dt) => {
    // diagonal motor pairs spin the same way (M1/M3 vs M2/M4)
    rotors.current.forEach((g, i) => g && (g.rotation.y += (playing ? 1 : 0) * (i === 0 || i === 3 ? 1 : -1) * dt * speed * 40))
    blur.current.forEach(m => m && (m.visible = playing))
    if (dataDriven) {
      const j = jref.current
      if (root.current) { root.current.rotation.x = j[0] ?? 0; root.current.rotation.z = j[1] ?? 0 }
    } else {
      if (playing) t.current += dt * speed
      if (root.current) { root.current.position.y = 1.0 + Math.sin(t.current * 1.5) * 0.05; root.current.rotation.z = Math.sin(t.current) * 0.04 }
    }
  })
  const pins = Array.from({ length: 10 }, (_, k) => -0.0675 + k * 0.015)
  return (
    <group ref={root} position={[0, 1.0, 0]}>
      {/* board stack (PCB, chips, headers, battery), sized to the real ~1:2 board/motor-span ratio */}
      <group scale={1.3}>
        {/* PCB frame */}
        <RoundedBox args={[0.22, 0.012, 0.2]} radius={0.005} smoothness={2} castShadow receiveShadow>
          <meshStandardMaterial {...CF_PCB} />
        </RoundedBox>
        {/* silkscreen outline + gold pads */}
        <mesh position={[0, 0.0065, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.045, 0.048, 4, 1]} /><meshBasicMaterial color="#e5e7eb" /></mesh>
        {[[0.07, 0.03], [0.07, -0.03], [-0.07, 0.03], [-0.07, -0.03], [0.02, 0.0]].map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x, 0.0065, z]}><boxGeometry args={[0.012, 0.002, 0.008]} /><meshStandardMaterial {...CF_GOLD} /></mesh>
        ))}
        {/* MCU + radio chips */}
        <mesh position={[0, 0.009, 0]}><boxGeometry args={[0.035, 0.006, 0.035]} /><meshStandardMaterial color="#0b0c0e" roughness={0.4} /></mesh>
        <mesh position={[-0.045, 0.008, 0.01]}><boxGeometry args={[0.02, 0.004, 0.02]} /><meshStandardMaterial color="#0b0c0e" roughness={0.4} /></mesh>
        {/* expansion-deck pin headers (two rows along the sides) */}
        {[0.085, -0.085].map(z => (
          <group key={z} position={[0, 0.006, z]}>
            <mesh position={[0, 0.008, 0]} castShadow><boxGeometry args={[0.155, 0.014, 0.014]} /><meshStandardMaterial color="#0d0e10" roughness={0.6} /></mesh>
            {pins.map(x => (
              <mesh key={x} position={[x, 0.02, 0]}><boxGeometry args={[0.003, 0.012, 0.003]} /><meshStandardMaterial {...CF_GOLD} /></mesh>
            ))}
          </group>
        ))}
        {/* LiPo battery in its holder underneath */}
        <RoundedBox args={[0.13, 0.03, 0.075]} radius={0.008} smoothness={2} position={[0, -0.023, 0]} castShadow>
          <meshStandardMaterial color="#8e98a6" metalness={0.6} roughness={0.35} />
        </RoundedBox>
        <mesh position={[0, -0.023, 0.038]}><boxGeometry args={[0.09, 0.016, 0.002]} /><meshStandardMaterial color="#1e3a8a" roughness={0.6} /></mesh>
      </group>
      {CF_ARMS.map(([x, z], i) => {
        const yaw = -Math.atan2(z, x)
        const len = Math.hypot(x, z) - 0.1
        return (
          <group key={i}>
            {/* motor-mount arm from the PCB corner */}
            <mesh position={[x * 0.62, 0, z * 0.62]} rotation={[0, yaw, 0]} castShadow>
              <boxGeometry args={[len, 0.014, 0.022]} /><meshStandardMaterial {...CF_MOUNT} />
            </mesh>
            <group position={[x, 0, z]}>
              {/* mount collar, coreless motor, shaft, landing leg */}
              <mesh castShadow><cylinderGeometry args={[0.03, 0.03, 0.03, 20]} /><meshStandardMaterial {...CF_MOUNT} /></mesh>
              <mesh position={[0, 0.01, 0]} castShadow><cylinderGeometry args={[0.022, 0.022, 0.05, 20]} /><meshStandardMaterial {...CF_MOTOR} /></mesh>
              <mesh position={[0, 0.042, 0]}><cylinderGeometry args={[0.003, 0.003, 0.016, 8]} /><meshStandardMaterial {...CF_MOTOR} /></mesh>
              <mesh position={[0, -0.05, 0]} castShadow><cylinderGeometry args={[0.006, 0.004, 0.08, 10]} /><meshStandardMaterial {...CF_MOUNT} /></mesh>
              {/* status LED on the arm */}
              <mesh position={[-x * 0.12, 0.009, -z * 0.12]}>
                <sphereGeometry args={[0.007, 10, 10]} />
                <meshStandardMaterial color={CF_LED[i]} emissive={CF_LED[i]} emissiveIntensity={2} toneMapped={false} />
              </mesh>
              <group ref={el => (rotors.current[i] = el)} position={[0, 0.052, 0]}><Prop /></group>
              {/* faint motion-blur disc while spinning */}
              <mesh ref={el => (blur.current[i] = el)} position={[0, 0.052, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.17, 40]} />
                <meshBasicMaterial color="#9aa3ad" transparent opacity={0.08} depthWrite={false} side={THREE.DoubleSide} />
              </mesh>
            </group>
          </group>
        )
      })}
    </group>
  )
}

/* ── Model registry — add robots here ── */
export const MODELS: RobotModel[] = [
  { id: 'arm', name: 'Franka 7-DOF Arm', category: 'Manipulator', dof: 7, dataDriven: true, dataset: 'synthetic_v1', ee: true,
    desc: '학습된 정책 궤적(joint_state)으로 구동되는 7축 산업용 암 + 그리퍼. Isaac Lab `FRANKA_PANDA_CFG`.',
    target: [0, 1.75, 0], camera: [3.9, 2.7, 4.5], Component: ArmModel },

  { id: 'anymal', name: 'ANYmal-D', category: 'Quadruped', dof: 12, dataDriven: true, dataset: 'anymal_v1',
    desc: 'ANYbotics 4족 보행 로봇. Isaac Lab `ANYMAL_D_CFG`. 궤적(joint_state[12])으로 보행 구동.',
    target: [0, 0.42, 0], camera: [1.45, 0.95, 1.7], Component: AnymalModel },

  { id: 'spot', name: 'Boston Dynamics Spot', category: 'Quadruped', dof: 12, dataDriven: true, dataset: 'spot_v1',
    desc: 'Boston Dynamics Spot. Isaac Lab `SPOT_CFG`. 궤적(joint_state[12])으로 대각 트로트 보행.',
    target: [0, 0.42, 0], camera: [1.45, 0.95, 1.7], Component: SpotModel },

  { id: 'h1', name: 'Unitree H1', category: 'Humanoid', dof: 19, dataDriven: true, dataset: 'h1_v1',
    desc: 'Unitree H1 이족 휴머노이드. Isaac Lab `H1_CFG`. 궤적(joint_state[19])으로 보행 구동.',
    target: [0, 0.95, 0], camera: [1.8, 1.4, 2.4], Component: H1Model },

  { id: 'g1', name: 'Unitree G1', category: 'Humanoid', dof: 23, dataDriven: true, dataset: 'g1_v1',
    desc: 'Unitree G1 소형 휴머노이드. Isaac Lab `G1_CFG`. 궤적(joint_state[23])으로 보행 구동.',
    target: [0, 0.95, 0], camera: [1.8, 1.4, 2.4], Component: G1Model },

  { id: 'crazyflie', name: 'Crazyflie Quadcopter', category: 'Aerial', dof: 4, dataDriven: true, dataset: 'crazyflie_v1',
    desc: 'Bitcraze Crazyflie 드론. Isaac Lab `CRAZYFLIE_CFG`. 궤적(joint_state[4])으로 자세 + 로터 회전.',
    target: [0, 1.0, 0], camera: [1.05, 1.75, 1.35], Component: CrazyflieModel },
]

export const MODEL_ICON: Record<string, string> = { arm: '🦾', anymal: '🐾', spot: '🐕', h1: '🧍', g1: '🤖', crazyflie: '🚁' }

/* shared selection so the Demos gallery can deep-link into a Simulation model */
export const simSelection = { id: 'arm' }
