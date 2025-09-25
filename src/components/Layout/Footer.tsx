import type { FC } from 'react';

const Footer: FC = () => {
  return (
    <footer className="mt-1 border-t border-gray-200/70 dark:border-white/10">
      <div className="container-pro py-6 text-center text-sm text-gray-600 dark:text-gray-400">
        <p>Māori Fishing Calendar • Based on traditional Māori lunar knowledge</p>
      </div>
    </footer>
  );
};

export default Footer;