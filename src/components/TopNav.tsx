import { useState } from 'react';
import {
  Bell,
  BookOpen,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  CircleHelp,
  FileCheck2,
  Home,
  Laptop,
  LogOut,
  Menu,
  NotebookTabs,
  Settings2,
  X,
} from 'lucide-react';
import { User, UserRole, ViewType } from '../types';
import { cn } from '../lib/utils';
import SchoolLogo from './SchoolLogo';

interface TopNavProps {
  user: User;
  currentView: ViewType;
  onLogout: () => void;
  onViewChange: (view: ViewType) => void;
  unreadCount: number;
}

interface NavigationItem {
  id: ViewType;
  label: string;
  description: string;
  icon: typeof Home;
}

const getNavigationItems = (role: UserRole): NavigationItem[] => {
  const items: NavigationItem[] = [
    { id: 'home', label: '홈', description: '서비스 첫 화면', icon: Home },
  ];

  if (role === 'student' || role === 'helper') {
    items.push(
      { id: 'class-rental', label: '교과 대여', description: '요일과 교시를 골라 신청', icon: BookOpen },
      { id: 'home-rental', label: '가정 대여', description: '학습용 장기 대여 신청', icon: CalendarDays },
    );
  }

  items.push({ id: 'records', label: '대여 기록', description: '신청부터 반납까지 확인', icon: NotebookTabs });

  if (role !== 'student') {
    items.push(
      { id: 'notebook-inventory', label: '노트북 현황', description: '장비 상태와 배정 현황', icon: Laptop },
      { id: 'admin-approval', label: '승인 관리', description: '대기 중인 신청 검토', icon: CheckSquare },
    );
  }

  items.push(
    { id: 'notifications', label: '알림', description: '신청 결과와 처리 알림', icon: Bell },
    { id: 'info', label: '이용 안내', description: '역할별 이용 절차', icon: CircleHelp },
    { id: 'guide', label: '학생 가이드', description: '신청과 장비 이용 방법', icon: BookOpen },
    { id: 'terms', label: '이용약관', description: '서비스 이용 기준', icon: FileCheck2 },
    { id: 'settings', label: '개인 설정', description: '신청에 쓰는 내 정보', icon: Settings2 },
  );

  return items;
};

const primaryItems = (items: NavigationItem[], role: UserRole) => {
  const ids: ViewType[] = role === 'student' || role === 'helper'
    ? ['home', 'class-rental', 'home-rental', 'records']
    : ['home', 'records', 'notebook-inventory', 'admin-approval'];
  return ids.map((id) => items.find((item) => item.id === id)).filter((item): item is NavigationItem => Boolean(item));
};

export default function TopNav({ user, currentView, onLogout, onViewChange, unreadCount }: TopNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const items = getNavigationItems(user.role);
  const primary = primaryItems(items, user.role);
  const roleLabel: Record<UserRole, string> = {
    student: '학생',
    helper: '관리 도우미',
    teacher: '교사',
    admin: '관리자',
  };

  const navigate = (view: ViewType) => {
    onViewChange(view);
    setMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-10">
        <button type="button" onClick={() => navigate('home')} className="group flex shrink-0 items-center gap-3 rounded-2xl text-left" aria-label="중산고 노트북 포털 홈">
          <SchoolLogo className="h-11 w-11 shadow-lg shadow-blue-900/15 transition-transform group-hover:-rotate-3" />
          <span className="hidden min-[420px]:block">
            <span className="block text-sm font-black tracking-tight text-slate-900 sm:text-base">인천중산고 노트북 포털</span>
            <span className="mt-0.5 block text-[9px] font-extrabold tracking-[0.18em] text-slate-400">INCHEON JUNG SAN HIGH SCHOOL</span>
          </span>
        </button>

        <nav aria-label="주 메뉴" className="ml-5 hidden flex-1 items-center justify-center gap-1 xl:flex">
          {primary.map((item) => {
            const Icon = item.icon;
            const active = currentView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-bold transition-colors',
                  active ? 'bg-blue-50 text-blue-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )}
              >
                <Icon className="h-4 w-4" />{item.label}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => navigate('notifications')}
            aria-label={`알림 ${unreadCount}개`}
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unreadCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-orange-500 px-1 text-[9px] font-black text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </button>
          <button type="button" onClick={() => navigate('settings')} className="hidden items-center gap-2 rounded-full py-1 pl-1 pr-3 text-left transition hover:bg-slate-100 sm:flex" aria-label="개인 설정 열기">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-sm font-black text-amber-900">{user.name.trim().slice(0, 1) || '나'}</span>
            <span className="hidden max-w-32 lg:block">
              <span className="block truncate text-xs font-extrabold text-slate-800">{user.name}</span>
              <span className="block text-[10px] font-semibold text-slate-500">{roleLabel[user.role]}</span>
            </span>
          </button>
          <button type="button" onClick={onLogout} className="hidden items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 lg:inline-flex">
            <LogOut className="h-4 w-4" /> 로그아웃
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? '전체 메뉴 닫기' : '전체 메뉴 열기'}
            aria-expanded={menuOpen}
            aria-controls="all-navigation-menu"
            className="flex h-10 items-center gap-2 rounded-full bg-slate-900 px-3.5 text-xs font-bold text-white transition hover:bg-blue-800 sm:px-4"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            <span className="hidden sm:inline">전체 메뉴</span>
            <ChevronDown className={cn('hidden h-3.5 w-3.5 transition-transform sm:block', menuOpen && 'rotate-180')} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div id="all-navigation-menu" className="absolute left-0 right-0 top-full border-b border-slate-200 bg-white shadow-xl shadow-slate-900/10">
          <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-10">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-blue-700">Main menu</p>
                <h2 className="mt-1 text-lg font-black text-slate-900">무엇을 도와드릴까요?</h2>
              </div>
              <button type="button" onClick={onLogout} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 lg:hidden"><LogOut className="h-4 w-4" />로그아웃</button>
            </div>
            <nav aria-label="전체 메뉴" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.id} type="button" onClick={() => navigate(item.id)} className={cn('group flex min-h-20 items-center gap-3 rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md sm:p-4', currentView === item.id ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/50')}>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm ring-1 ring-slate-100"><Icon className="h-[18px] w-[18px]" /></span>
                    <span className="min-w-0"><span className="block text-xs font-black text-slate-900 sm:text-sm">{item.label}</span><span className="mt-1 block truncate text-[10px] font-medium text-slate-500 sm:text-[11px]">{item.description}</span></span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
