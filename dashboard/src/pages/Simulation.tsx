import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid, ContactShadows, Trail, Html } from '@react-three/drei'
import { clsx } from 'clsx'
import * as THREE from 'three'
import { api } from '../api/client'

const NV = '#76b900'
const LINK_LEN = [0.55, 0.6, 0.5, 0.45, 0.4, 0.32, 0.26]
const AXES: ('x' | 'y' | 'z')[] = ['y', 'z', 'y', 'z', 'y', 'z', 'y']
const JOINT_COLORS = ['#76b900', '#00d4ff', '#a855f7', '#f59e0b', '#ef4444', '#10b981', '#f97316']
const GAIN = 1.4 // amplify joint angles for clearer visible motion

function JointLabel({ text, color, show }: { text: string; color: string; show: boolean }) {
  if (!show) return null
  return (
    <Html position={[0.14, 0, 0]} center distanceFactor={7} style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
      <div className="text-[10px] font-black px-1 rounded leading-none py-0.5" style={{ color: '#04060a', background: color }}>{text}</div>
    </Html>
  )
}

/* ── 3D articulated arm (recursive kinematic chain) ── */
function ArmChain({ angles, eeRef, showLabels, i = 0 }: {
  angles: number[]; eeRef?: React.RefObject<THREE.Mesh>; showLabels?: boolean; i?: number
}) {
  if (i >= LINK_LEN.length) {
    return (
      <group>
        <mesh castShadow><boxGeometry args={[0.16, 0.06, 0.16]} /><meshStandardMaterial color="#cbd5e1" metalness={0.6} roughness={0.3} /></mesh>
        <mesh position={[0.07, 0.09, 0]} castShadow><boxGeometry args={[0.03, 0.16, 0.07]} /><meshStandardMaterial color={NV} metalness={0.4} roughness={0.4} /></mesh>
        <mesh position={[-0.07, 0.09, 0]} castShadow><boxGeometry args={[0.03, 0.16, 0.07]} /><meshStandardMaterial color={NV} metalness={0.4} roughness={0.4} /></mesh>
        {/* end-effector marker (ref tracked for trail + coordinate readout) */}
        <Trail width={2.5} length={6} color={'#a3e635'} attenuation={(t) => t * t} decay={1}>
          <mesh ref={eeRef} position={[0, 0.12, 0]}><sphereGeometry args={[0.045, 12, 12]} /><meshBasicMaterial color="#c4f06b" /></mesh>
        </Trail>
        <group position={[0, 0.12, 0]}><JointLabel text="EE" color="#c4f06b" show={!!showLabels} /></group>
      </group>
    )
  }
  const a = (angles[i] ?? 0) * GAIN
  const rot: [number, number, number] = AXES[i] === 'x' ? [a, 0, 0] : AXES[i] === 'y' ? [0, a, 0] : [0, 0, a]
  const len = LINK_LEN[i]
  return (
    <group rotation={rot}>
      <mesh castShadow><sphereGeometry args={[0.09, 20, 20]} /><meshStandardMaterial color="#1e2d10" emissive={NV} emissiveIntensity={0.18} metalness={0.4} roughness={0.4} /></mesh>
      <JointLabel text={`J${i}`} color={JOINT_COLORS[i]} show={!!showLabels} />
      <mesh position={[0, len / 2, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.052, len, 18]} />
        <meshStandardMaterial color={i % 2 ? '#2a3344' : '#3a4a22'} metalness={0.55} roughness={0.35} />
      </mesh>
      <group position={[0, len, 0]}>
        <ArmChain angles={angles} eeRef={eeRef} showLabels={showLabels} i={i + 1} />
      </group>
    </group>
  )
}

/* reads the EE marker world position each frame (throttled) for the readout */
function EETracker({ targetRef, onPos }: {
  targetRef: React.RefObject<THREE.Mesh>; onPos: (p: [number, number, number]) => void
}) {
  const v = useRef(new THREE.Vector3())
  const last = useRef(0)
  useFrame(({ clock }) => {
    if (!targetRef.current) return
    const t = clock.getElapsedTime()
    if (t - last.current < 0.1) return
    last.current = t
    targetRef.current.getWorldPosition(v.current)
    onPos([v.current.x, v.current.y, v.current.z])
  })
  return null
}

