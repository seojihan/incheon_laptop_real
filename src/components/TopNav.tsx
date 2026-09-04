import { LogOut, Bell, Monitor, Menu } from 'lucide-react';
import { User, ViewType } from '../types';

interface TopNavProps {
  user: User;
  onLogout: () => void;
  onViewChange: (view: ViewType) => void;
  onOpenMobileSidebar: () => void;
  unreadCount: number;
}

export default function TopNav({ user, onLogout, onViewChange, onOpenMobileSidebar, unreadCount }: TopNavProps) {
  return (
    <header className="h-20 border-b border-black/5 flex items-center justify-between px-4 md:px-10 bg-white z-10 sticky top-0">
      <div className="flex items-center gap-4 md:gap-5 w-full">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="md:hidden p-2 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 transition-colors"
          aria-label="메뉴 열기"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden md:flex items-center gap-5">
          <div className="flex flex-col text-left">
            <span className="text-[9px] text-black/30 uppercase tracking-[0.2em] font-black italic">{user.role === 'teacher' ? 'AUTHORIZED TEACHER' : user.role === 'admin' ? 'SYSTEM ADMINISTRATOR' : user.role === 'helper' ? 'MANAGEMENT HELPER' : 'AUTHENTICATED USER'}</span>
            <span className="text-sm font-black text-black italic leading-tight">
              {user.role === 'teacher' ? `선생님 — ${user.name}` : user.classNum ? `${parseInt(user.classNum, 10)}반` : user.studentId ? user.studentId : '권한 사용자'} {user.role !== 'teacher' && `— ${user.name}`}
            </span>
          </div>
          <div className="w-px h-6 bg-black/5 mx-2" />
        </div>

        <div className="ml-auto flex items-center gap-3 md:gap-5">
          <button
            type="button"
            onClick={onLogout}
            aria-label="로그아웃"
            className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-2xl bg-black text-white text-[10px] font-black hover:bg-zinc-800 transition-all shadow-xl active:scale-95 italic uppercase tracking-widest"
          >
            <LogOut className="w-3 h-3" />
            <span className="hidden sm:inline">SIGN OUT</span>
          </button>

          <button 
              type="button"
              onClick={() => onViewChange('notifications')}
              aria-label={`알림 ${unreadCount}개`}
              className="w-11 h-11 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center hover:bg-zinc-100 transition-colors relative group"
            >
              <Bell className="w-4.5 h-4.5 text-black group-hover:scale-110 transition-transform" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-blue-600 text-white rounded-full border-2 border-white text-[9px] font-black flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
        </div>
      </div>

      <div className="hidden md:flex items-center">
        <div className="text-right">
          <h2 className="text-2xl font-black text-black italic tracking-tighter leading-none">JS DIGITAL</h2>
          <p className="text-[10px] font-black text-black/20 uppercase tracking-[0.3em] mt-1 italic">Asset Management System</p>
        </div>
        <div className="ml-6 w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-2xl group transition-transform hover:scale-105">
          <Monitor className="text-white w-6 h-6" />
        </div>
      </div>
    </header>
  );
}
