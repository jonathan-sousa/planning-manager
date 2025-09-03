'use client';

import { Amplify } from 'aws-amplify';
import outputs from '@/amplify_outputs.json';

// Configure Amplify immédiatement, pas dans un useEffect
Amplify.configure(outputs, { 
  ssr: true 
});

export default function ConfigureAmplifyClientSide() {
  return null;
}