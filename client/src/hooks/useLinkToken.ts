import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { linkToken } from '../lib/auth-forms';

export function useLinkToken() {
  const [params, setParams] = useSearchParams();
  const [token] = useState(() => {
    const result = linkToken.safeParse(new URLSearchParams(window.location.hash.slice(1)).get('token') ?? params.get('token'));
    return result.success ? result.data : null;
  });

  useEffect(() => {
    if (!params.has('token') && !new URLSearchParams(window.location.hash.slice(1)).has('token')) return;
    const sanitized = new URLSearchParams(params);
    sanitized.delete('token');
    setParams(sanitized, { replace: true });
  }, [params, setParams]);

  return token;
}
