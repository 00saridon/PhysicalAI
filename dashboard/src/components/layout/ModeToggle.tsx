import { clsx } from 'clsx'

interface Props {
  /** true = MOCK_MODE, false = REAL_MODE */
  mock: boolean
  onChange: (mock: boolean) => void
  /** disabled while a stage is running or a switch is in flight */
  disabled?: boolean
  pending?: boolean
}

const SEG = 'px-2.5 py-1 font-black uppercase tracking-wider transition-colors disabled:cursor-not-allowed'

export function ModeToggle({ mock, onChange, disabled, pending }: Props) {
  const title = disabled
    ? '실행 중에는 모드를 변경할 수 없습니다'
    : 'MOCK: 의존성 없이 모의 로그·메트릭 / REAL: 실제 run.py 파이프라인 실행'

  return (
    <div
      title={title}
      className={clsx(
        'hidden sm:flex items-center rounded-md border text-[10px] overflow-hidden select-none',
        mock ? 'border-emerald-700/60' : 'border-amber-600/60',
        pending && 'opacity-60'
      )}
    >
      <button
        type="button"
        disabled={disabled || mock}
        onClick={() => onChange(true)}
        className={clsx(
          SEG,
          mock
            ? 'bg-emerald-600 text-white'
            : 'bg-transparent text-slate-500 hover:text-emerald-300'
        )}
      >
        MOCK_MODE
      </button>
      <button
        type="button"
        disabled={disabled || !mock}
        onClick={() => onChange(false)}
        className={clsx(
          SEG,
          !mock
            ? 'bg-amber-600 text-white'
            : 'bg-transparent text-slate-500 hover:text-amber-300'
        )}
      >
        REAL_MODE
      </button>
    </div>
  )
}
