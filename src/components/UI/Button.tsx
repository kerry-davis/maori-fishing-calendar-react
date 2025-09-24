import type { ButtonHTMLAttributes, FC, ReactNode } from 'react';
function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  loading?: boolean;
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

const variantClasses: Record<Variant, string> = {
  primary: 'btn btn-primary',
  secondary: 'btn btn-secondary',
  ghost: 'btn btn-ghost',
};

export const Button: FC<ButtonProps> = ({
  className,
  children,
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  loading = false,
  disabled,
  ...rest
}) => {
  const classes = cx(variantClasses[variant], sizeClasses[size], className);
  const isDisabled = disabled || loading;

  return (
    <button className={classes} disabled={isDisabled} {...rest}>
      {leftIcon && <span className="-ml-0.5">{leftIcon}</span>}
      <span className={cx('inline-flex items-center', loading && 'opacity-80')}>{children}</span>
      {loading && (
        <span className="ml-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
      )}
      {rightIcon && <span className="-mr-0.5">{rightIcon}</span>}
    </button>
  );
};

export default Button;
