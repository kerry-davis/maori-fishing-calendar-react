import type { ButtonHTMLAttributes, FC, ReactNode } from 'react';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
  icon?: ReactNode;
}

export const IconButton: FC<IconButtonProps> = ({ className, label, icon, children, ...rest }) => {
  return (
    <button
      className={["icon-btn", className].filter(Boolean).join(' ')}
      aria-label={label}
      title={label}
      {...rest}
    >
      {icon ?? children}
    </button>
  );
};

export default IconButton;
