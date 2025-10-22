import type { FC, HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  header?: ReactNode;
  footer?: ReactNode;
  padded?: boolean;
}

export const Card: FC<CardProps> = ({ className, header, footer, children, padded = true, ...rest }) => {
  return (
    <div className={["card", className].filter(Boolean).join(' ')} {...rest}>
      {header && <div className="px-6 py-4 sm:px-8 sm:py-5 border-b border-gray-100/80 dark:border-white/10">{header}</div>}
      <div className={padded ? 'card-padding' : undefined}>{children}</div>
      {footer && <div className="px-6 py-4 sm:px-8 sm:py-5 border-t border-gray-100/80 dark:border-white/10">{footer}</div>}
    </div>
  );
};

export default Card;
