import { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Route,
  Routes,
  useParams,
} from 'react-router-dom';
import { api } from './api.ts';
import { AuthProvider, useAuth } from './auth.tsx';
import { I18nProvider, useI18n } from './i18n.tsx';
import { ThemeProvider } from './theme.tsx';
import { Avatar, LoadingScreen, ToastProvider } from './components/ui.tsx';
import { Setup } from './pages/Setup.tsx';
import { Login } from './pages/Login.tsx';
import { KidHome } from './pages/KidHome.tsx';
import { KidShop } from './pages/KidShop.tsx';
import { History } from './pages/History.tsx';
import { ParentHome } from './pages/ParentHome.tsx';
import { ParentQueue } from './pages/ParentQueue.tsx';
import { ParentCatalog } from './pages/ParentCatalog.tsx';
import { ParentFamily } from './pages/ParentFamily.tsx';
import { Settings } from './pages/Settings.tsx';
import './styles/base.css';
import './styles/components.css';

/** Parents viewing one kid's ledger from the overview screen. */
function KidHistoryRoute() {
  const { id } = useParams();
  return <History kidId={Number(id)} />;
}

function TabBar() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [waiting, setWaiting] = useState(0);

  // Poll the pending count so a parent sees a new request without a refresh.
  // 20s is frequent enough for a family app and costs almost nothing on a LAN.
  useEffect(() => {
    if (user?.role !== 'parent') return;
    let cancelled = false;
    const tick = () =>
      api
        .overview()
        .then((o) => {
          if (!cancelled) setWaiting(o.pendingSubmissions + o.pendingRedemptions);
        })
        .catch(() => undefined);
    void tick();
    const timer = setInterval(tick, 20_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user?.role]);

  const tabs =
    user?.role === 'parent'
      ? [
          { to: '/', icon: '🏠', label: t('parentHome'), badge: 0 },
          { to: '/queue', icon: '📋', label: t('navQueue'), badge: waiting },
          { to: '/catalog', icon: '⭐', label: t('navDeeds'), badge: 0 },
          { to: '/family', icon: '👨‍👩‍👧', label: t('navFamily'), badge: 0 },
          { to: '/settings', icon: '⚙️', label: t('navSettings'), badge: 0 },
        ]
      : [
          { to: '/', icon: '🏠', label: t('navHome'), badge: 0 },
          { to: '/shop', icon: '🎁', label: t('navShop'), badge: 0 },
          { to: '/history', icon: '📖', label: t('navHistory'), badge: 0 },
          { to: '/settings', icon: '⚙️', label: t('navSettings'), badge: 0 },
        ];

  return (
    <nav className="tabbar">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className={({ isActive }) => `tab ${isActive ? 'is-active' : ''}`}
        >
          <span className="tab-icon" aria-hidden>
            {tab.icon}
            {tab.badge > 0 && <span className="tab-dot">{tab.badge}</span>}
          </span>
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function TopBar() {
  const { t } = useI18n();
  const { user } = useAuth();
  return (
    <header className="topbar">
      <div className="row" style={{ gap: 'var(--s2)' }}>
        <span aria-hidden style={{ fontSize: '1.2rem' }}>
          ⭐
        </span>
        <span className="topbar-title">{t('appName')}</span>
      </div>
      {user && (
        <div className="row" style={{ gap: 'var(--s2)' }}>
          <span className="item-meta">{user.name}</span>
          <Avatar emoji={user.avatar} color={user.color} size="sm" />
        </div>
      )}
    </header>
  );
}

function AuthedApp() {
  const { user } = useAuth();
  const isParent = user!.role === 'parent';

  return (
    <div className="app-shell">
      <TopBar />
      <Routes>
        {isParent ? (
          <>
            <Route path="/" element={<ParentHome />} />
            <Route path="/queue" element={<ParentQueue />} />
            <Route path="/catalog" element={<ParentCatalog />} />
            <Route path="/family" element={<ParentFamily />} />
            <Route path="/kid/:id" element={<KidHistoryRoute />} />
          </>
        ) : (
          <>
            <Route path="/" element={<KidHome />} />
            <Route path="/shop" element={<KidShop />} />
            <Route path="/history" element={<History />} />
          </>
        )}
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <TabBar />
    </div>
  );
}

function Gate() {
  const { user, loading, needsSetup } = useAuth();
  if (loading) return <LoadingScreen />;
  if (needsSetup) return <Setup />;
  if (!user) return <Login />;
  return <AuthedApp />;
}

export default function App() {
  return (
    <I18nProvider>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <BrowserRouter>
              <Gate />
            </BrowserRouter>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}
