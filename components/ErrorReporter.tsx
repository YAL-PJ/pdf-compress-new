'use client';

import { useEffect } from 'react';
import { installErrorReporter } from '@/lib/analytics';

export const ErrorReporter = () => {
  useEffect(() => {
    installErrorReporter();
  }, []);

  return null;
};
