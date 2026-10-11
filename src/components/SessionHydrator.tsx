'use client';

import { useEffect } from 'react';
import { useSession } from '@/store/session';

export default function SessionHydrator() {
  useEffect(() => {
    void useSession.persist.rehydrate();
  }, []);
  return null;
}
