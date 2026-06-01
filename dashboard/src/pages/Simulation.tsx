import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid, Trail, Html, Environment, Lightformer, MeshReflectorMaterial } from '@react-three/drei'
import { clsx } from 'clsx'
import * as THREE from 'three'
import { api } from '../api/client'
import { usePipelineMode, usePipelineStatus } from '../hooks/usePipeline'

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

/* materials shared across the arm (industrial look) */
const SHELL = { color: '#e9edf2', metalness: 0.55, roughness: 0.32 }     // light alloy link shell
const HOUSING = { color: '#222a35', metalness: 0.9, roughness: 0.28 }    // dark machined joint housing
const ACCENT = { color: NV, emissive: NV, emissiveIntensity: 0.45, metalness: 0.4, roughness: 0.4 }

/* a joint motor housing oriented along the joint's rotation axis */
function Knuckle({ axis }: { axis: 'x' | 'y' | 'z' }) {
  const rot: [number, number, number] = axis === 'y' ? [0, 0, 0] : axis === 'x' ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]
  return (
    <group rotation={rot}>
      <mesh castShadow receiveShadow><cylinderGeometry args={[0.095, 0.095, 0.17, 28]} /><meshStandardMaterial {...HOUSING} /></mesh>
      <mesh castShadow><cylinderGeometry args={[0.1, 0.1, 0.04, 28]} /><meshStandardMaterial {...ACCENT} /></mesh>
      <mesh position={[0, 0.09, 0]}><cylinderGeometry args={[0.072, 0.072, 0.02, 24]} /><meshStandardMaterial color="#0c1018" metalness={0.7} roughness={0.5} /></mesh>
      <mesh position={[0, -0.09, 0]}><cylinderGeometry args={[0.072, 0.072, 0.02, 24]} /><meshStandardMaterial color="#0c1018" metalness={0.7} roughness={0.5} /></mesh>
    </group>
  )
}

/* tapered link shell from this joint up to the next */
function Link({ len }: { len: number }) {
  return (
    <group>
      <mesh position={[0, len / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.052, 0.062, len, 24]} />
        <meshStandardMaterial {...SHELL} />
      </mesh>
      <mesh position={[0.045, len / 2, 0]} castShadow>
        <boxGeometry args={[0.012, len * 0.82, 0.05]} />
        <meshStandardMaterial color="#11161f" metalness={0.7} roughness={0.4} />
      </mesh>
    </group>
  )
}

