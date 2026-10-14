import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-xl border border-navy/[0.07] bg-white p-5 shadow-[0_1px_2px_rgba(13,32,64,0.04),0_8px_24px_-12px_rgba(13,32,64,0.08)]',
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-lg font-semibold text-navy', className)} {...props} />;
}
