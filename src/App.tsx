import { useEffect } from 'react';
import { AuthProvider, useAuth } from './auth';
import { useRoute, navigate, type Route } from './router';
import Sidebar, { DesktopNotificationPrompt } from './components/Sidebar';
import Login from './pages/Login';
import NewRequest from './pages/NewRequest';
import MyRequests from './pages/MyRequests';
import Dashboard from './pages/Dashboard';

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}

function Shell() {
  const { user, profile, loading } = useAuth();
  const route = useRoute();

  const target = resolveRoute(route, !!user, profile?.role);

  useEffect(() => {
    if (!loading && target !== route) {
      navigate(target);
    }
  }, [loading, target, route]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-cream-300 border-t-teal-600" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen lg:pl-64">
      <Sidebar />
      <main className="pb-16 lg:pb-0">
        {target === '/dashboard' ? (
          <Dashboard />
        ) : target === '/my-requests' ? (
          <MyRequests />
        ) : (
          <NewRequest />
        )}
      </main>
      <DesktopNotificationPrompt />
    </div>
  );
}

function resolveRoute(route: Route, hasUser: boolean, role: 'teacher' | 'it_staff' | undefined): Route {
  if (!hasUser) return '/login';
  if (route === '/login') return role === 'it_staff' ? '/dashboard' : '/';
  if (route === '/dashboard' && role !== 'it_staff') return '/';
  if (route === '/' && role === 'it_staff') return '/dashboard';
  return route;
}
