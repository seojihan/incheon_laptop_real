import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, Home, RefreshCw } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { getNotebookInventory } from '../lib/db';
import { cn } from '../lib/utils';
import { NotebookInventoryItem, User } from '../types';

interface NotebookInventoryViewProps { currentUser: User }

export default function NotebookInventoryView({ currentUser }: NotebookInventoryViewProps) {
  const [notebooks, setNotebooks] = useState<NotebookInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedNotebook, setExpandedNotebook] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try { setNotebooks(await getNotebookInventory()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : '인벤토리를 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [currentUser.id]);

  const stats = useMemo(() => ({
    total: notebooks.length,
    available: notebooks.filter((item) => item.condition === 'available' && !item.activeRequest).length,
    homeRental: notebooks.filter((item) => item.activeRequest?.type === 'home').length,
    classRental: notebooks.filter((item) => item.activeRequest?.type === 'class').length,
    unavailable: notebooks.filter((item) => item.condition !== 'available').length,
  }), [notebooks]);

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-9">
        <div><span className="inline-flex px-3 py-1 rounded-full bg-blue-600 text-white text-[10px] font-black mb-3">노트북 관리</span><h1 className="text-4xl font-black text-slate-900">노트북 인벤토리</h1><p className="text-slate-500 mt-2">장비 상태와 현재 배정 정보를 확인합니다.</p></div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold disabled:opacity-50"><RefreshCw className="w-4 h-4" />새로고침</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        <Stat label="전체" value={stats.total} style="bg-white border-slate-200 text-slate-900" />
        <Stat label="대여 가능" value={stats.available} style="bg-emerald-50 border-emerald-100 text-emerald-700" />
        <Stat label="가정 대여" value={stats.homeRental} style="bg-amber-50 border-amber-100 text-amber-700" />
        <Stat label="교과 대여" value={stats.classRental} style="bg-blue-50 border-blue-100 text-blue-700" />
        <Stat label="점검·퇴역" value={stats.unavailable} style="bg-red-50 border-red-100 text-red-700" />
      </div>

      {error && <div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">{error}</div>}

      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-8 shadow-sm">
        {loading ? <div className="py-20 text-center text-slate-500" role="status">인벤토리를 불러오는 중입니다...</div> : notebooks.length === 0 ? <div className="py-20 text-center text-slate-500">등록된 노트북이 없습니다.</div> : (
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-10 gap-3">
            {notebooks.map((notebook) => {
              const status = notebook.condition !== 'available' ? 'unavailable' : notebook.activeRequest?.type === 'home' ? 'home' : notebook.activeRequest?.type === 'class' ? 'class' : 'available';
              return (
                <div key={notebook.number} className="relative">
                  <button type="button" onClick={() => setExpandedNotebook(expandedNotebook === notebook.number ? null : notebook.number)} aria-expanded={expandedNotebook === notebook.number} className={cn('w-full min-h-24 p-3 rounded-2xl border-2 font-black transition focus-visible:ring-2 focus-visible:ring-blue-500', status === 'available' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : status === 'home' ? 'bg-amber-50 border-amber-200 text-amber-700' : status === 'class' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-red-50 border-red-200 text-red-700')}>
                    <span className="text-xl italic">{notebook.number}</span><span className="block text-[9px] mt-1">{status === 'available' ? '대여 가능' : status === 'home' ? '가정 대여' : status === 'class' ? '교과 대여' : notebook.condition === 'maintenance' ? '점검 중' : '퇴역'}</span>
                  </button>
                  <AnimatePresence>{expandedNotebook === notebook.number && (
                    <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute z-40 top-full mt-2 left-0 w-64 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl text-left">
                      <p className="text-xs font-black text-slate-400 mb-3">{notebook.assetTag}</p>
                      {notebook.activeRequest ? <div className="text-sm text-slate-700 space-y-2"><p className="font-black text-slate-900">{notebook.activeRequest.userName} ({notebook.activeRequest.studentId})</p><p className="flex items-center gap-2">{notebook.activeRequest.type === 'home' ? <Home className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}{notebook.activeRequest.type === 'home' ? '가정 대여' : '교과 대여'}</p><p>{notebook.activeRequest.startDate}{notebook.activeRequest.endDate ? ` ~ ${notebook.activeRequest.endDate}` : ''}</p></div> : notebook.condition !== 'available' ? <p className="flex gap-2 text-sm text-red-700"><AlertTriangle className="w-4 h-4 shrink-0" />{notebook.note || '현재 대여할 수 없는 장비입니다.'}</p> : <p className="text-sm text-emerald-700 font-bold">현재 대여 가능합니다.</p>}
                    </motion.div>
                  )}</AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, style }: { label: string; value: number; style: string }) {
  return <div className={cn('border rounded-2xl p-5', style)}><p className="text-[10px] uppercase font-black opacity-70 mb-2">{label}</p><p className="text-3xl font-black italic">{value}</p></div>;
}
