import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { cn } from 'cn'

type Props = Omit<React.ComponentProps<'input'>, 'type'>

/** Campo de senha com botão mostrar/ocultar (Figma: ícone "Hide"). */
export function PasswordInput({ className, ...props }: Props) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input {...props} type={visible ? 'text' : 'password'} className={cn(className, 'pr-12')} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label="Mostrar senha"
        aria-pressed={visible}
        className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {visible ? <Eye className="size-5" aria-hidden /> : <EyeOff className="size-5" aria-hidden />}
      </button>
    </div>
  )
}
