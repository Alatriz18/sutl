import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}

const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-navy text-white shadow-sm shadow-navy/20 hover:bg-navy/90 hover:shadow-md hover:shadow-navy/25',
  secondary: 'bg-sky text-white shadow-sm shadow-sky/25 hover:bg-sky/90 hover:shadow-md hover:shadow-sky/30',
  ghost: 'bg-transparent text-navy hover:bg-navy/5',
  danger: 'bg-red-600 text-white shadow-sm shadow-red-600/20 hover:bg-red-700',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:active:scale-100',
        variants[variant],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
