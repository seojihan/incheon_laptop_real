import type { Session } from '@supabase/supabase-js';
import { AnimatePresence, motion } from 'motion/react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ConfigurationView from './components/ConfigurationView';
import LoginView from './components/LoginView';
import ProfileSetupView from './components/ProfileSetupView';
import TopNav from './components/TopNav';
import { getLoginIntent, getProfile, getSession, getUserRole, signOut as supabaseSignOut } from './lib/auth';
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
const HomeDashboard = lazy(() => import('./components/HomeDashboard'));

interface PendingUser {
  id: string;
  email: string;
  name: string;
  assignedRole: UserRole;
  isArchived?: boolean;
  switchingFromTeacher?: boolean;
}

const roleViews: Record<UserRole, ViewType[]> = {
  student: ['home', 'class-rental', 'home-rental', 'records', 'notifications', 'info', 'guide', 'terms', 'settings'],
  helper: ['home', 'class-rental', 'home-rental', 'records', 'notebook-inventory', 'admin-approval', 'notifications', 'info', 'guide', 'terms', 'settings'],
  teacher: ['home', 'records', 'notebook-inventory', 'admin-approval', 'notifications', 'info', 'guide', 'terms', 'settings'],
  admin: ['home', 'records', 'notebook-inventory', 'admin-approval', 'notifications', 'info', 'guide', 'terms', 'settings'],
};

