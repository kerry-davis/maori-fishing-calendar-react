import type { FC, HTMLAttributes } from 'react';

export const Container: FC<HTMLAttributes<HTMLDivElement>> = ({ className, children, ...rest }) => (
  <div className={["container-pro", className].filter(Boolean).join(' ')} {...rest}>{children}</div>
);

export default Container;
