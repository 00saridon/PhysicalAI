import { useEffect, useRef } from 'react'
import { clsx } from 'clsx'
import type { LogLine } from '../../types/pipeline'

const LEVEL_COLOR: Record<LogLine['level'], string> = {
  INFO: 'text-indigo-300',
  WARN: 'text-amber-400',
  ERROR: 'text-red-400',
  RL: 'text-violet-400',
  IL: 'text-sky-400',
  RAW: 'text-slate-400',
}

interface Props { lines: LogLine[]; connected: boolean }

export function LogPanel({ lines, connected }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const autoScroll = useRef(true)

  useEffect(() => {
    if (autoScroll.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [lines])

  function handleScroll() {
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    autoScroll.current = atBottom
  }

  return (
    <div className="bg-panel border border-border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-muted uppercase tracking-widest">Live Log</p>
        <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded', connected ? 'bg-emerald-900 text-emerald-400' : 'bg-slate-800 text-slate-500')}>
          {connected ? 'LIVE' : 'OFFLINE'}
        </span>
      </div>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="bg-[#0d1117] rounded-md p-3 font-mono text-[11px] h-36 overflow-y-auto flex flex-col gap-0.5"
      >
        {lines.map((line, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-slate-600 flex-shrink-0">
              {new Date(line.ts * 1000).toLocaleTimeString()}
            </span>
            <span className={clsx('flex-shrink-0', LEVEL_COLOR[line.level])}>[{line.level}]</span>
            <span className="text-slate-300 break-all">{line.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
