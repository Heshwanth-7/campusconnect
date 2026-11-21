import { useEffect, useState } from 'react';
import { getEvent } from '../api/events';
import type { CampusEvent } from '../api/events';
import { errorMessage } from '../lib/auth-forms';

export function useEvent(id?: string) {
  const [result, setResult] = useState<{ id: string; event?: CampusEvent; error?: string }>();
  useEffect(() => {
    if (!id) return;
    let active = true;
    void getEvent(id).then(
      (event) => { if (active) setResult({ id, event }); },
      (error: unknown) => { if (active) setResult({ id, error: errorMessage(error) }); },
    );
    return () => { active = false; };
  }, [id]);
  return result?.id === id ? result : undefined;
}
