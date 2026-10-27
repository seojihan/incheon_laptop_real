import { useEffect, useState } from 'react';
import { Bell, CheckCheck, RefreshCw } from 'lucide-react';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../lib/db';
import { AppNotification, User } from '../types';

interface NotificationsViewProps {
  currentUser: User;
  onUnreadCountChange: (count: number) => void;
  onOpenRequest: (requestId: string) => void;
}

export default function NotificationsView({ currentUser, onUnreadCountChange, onOpenRequest }: NotificationsViewProps) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getNotifications(currentUser.id);
      setItems(data);
      onUnreadCountChange(data.filter((item) => !item.readAt).length);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '알림을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [currentUser.id]);

  const readOne = async (item: AppNotification) => {
    if (item.readAt) return;
    try {
      await markNotificationRead(item.id);
      const readAt = new Date().toISOString();
      const next = items.map((candidate) => candidate.id === item.id ? { ...candidate, readAt } : candidate);
      setItems(next);
      onUnreadCountChange(next.filter((candidate) => !candidate.readAt).length);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '알림 상태를 저장하지 못했습니다.');
    }
  };

  const readAll = async () => {
    try {
      await markAllNotificationsRead(currentUser.id);
      const readAt = new Date().toISOString();
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || readAt })));
      onUnreadCountChange(0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '알림 상태를 저장하지 못했습니다.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-9">
        <div>
          <h1 className="text-4xl font-black text-slate-900">알림</h1>
          <p className="text-slate-500 mt-2">신청 승인·반려·반납 처리 결과를 확인합니다.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold disabled:opacity-50"><RefreshCw className="w-4 h-4" />새로고침</button>
          <button type="button" onClick={() => void readAll()} disabled={!items.some((item) => !item.readAt)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-3 text-sm font-bold disabled:opacity-40"><CheckCheck className="w-4 h-4" />모두 읽음</button>
        </div>
      </div>

      {error && <div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">{error}</div>}
      {loading ? (
        <div className="py-24 text-center text-slate-400">알림을 불러오는 중입니다...</div>
      ) : items.length === 0 ? (
        <div className="py-24 rounded-3xl border-2 border-dashed border-slate-200 text-center"><Bell className="w-10 h-10 mx-auto text-slate-300 mb-4" /><p className="font-bold text-slate-500">아직 도착한 알림이 없습니다.</p></div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article key={item.id} className={`rounded-2xl border p-5 sm:p-6 transition ${item.readAt ? 'bg-white border-slate-200' : 'bg-blue-50 border-blue-200 shadow-sm'}`}>
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <p className="font-black text-slate-900">{item.title}</p>
                  <p className="text-sm text-slate-600 mt-2 leading-6">{item.message}</p>
                  <p className="text-xs text-slate-400 mt-3">{new Date(item.createdAt).toLocaleString('ko-KR')}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {!item.readAt && <span className="mr-1 inline-flex items-center gap-2 text-xs font-bold text-blue-800"><span className="h-2 w-2 rounded-full bg-blue-600" />읽지 않음</span>}
                  {!item.readAt && <button type="button" onClick={() => void readOne(item)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50">읽음 처리</button>}
                  {item.requestId && <button type="button" onClick={() => { void readOne(item).finally(() => onOpenRequest(item.requestId!)); }} className="rounded-xl bg-blue-700 px-3 py-2.5 text-xs font-black text-white hover:bg-blue-800">신청 내역 보기</button>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
