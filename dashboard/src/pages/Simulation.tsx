import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, Environment, Lightformer, MeshReflectorMaterial } from '@react-three/drei'
import { clsx } from 'clsx'
import * as THREE from 'three'
import { api } from '../api/client'
import { usePipelineMode, usePipelineStatus } from '../hooks/usePipeline'
import { MODELS, MODEL_ICON, EETracker, JOINT_COLORS, simSelection } from '../sim/models'

const NV = '#76b900'

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
  const { data: mode } = usePipelineMode()
  const { data: status } = usePipelineStatus()

  // selected robot model (Isaac Lab showroom-style library; Demos can deep-link)
  const [modelId, setModelId] = useState(() => simSelection.id)
  const model = MODELS.find(m => m.id === modelId) ?? MODELS[0]
  const Model = model.Component

  // load the selected model's trajectory (only for models that have a dataset)
  const { data: traj, isError } = useQuery({
    queryKey: ['trajectory', model.dataset ?? null],
    queryFn: () => api.getTrajectory(model.dataset ?? 'synthetic_v1', 240),
    enabled: !!model.dataset,
    refetchInterval: 10000,
    retry: false,
  })

  // pull fresh data into the (data-driven) model when a REAL stage finishes
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

  useEffect(() => { if (frame >= count) setFrame(0) }, [count]) // eslint-disable-line

  const lastRef = useRef(0)
  useEffect(() => {
    if (!playing || count === 0) return
    let raf = 0
    const step = (t: number) => {
      const fps = 24 * speed
      if (t - lastRef.current >= 1000 / fps) { setFrame(f => (f + 1) % count); lastRef.current = t }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed, count])

  const joints = traj?.joints[frame] ?? new Array(7).fill(0)
  const phase = count ? frame / count : 0

  const apiBase = (import.meta.env.VITE_API_URL ?? '') + '/api'
  const frameRef = useRef(0)
  frameRef.current = frame
  const [rgbIdx, setRgbIdx] = useState(0)
  useEffect(() => {
    if (!traj?.has_rgb) return
    const id = setInterval(() => setRgbIdx(frameRef.current * (traj.stride || 1)), 150)
    return () => clearInterval(id)
  }, [traj])

  const [displayFrame, setDisplayFrame] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setDisplayFrame(frameRef.current), 200)
    return () => clearInterval(id)
  }, [])
  const dJoints = traj?.joints[displayFrame] ?? new Array(7).fill(0)
  const dActions = traj?.actions[displayFrame] ?? new Array(7).fill(0)
  const dReward = traj?.rewards[displayFrame] ?? 0

  const wantsData = model.dataDriven
  const hasData = !!traj && !isError
  const effDataDriven = wantsData && hasData
  const dataDriven = effDataDriven
  const showTelemetry = effDataDriven
  const showRgbCard = effDataDriven && !!traj?.has_rgb && !compare
  const showCompare = effDataDriven && compare && !!traj?.has_rgb

  return (
    <div className="p-3 sm:p-5 flex flex-col gap-3 h-full min-h-0">
      {/* header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted">Robot Showroom · 3D Playback</p>
            <p className="text-sm font-bold text-slate-200">Isaac Lab 스타일 로봇 모델 시뮬레이션</p>
          </div>
          {mode && (
            <span className={clsx('text-[9px] font-black px-2 py-1 rounded-full border',
              mode.mock ? 'border-emerald-600/40 text-emerald-400 bg-emerald-900/15' : 'border-amber-500/50 text-amber-300 bg-amber-900/15')}>
              {mode.mock ? 'MOCK 파이프라인' : 'REAL 파이프라인'}
            </span>
          )}
          {status?.running && (
            <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-nvidia/15 text-nvidia border border-nvidia/40 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-nvidia animate-pulse" />{status.stage?.toUpperCase()} 실행 중
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <button onClick={() => setShowLabels(v => !v)}
            className={clsx('px-2 py-1 rounded-full border font-bold transition-colors',
              showLabels ? 'border-nvidia/40 text-nvidia bg-nvidia/10' : 'border-border text-slate-500 hover:text-slate-300')}>
            관절 라벨
          </button>
          {dataDriven && traj?.has_rgb && (
            <button onClick={() => setCompare(v => !v)}
              className={clsx('px-2 py-1 rounded-full border font-bold transition-colors',
                compare ? 'border-cyan-400/40 text-cyan-300 bg-cyan-500/10' : 'border-border text-slate-500 hover:text-slate-300')}>
              RGB 비교 뷰
            </button>
          )}
          <span className="hidden sm:inline px-2 py-1 rounded-full border border-border text-slate-400 font-bold">{model.category} · {model.dof} DOF</span>
        </div>
      </div>

      {/* model library selector (add models in src/sim/models.tsx) */}
      <div className="flex flex-wrap gap-2">
        {MODELS.map(m => (
          <button key={m.id} onClick={() => { setModelId(m.id); simSelection.id = m.id; setCompare(false) }}
            className={clsx('flex items-center gap-2.5 pl-2.5 pr-3 py-1.5 rounded-lg border text-left transition-all',
              m.id === modelId ? 'border-nvidia/50 bg-nvidia/10 shadow-sm shadow-nvidia/10' : 'border-border bg-panel hover:border-slate-600')}>
            <span className="text-lg leading-none">{MODEL_ICON[m.id] ?? '🤖'}</span>
            <div>
              <p className={clsx('text-[11px] font-bold leading-tight', m.id === modelId ? 'text-nvidia' : 'text-slate-200')}>{m.name}</p>
              <p className="text-[8px] text-muted">{m.category} · {m.dof} DOF · {m.dataDriven ? 'data' : 'proc'}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 min-h-0">
        {/* viewport cell: 3D, or 3D + RGB side-by-side */}
        <div className="flex flex-col sm:flex-row gap-4 min-h-0">
          <div className="relative flex-1 rounded-xl overflow-hidden border border-nvidia/25 bg-[#05080d] min-h-[360px]">
            <div className="absolute top-2 left-3 z-10 flex items-center gap-1.5 pointer-events-none">
              <span className="w-2 h-2 rounded-full bg-nvidia animate-pulse" />
              <span className="text-[9px] font-bold text-nvidia/70 uppercase tracking-widest">{model.name} · drag to orbit</span>
            </div>
            <div className="absolute top-2 right-3 z-10 text-[9px] font-mono text-slate-500 pointer-events-none">
              {dataDriven ? `frame ${frame + 1} / ${count}` : (playing ? '▶ playing' : '❚❚ paused')}
            </div>

            <Canvas key={model.id} shadows camera={{ position: model.camera, fov: 42 }} dpr={[1, 2]} gl={{ antialias: true }}>
              <color attach="background" args={['#070b12']} />
              <fog attach="fog" args={['#070b12', 7, 20]} />
              <hemisphereLight intensity={0.28} color="#cfe8ff" groundColor="#0a0e08" />
              <ambientLight intensity={0.12} />
              <directionalLight position={[5, 8, 4]} intensity={1.4} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0001}>
                <orthographicCamera attach="shadow-camera" args={[-3, 3, 3, -3, 0.1, 20]} />
              </directionalLight>
              <directionalLight position={[-6, 3, -5]} intensity={0.6} color="#00d4ff" />
              <pointLight position={[0, 0.5, 0]} intensity={0.6} color="#76b900" distance={3.5} />
              <Environment resolution={256} frames={1}>
                <Lightformer intensity={2.2} position={[0, 5, 3]} scale={[8, 8, 1]} color="#ffffff" />
                <Lightformer intensity={1.0} position={[-5, 2, -4]} scale={[5, 5, 1]} color="#00d4ff" />
                <Lightformer intensity={0.7} position={[5, 1, 3]} scale={[4, 4, 1]} color="#76b900" />
              </Environment>

              <Model joints={joints} phase={phase} playing={playing} speed={speed} dataDriven={effDataDriven} showLabels={showLabels} eeRef={eeRef} />
              {showTelemetry && <EETracker targetRef={eeRef} onPos={setEePos} />}

              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
                <planeGeometry args={[50, 50]} />
                <MeshReflectorMaterial resolution={512} mixBlur={1} mixStrength={18} blur={[200, 60]}
                  roughness={0.85} depthScale={1.1} minDepthThreshold={0.3} maxDepthThreshold={1.3}
                  color="#070b12" metalness={0.7} mirror={0.4} />
              </mesh>
              <Grid args={[24, 24]} cellSize={0.5} cellColor="#12200a" sectionSize={2} sectionColor="#223617" position={[0, 0.001, 0]} fadeDistance={18} fadeStrength={2} infiniteGrid />

              <OrbitControls enablePan={false} minDistance={1.2} maxDistance={9} target={model.target} autoRotate={!playing} autoRotateSpeed={0.5} />
            </Canvas>

            {/* transport controls */}
            <div className="absolute bottom-0 inset-x-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-3 flex items-center gap-3">
              <button onClick={() => setPlaying(p => !p)}
                className="w-9 h-9 rounded-full bg-nvidia hover:bg-nvidia/90 text-black font-bold flex items-center justify-center shrink-0">
                {playing ? '❚❚' : '▶'}
              </button>
              <input type="range" min={0} max={Math.max(0, count - 1)} value={frame}
                onChange={e => { setPlaying(false); setFrame(Number(e.target.value)) }}
                disabled={!dataDriven}
                className="flex-1 accent-[#76b900] disabled:opacity-40" />
              <div className="flex gap-1 shrink-0">
                {[0.5, 1, 2].map(s => (
                  <button key={s} onClick={() => setSpeed(s)}
                    className={clsx('text-[10px] font-bold px-2 py-1 rounded', speed === s ? 'bg-nvidia text-black' : 'bg-slate-800 text-slate-400 hover:text-slate-200')}>
                    {s}×
                  </button>
                ))}
              </div>
            </div>
          </div>

          {showCompare && (
            <div className="relative flex-1 rounded-xl overflow-hidden border border-cyan-400/30 bg-black min-h-[200px] sm:min-h-[360px] grid place-items-center">
              <div className="absolute top-2 left-3 z-10 flex items-center gap-1.5 pointer-events-none">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-[9px] font-bold text-cyan-300/80 uppercase tracking-widest">RGB Observation · 224×224</span>
              </div>
              <img src={`${apiBase}/dataset/frame?idx=${rgbIdx}&v=${dataVersion}&name=${model.dataset ?? 'synthetic_v1'}`} alt="synthetic RGB observation"
                className="w-full h-full object-contain" style={{ imageRendering: 'pixelated' }} />
            </div>
          )}
        </div>

        {/* side panel */}
        <div className="flex flex-col gap-3 overflow-y-auto">
          {/* model spec (always) */}
          <div className="bg-panel border border-border rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xl">{MODEL_ICON[model.id] ?? '🤖'}</span>
              <div>
                <p className="text-sm font-black text-slate-100 leading-tight">{model.name}</p>
                <p className="text-[9px] font-bold text-nvidia/80">{model.category} · {model.dof} DOF · {model.dataDriven ? 'policy-driven' : 'procedural'}</p>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">{model.desc}</p>
          </div>

          {showRgbCard && (
            <div className="bg-panel border border-border rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-black uppercase tracking-wider text-muted">RGB Observation · 224×224</p>
                <span className="text-[8px] font-mono text-slate-500">sensor cam</span>
              </div>
              <div className="rounded-lg overflow-hidden border border-nvidia/20 bg-black aspect-square">
                <img src={`${apiBase}/dataset/frame?idx=${rgbIdx}&v=${dataVersion}&name=${model.dataset ?? 'synthetic_v1'}`} alt="synthetic RGB observation"
                  className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
              </div>
            </div>
          )}

          {showTelemetry ? (
            <>
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
                  {dJoints.slice(0, 7).map((v, i) => <Bar key={i} label={`J${i}`} value={v} max={0.8} color={JOINT_COLORS[i]} />)}
                </div>
              </div>
              <div className="bg-panel border border-border rounded-xl p-3">
                <p className="text-[9px] font-black uppercase tracking-wider text-muted mb-2">Policy Action · 7 DOF</p>
                <div className="flex flex-col gap-1.5">
                  {dActions.slice(0, 7).map((v, i) => <Bar key={i} label={`A${i}`} value={v} max={1.0} color={JOINT_COLORS[i]} />)}
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
                  <p className="text-[9px] text-slate-500">of {traj?.n_total.toLocaleString() ?? '—'}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-panel border border-border rounded-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-wider text-muted mb-1">Showroom · Procedural</p>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                {wantsData && !hasData
                  ? '이 모델의 데이터셋이 없습니다 — EXPORT 실행 또는 outputs/dataset에 추가하면 정책 궤적으로 구동됩니다.'
                  : '이 모델은 Isaac Lab 쇼룸 스타일의 절차적 애니메이션으로 동작을 시연합니다. 재생/속도 컨트롤로 모션을 조절하세요. 실제 정책 궤적은 7-DOF Manipulator 모델에서 재생됩니다.'}
              </p>
            </div>
          )}

          <div className="bg-panel border border-border rounded-xl p-3">
            <p className="text-[9px] text-slate-500 leading-relaxed">
              모델은 <span className="font-mono text-nvidia">src/sim/models.tsx</span>의 레지스트리에 항목을 추가해 확장합니다.
              data-driven 모델은 정책 궤적으로, procedural 모델은 절차적 모션으로 구동됩니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
