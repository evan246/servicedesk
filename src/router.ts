import { useEffect, useState } from 'react';

export type Route = '/login' | '/' | '/my-requests' | '/dashboard';

function currentRoute(): Route {
  const hash = window.location.hash.replace(/^#/, '');
  if (hash === '/login') return '/login';
  if (hash === '/my-requests') return '/my-requests';
  if (hash === '/dashboard') return '/dashboard';
  return '/';
}

export function navigate(to: Route) {
  window.location.hash = to;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(currentRoute());
  useEffect(() => {
    const onChange = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
