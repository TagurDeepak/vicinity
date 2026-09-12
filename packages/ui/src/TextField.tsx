import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, id, className, ...props },
  ref,
) {
  const inputId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-ink-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={cn(
          'h-10 rounded-xl border border-surface-3 bg-surface-0 px-3 text-sm text-ink-900',
          'placeholder:text-ink-400 focus-visible:outline-none focus-visible:ring-2',
          'focus-visible:ring-brand-400',
          error && 'border-danger-500 focus-visible:ring-danger-400',
          className,
        )}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-xs text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
});
