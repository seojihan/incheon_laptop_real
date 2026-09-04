import { 
  Calendar, 
  History, 
  BookOpen, 
  Bell,
  HelpCircle,
  CheckSquare,
  ChevronRight,
  X,
  Settings as SettingsIcon,
  FileCheck2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ViewType, UserRole } from '../types';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  userRole: UserRole;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  unreadCount: number;
}

export default function Sidebar({ currentView, onViewChange, userRole, collapsed, onToggleCollapsed, mobileOpen, onCloseMobile, unreadCount }: SidebarProps) {
  const isTeacher = userRole === 'teacher';
  const isAdmin = userRole === 'admin';
  const isHelper = userRole === 'helper';
  
  let menuItems: { id: string; label: string; icon: any }[] = [];

  if (isTeacher || isAdmin) {
    // Teacher/Admin menu: focused on approval and inventory 관리
    menuItems = [
      { id: 'records', label: '대여 기록', icon: History },
      { id: 'notebook-inventory', label: '노트북 관리', icon: BookOpen },
      { id: 'admin-approval', label: '승인 관리', icon: CheckSquare },
      { id: 'notifications', label: '알림', icon: Bell },
      { id: 'info', label: '이용 안내', icon: HelpCircle },
      { id: 'terms', label: '이용약관', icon: FileCheck2 },
      { id: 'settings', label: '개인 설정', icon: SettingsIcon },
    ];
  } else if (isHelper) {
    // Helper menu: 학생형 대여 + 관리자형 승인/인벤토리
    menuItems = [
      { id: 'class-rental', label: '교과 대여', icon: BookOpen },
      { id: 'home-rental', label: '가정에 대여', icon: Calendar },
      { id: 'records', label: '대여 기록', icon: History },
      { id: 'notebook-inventory', label: '노트북 관리', icon: BookOpen },
      { id: 'admin-approval', label: '승인 관리', icon: CheckSquare },
      { id: 'notifications', label: '알림', icon: Bell },
      { id: 'info', label: '이용 안내', icon: HelpCircle },
      { id: 'terms', label: '이용약관', icon: FileCheck2 },
      { id: 'settings', label: '개인 설정', icon: SettingsIcon },
    ];
  } else {
    // Student menu: full feature access
    const baseMenuItems = [
      { id: 'class-rental', label: '교과 대여', icon: BookOpen },
      { id: 'home-rental', label: '가정에 대여', icon: Calendar },
      { id: 'records', label: '대여 기록', icon: History },
      { id: 'notifications', label: '알림', icon: Bell },
      { id: 'info', label: '이용 안내', icon: HelpCircle },
      { id: 'terms', label: '이용약관', icon: FileCheck2 },
      { id: 'settings', label: '개인 설정', icon: SettingsIcon },
    ];
    menuItems = [...baseMenuItems];
  }

  const sidebarContent = (isMobile = false) => {
    const effectiveCollapsed = collapsed && !isMobile;
    return (
    <div className="flex flex-col h-full">
      <div className={cn("p-10 pb-12 flex items-center justify-between transition-all", effectiveCollapsed ? "justify-center px-4" : "gap-4")}> 
        {!effectiveCollapsed && !isMobile && (
          <button 
            type="button"
            onClick={onToggleCollapsed}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="사이드바 접기"
          >
            <ChevronRight className="w-4 h-4 text-white/60 hover:text-white transition-colors -rotate-180" />
          </button>
        )}
        
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black text-black shadow-[0_0_20px_rgba(255,255,255,0.1)] shrink-0 italic">
          JS
        </div>
        {!effectiveCollapsed && (
          <div className="flex flex-col overflow-hidden">
            <span className="font-black text-lg leading-tight whitespace-nowrap italic tracking-tighter">JUNGSAN</span>
            <span className="text-[10px] text-white/40 uppercase font-black tracking-[0.2em] whitespace-nowrap italic">ASSET DECK</span>
          </div>
        )}
      </div>

      <nav className="flex-1 px-4 flex flex-col gap-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              onViewChange(item.id as ViewType);
              if (isMobile) onCloseMobile();
            }}
            className={cn(
              "flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 group text-[11px] font-black uppercase tracking-widest italic relative",
              effectiveCollapsed ? "justify-center" : "",
              currentView === item.id 
                ? "bg-white text-black shadow-[0_10px_30px_-5px_rgba(255,255,255,0.2)]" 
                : "text-white/40 hover:bg-white/5 hover:text-white"
            )}
          >
            <item.icon className={cn(
              "w-4 h-4 shrink-0 transition-transform group-hover:scale-110",
              currentView === item.id ? "text-black" : "text-white/20 group-hover:text-white"
            )} />
            {!effectiveCollapsed && <span>{item.label}</span>}
            {item.id === 'notifications' && unreadCount > 0 && (
              <span className={cn('ml-auto min-w-5 h-5 px-1 rounded-full flex items-center justify-center text-[9px] not-italic', currentView === item.id ? 'bg-black text-white' : 'bg-blue-500 text-white')}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      {!effectiveCollapsed && (
        <div className="p-8 m-4 bg-white/5 rounded-2xl border border-white/5">
          <p className="text-[9px] text-white/20 font-black uppercase tracking-widest mb-1 italic">Role Identity</p>
          <p className="text-[10px] font-black text-white italic truncate tracking-wider">
            {userRole === 'admin' ? 'SYSTEM ADMINISTRATOR' : userRole === 'helper' ? 'MANAGEMENT HELPER' : userRole === 'teacher' ? 'AUTHORIZED TEACHER' : 'AUTHORIZED STUDENT'}
          </p>
        </div>
      )}
    </div>
    );
  };

  return (
    <>
      <aside className={cn(
        "hidden md:flex bg-black text-white border-r border-white/5 flex-col z-20 transition-all duration-500 flex-shrink-0",
        collapsed ? "w-20" : "w-64"
      )}>
        {sidebarContent(false)}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-slate-950/70" onClick={onCloseMobile} aria-hidden="true" />
          <div className="relative h-full w-72 bg-black text-white border-r border-white/5 shadow-2xl">
            <button
              type="button"
              onClick={onCloseMobile}
              className="absolute right-4 top-4 w-10 h-10 rounded-2xl bg-white text-black flex items-center justify-center shadow-xl hover:bg-slate-200 transition-all"
              aria-label="메뉴 닫기"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebarContent(true)}
          </div>
        </div>
      )}
    </>
  );
}
