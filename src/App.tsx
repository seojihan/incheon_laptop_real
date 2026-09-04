import type { Session } from '@supabase/supabase-js';
import { AnimatePresence, motion } from 'motion/react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import ConfigurationView from './components/ConfigurationView';
import LoginView from './components/LoginView';
import ProfileSetupView from './components/ProfileSetupView';
import Sidebar from './components/Sidebar';
import TopNav from './components/TopNav';
import { getProfile, getSession, getUserRole, signOut as supabaseSignOut } from './lib/auth';
import { getNotifications } from './lib/db';
import { isDemoModeEnabled, isSupabaseConfigured, supabase } from './lib/supabase';
import { normalizeClassNum } from './lib/validation';
import { User, UserRole, ViewType } from './types';

const AdminApprovalView = lazy(() => import('./components/AdminApprovalView'));
const ClassRentalView = lazy(() => import('./components/ClassRentalView'));
const HomeRentalView = lazy(() => import('./components/HomeRentalView'));
const InfoView = lazy(() => import('./components/InfoView'));
const NotebookInventoryView = lazy(() => import('./components/NotebookInventoryView'));
const NotificationsView = lazy(() => import('./components/NotificationsView'));
const RecordsView = lazy(() => import('./components/RecordsView'));
const SettingsView = lazy(() => import('./components/SettingsView'));
const StudentGuideView = lazy(() => import('./components/StudentGuideView'));
const TermsView = lazy(() => import('./components/TermsView'));

interface PendingUser {
  id: string;
  email: string;
  name: string;
  assignedRole: UserRole;
}

const roleViews: Record<UserRole, ViewType[]> = {
  student: ['class-rental', 'home-rental', 'records', 'notifications', 'info', 'guide', 'terms', 'settings'],
  helper: ['class-rental', 'home-rental', 'records', 'notebook-inventory', 'admin-approval', 'notifications', 'info', 'guide', 'terms', 'settings'],
  teacher: ['records', 'notebook-inventory', 'admin-approval', 'notifications', 'info', 'guide', 'terms', 'settings'],
  admin: ['records', 'notebook-inventory', 'admin-approval', 'notifications', 'info', 'guide', 'terms', 'settings'],
};

