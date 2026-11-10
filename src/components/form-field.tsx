import { useId } from 'react'
import { cn } from 'cn'

export interface FieldControlProps {
  id: string
  name: string
  'aria-invalid': boolean
  'aria-describedby'?: string
  'aria-required'?: boolean
}

interface Props {
  name: string
  label: string
  error?: string
  hint?: string
  required?: boolean
  /** Rótulo visualmente oculto (o placeholder do Figma fica no campo). */
  hideLabel?: boolean
  className?: string
  children: (control: FieldControlProps) => React.ReactNode
}

/** Label + controle + mensagem de erro associada (aria-describedby/aria-invalid). */
export function FormField({ name, label, error, hint, required, hideLabel, className, children }: Props) {
  const id = useId()
  const errorId = `${id}-erro`
  const hintId = `${id}-dica`
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className={cn('text-sm leading-4 md:text-base', hideLabel && 'sr-only')}>
        {label}
        {required && (
          <span className="text-brand" aria-hidden>
            {' '}
            *
          </span>
        )}
      </label>
      {children({ id, name, 'aria-invalid': !!error, 'aria-describedby': describedBy, 'aria-required': required || undefined })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

export const inputClass =
  'h-10 w-full rounded-md border border-input bg-transparent px-4 text-sm outline-none placeholder:text-subtle focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 max-md:h-[50px] max-md:rounded-[10px] max-md:border-transparent max-md:bg-card max-md:aria-invalid:border-destructive'
