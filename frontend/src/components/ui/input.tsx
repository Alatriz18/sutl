import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full rounded-md border border-navy/20 px-3 py-2 text-sm text-navy placeholder:text-navy/40 focus:border-sky focus:outline-none focus:ring-1 focus:ring-sky',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