function RobotArm({ angles, eeRef, showLabels }: {
  angles: number[]; eeRef?: React.RefObject<THREE.Mesh>; showLabels?: boolean
}) {
  return (
    <group>
      <mesh position={[0, 0.05, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.28, 0.34, 0.1, 32]} />
        <meshStandardMaterial color="#11161f" metalness={0.6} roughness={0.4} />
      </mesh>
      <group position={[0, 0.1, 0]}>
        <ArmChain angles={angles} eeRef={eeRef} showLabels={showLabels} />
      </group>
    </group>
  )
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, (Math.abs(value) / max) * 100)
  const pos = value >= 0
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-mono text-slate-500 w-9 shrink-0">{label}</span>
      <div className="flex-1 h-2.5 bg-slate-800 rounded-full relative overflow-hidden flex">
        <div className="w-1/2 flex justify-end">{!pos && <div className="h-full rounded-l-full" style={{ width: `${pct}%`, background: color }} />}</div>
        <div className="w-px bg-slate-600" />
        <div className="w-1/2">{pos && <div className="h-full rounded-r-full" style={{ width: `${pct}%`, background: color }} />}</div>
      </div>
      <span className="text-[9px] font-mono w-12 text-right shrink-0" style={{ color }}>{value.toFixed(3)}</span>
    </div>
  )
}