const defaultView = (role: UserRole): ViewType => role === 'student' || role === 'helper' ? 'class-rental' : 'records';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [pendingUser, setPendingUser] = useState<PendingUser | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('class-rental');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [publicPage, setPublicPage] = useState<'login' | 'terms'>('login');

  const syncUserState = useCallback(async (session: Session | Record<string, any> | null) => {
    if (!session?.user) {
      setCurrentUser(null);
      setPendingUser(null);
      setUnreadCount(0);
      setPublicPage('login');
      return;
    }

    const profile = await getProfile(session.user.id);
    const assignedRole = getUserRole(session, profile) || 'student';
    const email = session.user.email || '';
    const fallbackName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || '';

    if (!profile) {
      setCurrentUser(null);
      setPendingUser({ id: session.user.id, email, name: fallbackName, assignedRole });
      setAuthError(null);
      return;
    }

    const classNum = normalizeClassNum(profile.class_num);
    const user: User = {
      id: session.user.id,
      name: profile.student_name || fallbackName || '사용자',
      email,
      role: profile.role,
      studentId: profile.student_id || undefined,
      classNum: classNum || undefined,
    };

    setPendingUser(null);
    setCurrentUser(user);
    setPublicPage('login');
    const savedView = window.localStorage.getItem(`icjs-last-view-${user.id}`) as ViewType | null;
    setCurrentView(savedView && roleViews[user.role].includes(savedView) ? savedView : defaultView(user.role));
    setAuthError(null);

    try {
      const notifications = await getNotifications(user.id);
      setUnreadCount(notifications.filter((item) => !item.readAt).length);
    } catch {
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      try {
        const session = await getSession();
        if (active) await syncUserState(session);
      } catch (caught) {
        if (active) {
          setCurrentUser(null);
          setPendingUser(null);
          setAuthError(caught instanceof Error ? caught.message : '인증 정보를 확인하지 못했습니다.');
        }
      } finally {
        if (active) setIsAuthChecking(false);
      }
    };
    void initialize();

    const subscription = isSupabaseConfigured
      ? supabase.auth.onAuthStateChange((_event, session) => {
          void syncUserState(session).catch((caught) => {
            if (active) setAuthError(caught instanceof Error ? caught.message : '로그인 상태를 갱신하지 못했습니다.');
          }).finally(() => { if (active) setIsAuthChecking(false); });
        }).data.subscription
      : null;

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [syncUserState]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const refreshUnread = () => {
      void getNotifications(currentUser.id)
        .then((notifications) => setUnreadCount(notifications.filter((item) => !item.readAt).length))
        .catch(() => undefined);
    };
    window.addEventListener('icjs:notifications-changed', refreshUnread);
    return () => window.removeEventListener('icjs:notifications-changed', refreshUnread);
  }, [currentUser]);

  const allowedViews = useMemo(() => currentUser ? roleViews[currentUser.role] : [], [currentUser]);

  const changeView = (view: ViewType) => {
    if (!currentUser || !allowedViews.includes(view)) return;
    setCurrentView(view);
    try { window.localStorage.setItem(`icjs-last-view-${currentUser.id}`, view); } catch { /* non-critical */ }
  };

  const handleLogout = async () => {
    setAuthError(null);
    try {
      await supabaseSignOut();
      setCurrentUser(null);
      setPendingUser(null);
      setUnreadCount(0);
      setPublicPage('login');
    } catch (caught) {
      setAuthError(caught instanceof Error ? caught.message : '로그아웃 중 오류가 발생했습니다.');
    }
  };

  if (!isSupabaseConfigured && !isDemoModeEnabled) return <ConfigurationView />;

  if (isAuthChecking) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm font-bold text-slate-500" role="status">인증 정보를 확인 중입니다...</div>;
  }

  if (pendingUser) {
    return (
      <ProfileSetupView
        pendingUser={pendingUser}
        assignedRole={pendingUser.assignedRole}
        onProfileSaved={(user) => {
          setPendingUser(null);
          setCurrentUser(user);
          setCurrentView(defaultView(user.role));
        }}
        onLogout={handleLogout}
      />
    );
  }

  if (!currentUser) {
    if (publicPage === 'terms') {
      return (
        <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
          <Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center text-sm font-bold text-slate-400" role="status">약관을 불러오는 중입니다...</div>}>
            <TermsView onBack={() => setPublicPage('login')} />
          </Suspense>
        </div>
      );
    }
    return <LoginView authError={authError} onAuthError={setAuthError} onAuthSuccess={(session) => void syncUserState(session)} onOpenTerms={() => setPublicPage('terms')} />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'class-rental': return <ClassRentalView currentUser={currentUser} />;
      case 'home-rental': return <HomeRentalView currentUser={currentUser} />;
      case 'records': return <RecordsView currentUser={currentUser} />;
      case 'notebook-inventory': return <NotebookInventoryView currentUser={currentUser} />;
      case 'admin-approval': return <AdminApprovalView currentUser={currentUser} />;
      case 'settings': return <SettingsView currentUser={currentUser} onProfileUpdated={setCurrentUser} />;
      case 'notifications': return <NotificationsView currentUser={currentUser} onUnreadCountChange={setUnreadCount} />;
      case 'info': return <InfoView currentUser={currentUser} onOpenStudentGuide={() => changeView('guide')} onOpenTerms={() => changeView('terms')} />;
      case 'guide': return <StudentGuideView onBack={() => changeView('info')} />;
      case 'terms': return <TermsView onBack={() => changeView('info')} />;
    }
  };

  return (
    <div className="flex h-dvh bg-slate-50 text-slate-800 font-sans overflow-hidden">
      <Sidebar
        currentView={currentView}
        onViewChange={changeView}
        userRole={currentUser.role}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        unreadCount={unreadCount}
      />

      <main className="flex-1 flex flex-col relative overflow-hidden bg-slate-50 min-h-0">
        <TopNav
          user={currentUser}
          onLogout={handleLogout}
          onViewChange={changeView}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          unreadCount={unreadCount}
        />

        {!isOnline && <div role="status" className="bg-amber-100 border-b border-amber-200 px-4 py-2 text-center text-xs font-bold text-amber-800">오프라인 상태입니다. 저장 작업은 연결이 복구된 후 다시 시도해주세요.</div>}

        <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-10 relative" id="main-content">
          <AnimatePresence mode="wait">
            <motion.div key={currentView} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }} className="min-h-full">
              <Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center text-sm font-bold text-slate-400" role="status">화면을 불러오는 중입니다...</div>}>
                {renderView()}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