const defaultView = (_role: UserRole): ViewType => 'home';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [pendingUser, setPendingUser] = useState<PendingUser | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [requestedRecordId, setRequestedRecordId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [publicPage, setPublicPage] = useState<'login' | 'terms'>('login');
  const authSyncVersion = useRef(0);
  const signedOutRef = useRef(false);

  const syncUserState = useCallback(async (session: Session | Record<string, any> | null) => {
    if (signedOutRef.current && session?.user) return;
    const syncVersion = ++authSyncVersion.current;
    if (!session?.user) {
      setCurrentUser(null);
      setPendingUser(null);
      setUnreadCount(0);
      setRequestedRecordId(null);
      setPublicPage('login');
      return;
    }

    const profile = await getProfile(session.user.id);
    if (syncVersion !== authSyncVersion.current) return;
    const assignedRole = getUserRole(session, profile) || 'student';
    const loginIntent = getLoginIntent();
    const switchingFromTeacher = loginIntent === 'student' && profile?.role === 'teacher';
    const studentIntentOverridesTeacherRole = loginIntent === 'student'
      && (profile?.role === 'teacher' || (!profile && assignedRole === 'teacher'));
    const email = session.user.email || '';
    const fallbackName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || '';

    if (!profile || profile.archived_at || (loginIntent === 'teacher' && profile.role !== 'teacher' && profile.role !== 'admin') || studentIntentOverridesTeacherRole || (profile.role === 'teacher' && (!profile.grade || !profile.class_num))) {
      setCurrentUser(null);
      setPendingUser({
        id: session.user.id,
        email,
        name: profile?.student_name || fallbackName,
        assignedRole: profile?.archived_at && loginIntent === 'student' ? 'student' : (loginIntent === 'teacher' ? 'teacher' : (studentIntentOverridesTeacherRole ? 'student' : assignedRole)),
        isArchived: Boolean(profile?.archived_at),
        switchingFromTeacher,
      });
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
      grade: profile.grade || undefined,
    };

    setPendingUser(null);
    setCurrentUser(user);
    setRequestedRecordId(null);
    setPublicPage('login');
    setCurrentView(defaultView(user.role));
    setAuthError(null);

    try {
      const notifications = await getNotifications(user.id);
      if (syncVersion === authSyncVersion.current) setUnreadCount(notifications.filter((item) => !item.readAt).length);
    } catch {
      if (syncVersion === authSyncVersion.current) setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      const initializationVersion = authSyncVersion.current;
      try {
        const session = await getSession();
        if (active && initializationVersion === authSyncVersion.current) await syncUserState(session);
      } catch (caught) {
        if (active && initializationVersion === authSyncVersion.current) {
          setCurrentUser(null);
          setPendingUser(null);
          setAuthError(caught instanceof Error ? caught.message : '인증 정보를 확인하지 못했습니다.');
        }
      } finally {
        if (active && initializationVersion === authSyncVersion.current) setIsAuthChecking(false);
      }
    };
    void initialize();

    const subscription = isSupabaseConfigured
      ? supabase.auth.onAuthStateChange((_event, session) => {
          if (signedOutRef.current && session?.user) return;
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
  };

  const handleLogout = async () => {
    signedOutRef.current = true;
    authSyncVersion.current += 1;
    setAuthError(null);
    setCurrentUser(null);
    setPendingUser(null);
    setUnreadCount(0);
    setRequestedRecordId(null);
    setPublicPage('login');
    setCurrentView('home');
    setIsAuthChecking(false);
    try {
      await supabaseSignOut();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '로그아웃 중 오류가 발생했습니다.';
      setAuthError(`${message} 브라우저의 로그인 상태는 정리했습니다.`);
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
    return <LoginView authError={authError} onAuthError={setAuthError} onAuthSuccess={(session) => { signedOutRef.current = false; void syncUserState(session); }} onOpenTerms={() => setPublicPage('terms')} />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'home': return <HomeDashboard currentUser={currentUser} unreadCount={unreadCount} onNavigate={changeView} />;
      case 'class-rental': return <ClassRentalView currentUser={currentUser} onOpenRecords={(requestId) => { if (requestId) setRequestedRecordId(requestId); changeView('records'); }} onOpenSettings={() => changeView('settings')} />;
      case 'home-rental': return <HomeRentalView currentUser={currentUser} onOpenRecords={(requestId) => { if (requestId) setRequestedRecordId(requestId); changeView('records'); }} onOpenSettings={() => changeView('settings')} />;
      case 'records': return <RecordsView currentUser={currentUser} initialRequestId={requestedRecordId} onRequestTargetHandled={() => setRequestedRecordId(null)} />;
      case 'notebook-inventory': return <NotebookInventoryView currentUser={currentUser} onOpenRecords={() => changeView('records')} />;
      case 'admin-approval': return <AdminApprovalView currentUser={currentUser} />;
      case 'settings': return <SettingsView currentUser={currentUser} onProfileUpdated={setCurrentUser} />;
      case 'notifications': return <NotificationsView currentUser={currentUser} onUnreadCountChange={setUnreadCount} onOpenRequest={(requestId) => { setRequestedRecordId(requestId); changeView('records'); }} />;
      case 'info': return <InfoView currentUser={currentUser} onOpenStudentGuide={() => changeView('guide')} onOpenTerms={() => changeView('terms')} />;
      case 'guide': return <StudentGuideView onBack={() => changeView('info')} />;
      case 'terms': return <TermsView onBack={() => changeView('info')} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#faf7f0] text-slate-800 font-sans">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-white focus:px-5 focus:py-3 focus:text-sm focus:font-bold focus:text-slate-900 focus:shadow-lg">본문으로 건너뛰기</a>
        <TopNav
          user={currentUser}
          currentView={currentView}
          onLogout={handleLogout}
          onViewChange={changeView}
          unreadCount={unreadCount}
        />

        {!isOnline && <div role="status" className="bg-amber-100 border-b border-amber-200 px-4 py-2 text-center text-xs font-bold text-amber-800">오프라인 상태입니다. 저장 작업은 연결이 복구된 후 다시 시도해주세요.</div>}

        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10" id="main-content">
          <AnimatePresence mode="wait">
            <motion.div key={currentView} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }} className="min-h-[60vh]">
              <Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center text-sm font-bold text-slate-400" role="status">화면을 불러오는 중입니다...</div>}>
                {renderView()}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
            <span className="font-bold text-slate-700">인천중산고 노트북 포털</span>
            <span>대여 신청 · 장비 확인 · 안전한 반납</span>
          </div>
        </footer>
    </div>
  );
}