export function Simulation() {
  const { data: traj, isLoading, isError } = useQuery({
    queryKey: ['trajectory'],
    queryFn: () => api.getTrajectory(240),
    refetchInterval: 10000,
    retry: false,
  })

  const [frame, setFrame] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [showLabels, setShowLabels] = useState(true)
  const [compare, setCompare] = useState(false)
  const [eePos, setEePos] = useState<[number, number, number]>([0, 0, 0])
  const eeRef = useRef<THREE.Mesh>(null!)
  const count = traj?.count ?? 0

  // clamp frame when trajectory changes
  useEffect(() => { if (frame >= count) setFrame(0) }, [count]) // eslint-disable-line

  // playback loop
  const lastRef = useRef(0)
  useEffect(() => {
    if (!playing || count === 0) return
    let raf = 0
    const step = (t: number) => {
      const fps = 24 * speed
      if (t - lastRef.current >= 1000 / fps) {
        setFrame(f => (f + 1) % count)
        lastRef.current = t
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed, count])

  const joints = traj?.joints[frame] ?? new Array(7).fill(0)
  const actions = traj?.actions[frame] ?? new Array(7).fill(0)
  const reward = traj?.rewards[frame] ?? 0

  // Throttled synthetic RGB frame (~6 fps) synced to the actual dataset index
  const apiBase = (import.meta.env.VITE_API_URL ?? '') + '/api'
  const frameRef = useRef(0)
  frameRef.current = frame
  const [rgbIdx, setRgbIdx] = useState(0)
  useEffect(() => {
    if (!traj?.has_rgb) return
    const id = setInterval(() => setRgbIdx(frameRef.current * (traj.stride || 1)), 150)
    return () => clearInterval(id)
  }, [traj])

  return (
    <div className="p-3 sm:p-5 flex flex-col gap-4 h-full min-h-0">
      {/* header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted">3D Robot Playback</p>
          <p className="text-sm font-bold text-slate-200">합성 데이터 기반 로봇 동작 시뮬레이션</p>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <button
            onClick={() => setShowLabels(v => !v)}
            className={clsx('px-2 py-1 rounded-full border font-bold transition-colors',
              showLabels ? 'border-nvidia/40 text-nvidia bg-nvidia/10' : 'border-border text-slate-500 hover:text-slate-300')}
          >관절 라벨</button>
          {traj?.has_rgb && (
            <button
              onClick={() => setCompare(v => !v)}
              className={clsx('px-2 py-1 rounded-full border font-bold transition-colors',
                compare ? 'border-cyan-400/40 text-cyan-300 bg-cyan-500/10' : 'border-border text-slate-500 hover:text-slate-300')}
            >RGB 비교 뷰</button>
          )}
          <span className="hidden sm:inline px-2 py-1 rounded-full border border-border text-slate-400 font-bold">7-DOF · obs[14]→act[7]</span>
        </div>
      </div>

      {isError && (
        <div className="flex-1 grid place-items-center bg-panel border border-border rounded-xl">
          <div className="text-center">
            <p className="text-sm font-bold text-slate-300 mb-1">합성 데이터셋이 없습니다</p>
            <p className="text-xs text-muted">EXPORT 스테이지를 실행하면 <span className="font-mono text-nvidia">outputs/dataset/synthetic_v1.hdf5</span> 가 생성됩니다.</p>
          </div>
        </div>
      )}

      {!isError && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 min-h-0">
          {/* viewport cell: 3D, or 3D + RGB side-by-side in compare mode */}
          <div className="flex flex-col sm:flex-row gap-4 min-h-0">
          {/* 3D viewport */}
          <div className="relative flex-1 rounded-xl overflow-hidden border border-nvidia/25 bg-[#05080d] min-h-[360px]">
            <div className="absolute top-2 left-3 z-10 flex items-center gap-1.5 pointer-events-none">
              <span className="w-2 h-2 rounded-full bg-nvidia animate-pulse" />
              <span className="text-[9px] font-bold text-nvidia/70 uppercase tracking-widest">Isaac Sim Playback · drag to orbit</span>
            </div>
            <div className="absolute top-2 right-3 z-10 text-[9px] font-mono text-slate-500 pointer-events-none">
              frame {frame + 1} / {count}
            </div>
            <Canvas shadows camera={{ position: [2.4, 1.9, 2.8], fov: 45 }} dpr={[1, 2]}>
              <color attach="background" args={['#05080d']} />
              <ambientLight intensity={0.45} />
              <directionalLight position={[3, 5, 2]} intensity={1.15} castShadow shadow-mapSize={[1024, 1024]} />
              <directionalLight position={[-3, 2, -2]} intensity={0.35} color="#00d4ff" />
              <RobotArm angles={joints} eeRef={eeRef} showLabels={showLabels} />
              <EETracker targetRef={eeRef} onPos={setEePos} />
              <Grid args={[12, 12]} cellSize={0.5} cellColor="#16240c" sectionSize={2} sectionColor="#2d4417" infiniteGrid fadeDistance={14} fadeStrength={1.5} />
              <ContactShadows position={[0, 0.01, 0]} opacity={0.55} blur={2.2} scale={7} far={3} />
              <OrbitControls enablePan={false} minDistance={1.6} maxDistance={8} target={[0, 1.1, 0]} autoRotate={!playing} autoRotateSpeed={0.6} />
            </Canvas>

            {/* transport controls */}
            <div className="absolute bottom-0 inset-x-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-3 flex items-center gap-3">
              <button
                onClick={() => setPlaying(p => !p)}
                className="w-9 h-9 rounded-full bg-nvidia hover:bg-nvidia/90 text-black font-bold flex items-center justify-center shrink-0"
              >{playing ? '❚❚' : '▶'}</button>
              <input
                type="range" min={0} max={Math.max(0, count - 1)} value={frame}
                onChange={e => { setPlaying(false); setFrame(Number(e.target.value)) }}
                className="flex-1 accent-[#76b900]"
              />
              <div className="flex gap-1 shrink-0">
                {[0.5, 1, 2].map(s => (
                  <button key={s} onClick={() => setSpeed(s)}
                    className={clsx('text-[10px] font-bold px-2 py-1 rounded',
                      speed === s ? 'bg-nvidia text-black' : 'bg-slate-800 text-slate-400 hover:text-slate-200')}
                  >{s}×</button>
                ))}
              </div>
            </div>

            {isLoading && (
              <div className="absolute inset-0 grid place-items-center text-xs text-muted bg-black/40">궤적 로딩 중…</div>
            )}
          </div>

          {/* RGB compare panel (side-by-side with 3D) */}
          {compare && traj?.has_rgb && (
            <div className="relative flex-1 rounded-xl overflow-hidden border border-cyan-400/30 bg-black min-h-[200px] sm:min-h-[360px] grid place-items-center">
              <div className="absolute top-2 left-3 z-10 flex items-center gap-1.5 pointer-events-none">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-[9px] font-bold text-cyan-300/80 uppercase tracking-widest">RGB Observation · 224×224 · sensor cam</span>
              </div>
              <img
                src={`${apiBase}/dataset/frame?idx=${rgbIdx}`}
                alt="synthetic RGB observation"
                className="w-full h-full object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
          )}
          </div>

          {/* telemetry side panel */}
          <div className="flex flex-col gap-3 overflow-y-auto">
            {traj?.has_rgb && !compare && (
              <div className="bg-panel border border-border rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-black uppercase tracking-wider text-muted">RGB Observation · 224×224</p>
                  <span className="text-[8px] font-mono text-slate-500">sensor cam</span>
                </div>
                <div className="rounded-lg overflow-hidden border border-nvidia/20 bg-black aspect-square">
                  <img
                    src={`${apiBase}/dataset/frame?idx=${rgbIdx}`}
                    alt="synthetic RGB observation"
                    className="w-full h-full object-cover"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>
              </div>
            )}

            {/* End-effector coordinate readout */}
            <div className="bg-panel border border-border rounded-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-wider text-muted mb-2">End-Effector Pose (m)</p>
              <div className="grid grid-cols-3 gap-2">
                {(['X', 'Y', 'Z'] as const).map((ax, k) => (
                  <div key={ax} className="rounded-lg bg-surface border border-border px-2 py-1.5 text-center">
                    <p className="text-[8px] font-bold" style={{ color: ['#ef4444', '#22c55e', '#3b82f6'][k] }}>{ax}</p>
                    <p className="text-[11px] font-black font-mono text-slate-200">{eePos[k].toFixed(3)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-panel border border-border rounded-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-wider text-muted mb-2">Joint State · 7 DOF (rad)</p>
              <div className="flex flex-col gap-1.5">
                {joints.slice(0, 7).map((v, i) => (
                  <Bar key={i} label={`J${i}`} value={v} max={0.8} color={JOINT_COLORS[i]} />
                ))}
              </div>
            </div>

            <div className="bg-panel border border-border rounded-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-wider text-muted mb-2">Policy Action · 7 DOF</p>
              <div className="flex flex-col gap-1.5">
                {actions.slice(0, 7).map((v, i) => (
                  <Bar key={i} label={`A${i}`} value={v} max={1.0} color={JOINT_COLORS[i]} />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-panel border border-border rounded-xl p-3 flex flex-col gap-0.5">
                <p className="text-[9px] font-black uppercase tracking-wider text-muted">Reward</p>
                <p className="text-xl font-black font-mono" style={{ color: reward >= 0 ? NV : '#ef4444' }}>{reward.toFixed(3)}</p>
              </div>
              <div className="bg-panel border border-border rounded-xl p-3 flex flex-col gap-0.5">
                <p className="text-[9px] font-black uppercase tracking-wider text-muted">Frames</p>
                <p className="text-xl font-black font-mono text-slate-200">{count}</p>
                <p className="text-[9px] text-slate-500">of {traj?.n_total.toLocaleString() ?? '—'} (stride {traj?.stride ?? '—'})</p>
              </div>
            </div>

            <div className="bg-panel border border-border rounded-xl p-3">
              <p className="text-[9px] text-slate-500 leading-relaxed">
                <span className="text-nvidia font-bold">EXPORT</span> 단계에서 정책을 롤아웃해 생성한 합성 궤적(joint_state·action·reward)을
                재생합니다. Unreal/Unity 연동 시 동일한 <span className="font-mono">joint_state[7]</span> 스트림을 본 로봇 리그에 그대로 매핑하면 됩니다.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