/* ── 3D articulated arm (recursive kinematic chain) ── */
function ArmChain({ angles, eeRef, showLabels, i = 0 }: {
  angles: number[]; eeRef?: React.RefObject<THREE.Mesh>; showLabels?: boolean; i?: number
}) {
  if (i >= LINK_LEN.length) {
    return (
      <group>
        {/* wrist flange + gripper */}
        <mesh castShadow><cylinderGeometry args={[0.07, 0.07, 0.05, 24]} /><meshStandardMaterial {...HOUSING} /></mesh>
        <mesh position={[0, 0.05, 0]} castShadow><cylinderGeometry args={[0.05, 0.05, 0.06, 20]} /><meshStandardMaterial {...SHELL} /></mesh>
        <mesh position={[0.055, 0.13, 0]} rotation={[0, 0, -0.12]} castShadow><boxGeometry args={[0.022, 0.13, 0.06]} /><meshStandardMaterial color="#cfd6df" metalness={0.7} roughness={0.3} /></mesh>
        <mesh position={[-0.055, 0.13, 0]} rotation={[0, 0, 0.12]} castShadow><boxGeometry args={[0.022, 0.13, 0.06]} /><meshStandardMaterial color="#cfd6df" metalness={0.7} roughness={0.3} /></mesh>
        {/* end-effector marker (ref tracked for trail + coordinate readout) */}
        <Trail width={2.2} length={5} color={'#a3e635'} attenuation={(t) => t * t} decay={1.2}>
          <mesh ref={eeRef} position={[0, 0.185, 0]}><sphereGeometry args={[0.03, 14, 14]} /><meshBasicMaterial color="#c4f06b" /></mesh>
        </Trail>
        <group position={[0, 0.2, 0]}><JointLabel text="EE" color="#c4f06b" show={!!showLabels} /></group>
      </group>
    )
  }
  const a = (angles[i] ?? 0) * GAIN
  const rot: [number, number, number] = AXES[i] === 'x' ? [a, 0, 0] : AXES[i] === 'y' ? [0, a, 0] : [0, 0, a]
  const len = LINK_LEN[i]
  return (
    <group rotation={rot}>
      <Knuckle axis={AXES[i]} />
      <JointLabel text={`J${i}`} color={JOINT_COLORS[i]} show={!!showLabels} />
      <Link len={len} />
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
    if (t - last.current < 0.2) return
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
      {/* layered pedestal base */}
      <mesh position={[0, 0.03, 0]} receiveShadow castShadow><cylinderGeometry args={[0.34, 0.4, 0.06, 40]} /><meshStandardMaterial color="#0d121b" metalness={0.7} roughness={0.45} /></mesh>
      <mesh position={[0, 0.1, 0]} receiveShadow castShadow><cylinderGeometry args={[0.26, 0.3, 0.1, 40]} /><meshStandardMaterial {...HOUSING} /></mesh>
      <mesh position={[0, 0.16, 0]} castShadow><cylinderGeometry args={[0.27, 0.27, 0.018, 40]} /><meshStandardMaterial {...ACCENT} /></mesh>
      <group position={[0, 0.17, 0]}>
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
  const qc = useQueryClient()
  const { data: traj, isLoading, isError } = useQuery({
    queryKey: ['trajectory'],
    queryFn: () => api.getTrajectory(240),
    refetchInterval: 10000,
    retry: false,
  })
  const { data: mode } = usePipelineMode()
  const { data: status } = usePipelineStatus()

  // Pull fresh data into the 3D the moment a REAL pipeline stage finishes
  // (running → idle): a REAL EXPORT regenerates synthetic_v1.hdf5, so the arm
  // and RGB immediately reflect the new policy rollout.
  const [dataVersion, setDataVersion] = useState(0)
  const wasRunning = useRef(false)
  useEffect(() => {
    const running = !!status?.running
    if (wasRunning.current && !running) {
      qc.invalidateQueries({ queryKey: ['trajectory'] })
      setDataVersion(v => v + 1)
    }
    wasRunning.current = running
  }, [status?.running, qc])

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

  // Telemetry numbers update at ~5fps (decoupled from the 24fps 3D) so the
  // readouts stay legible instead of flickering every frame.
  const [displayFrame, setDisplayFrame] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setDisplayFrame(frameRef.current), 200)
    return () => clearInterval(id)
  }, [])
  const dJoints = traj?.joints[displayFrame] ?? new Array(7).fill(0)
  const dActions = traj?.actions[displayFrame] ?? new Array(7).fill(0)
  const dReward = traj?.rewards[displayFrame] ?? 0

  return (
    <div className="p-3 sm:p-5 flex flex-col gap-4 h-full min-h-0">
      {/* header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted">3D Robot Playback</p>
            <p className="text-sm font-bold text-slate-200">합성 데이터 기반 로봇 동작 시뮬레이션</p>
          </div>
          {/* data-source: which pipeline mode produced the current dataset */}
          {mode && (
            <span className={clsx('text-[9px] font-black px-2 py-1 rounded-full border',
              mode.mock ? 'border-emerald-600/40 text-emerald-400 bg-emerald-900/15'
                        : 'border-amber-500/50 text-amber-300 bg-amber-900/15')}>
              {mode.mock ? 'MOCK 파이프라인' : 'REAL 파이프라인'}
            </span>
          )}
          {status?.running && (
            <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-nvidia/15 text-nvidia border border-nvidia/40 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-nvidia animate-pulse" />
              {status.stage?.toUpperCase()} 실행 중
            </span>
          )}
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
            <Canvas shadows camera={{ position: [2.8, 2.0, 3.2], fov: 42 }} dpr={[1, 2]} gl={{ antialias: true }}>
              <color attach="background" args={['#070b12']} />
              <fog attach="fog" args={['#070b12', 7, 20]} />
              <hemisphereLight intensity={0.28} color="#cfe8ff" groundColor="#0a0e08" />
              <ambientLight intensity={0.12} />
              <directionalLight position={[5, 8, 4]} intensity={1.4} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0001}>
                <orthographicCamera attach="shadow-camera" args={[-3, 3, 3, -3, 0.1, 20]} />
              </directionalLight>
              <directionalLight position={[-6, 3, -5]} intensity={0.6} color="#00d4ff" />
              <pointLight position={[0, 0.5, 0]} intensity={0.6} color="#76b900" distance={3.5} />

              {/* local light-probe environment (no network) for metal reflections */}
              <Environment resolution={256} frames={1}>
                <Lightformer intensity={2.2} position={[0, 5, 3]} scale={[8, 8, 1]} color="#ffffff" />
                <Lightformer intensity={1.0} position={[-5, 2, -4]} scale={[5, 5, 1]} color="#00d4ff" />
                <Lightformer intensity={0.7} position={[5, 1, 3]} scale={[4, 4, 1]} color="#76b900" />
              </Environment>

              <RobotArm angles={joints} eeRef={eeRef} showLabels={showLabels} />
              <EETracker targetRef={eeRef} onPos={setEePos} />

              {/* reflective floor for spatial depth */}
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
                <planeGeometry args={[50, 50]} />
                <MeshReflectorMaterial
                  resolution={512} mixBlur={1} mixStrength={18} blur={[200, 60]}
                  roughness={0.85} depthScale={1.1} minDepthThreshold={0.3} maxDepthThreshold={1.3}
                  color="#070b12" metalness={0.7} mirror={0.4}
                />
              </mesh>
              {/* subtle tech grid above the floor */}
              <Grid args={[24, 24]} cellSize={0.5} cellColor="#12200a" sectionSize={2} sectionColor="#223617" position={[0, 0.001, 0]} fadeDistance={18} fadeStrength={2} infiniteGrid />

              <OrbitControls enablePan={false} minDistance={1.8} maxDistance={9} target={[0, 1.15, 0]} autoRotate={!playing} autoRotateSpeed={0.5} />
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
                src={`${apiBase}/dataset/frame?idx=${rgbIdx}&v=${dataVersion}`}
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
                    src={`${apiBase}/dataset/frame?idx=${rgbIdx}&v=${dataVersion}`}
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
                {dJoints.slice(0, 7).map((v, i) => (
                  <Bar key={i} label={`J${i}`} value={v} max={0.8} color={JOINT_COLORS[i]} />
                ))}
              </div>
            </div>

            <div className="bg-panel border border-border rounded-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-wider text-muted mb-2">Policy Action · 7 DOF</p>
              <div className="flex flex-col gap-1.5">
                {dActions.slice(0, 7).map((v, i) => (
                  <Bar key={i} label={`A${i}`} value={v} max={1.0} color={JOINT_COLORS[i]} />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-panel border border-border rounded-xl p-3 flex flex-col gap-0.5">
                <p className="text-[9px] font-black uppercase tracking-wider text-muted">Reward</p>
                <p className="text-xl font-black font-mono" style={{ color: dReward >= 0 ? NV : '#ef4444' }}>{dReward.toFixed(3)}</p>
              </div>
              <div className="bg-panel border border-border rounded-xl p-3 flex flex-col gap-0.5">
                <p className="text-[9px] font-black uppercase tracking-wider text-muted">Frames</p>
                <p className="text-xl font-black font-mono text-slate-200">{count}</p>
                <p className="text-[9px] text-slate-500">of {traj?.n_total.toLocaleString() ?? '—'} (stride {traj?.stride ?? '—'})</p>
              </div>
            </div>

            <div className="bg-panel border border-border rounded-xl p-3">
              <p className="text-[9px] text-slate-500 leading-relaxed">
                {mode?.mock === false ? 'REAL' : 'MOCK'} 모드 <span className="text-nvidia font-bold">EXPORT</span>가 학습된 정책을 롤아웃해 만든 궤적
                (joint_state·action·reward)으로 이 3D가 구동됩니다. REAL 파이프라인 실행이 끝나면 <span className="text-nvidia font-bold">자동 갱신</span>됩니다.
                Unreal/Unity 연동 시 동일한 <span className="font-mono">joint_state[7]</span> 스트림을 본 로봇 리그에 매핑하면 됩니다.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
