'use client';

import { useEffect } from 'react';
import { Amplify } from 'aws-amplify';
import outputs from '@/amplify_outputs.json';

export default function ConfigureAmplifyClientSide() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      Amplify.configure(outputs, { ssr: true });
    }
  }, []);

  return null;
}