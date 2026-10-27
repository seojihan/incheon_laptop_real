import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, Bell, ShieldCheck, History, Monitor, ChevronDown } from 'lucide-react';
import { LaptopRequest, User } from '../types';
import { cn } from '../lib/utils';
import { getPendingRequests, reviewLaptopRequest } from '../lib/db';
import { formatRequestSlot, hasCalendarWeekLabel } from '../lib/rentalSchedule';
import TeacherClassTools from './TeacherClassTools';

interface AdminApprovalViewProps {
  currentUser: User;
}

export default function AdminApprovalView({ currentUser }: AdminApprovalViewProps) {
  const [list, setList] = useState<LaptopRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const canManage = currentUser.role === 'admin' || currentUser.role === 'helper' || currentUser.role === 'teacher';

  useEffect(() => {
    let active = true;
    const loadPending = async (silent: boolean) => {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const data = await getPendingRequests(currentUser);
        if (active) setList(data);
      } catch (err: any) {
        if (active && !silent) setError(err?.message || '대기 중인 요청을 불러오지 못했습니다.');
      } finally {
        if (active && !silent) setLoading(false);
      }
    };

    void loadPending(false);
    // Poll so a shared approval screen picks up new requests without a manual reload.
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadPending(true);
    }, 10_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [currentUser.id, currentUser.role, currentUser.classNum]);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    const request = list.find((item) => item.id === id);
    if (!request) return;
    let reviewNote = '';
    if (action === 'approve') {
      if (!window.confirm(`${request.userName} 학생의 신청을 승인하고 사용 가능한 노트북을 배정할까요?`)) return;
    } else {
      reviewNote = window.prompt('반려 사유를 입력해주세요. 학생 알림에 표시됩니다.', '')?.trim() || '';
      if (!reviewNote) return;
    }

    setProcessingId(id);
    setError(null);
    try {
      const status = action === 'approve' ? 'approved' : 'rejected';
      await reviewLaptopRequest(id, status, reviewNote);
      setList((prev) => prev.filter((item) => item.id !== id));
      setExpandedId((prev) => (prev === id ? null : prev));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '요청 처리 중 오류가 발생했습니다.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="px-4 py-1.5 bg-blue-50 text-blue-800 rounded-full text-xs font-black">승인 관리</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 mb-3">승인 관리</h1>
          <p className="text-slate-500 text-base font-medium">
            {canManage
              ? '현재 대기 중인 대여 요청을 검토하고, 승인/반려를 진행하세요.'
              : '해당 페이지는 승인 가능한 권한이 없는 사용자에게는 조회 전용입니다.'}
          </p>
        </div>
        <div className="bg-white text-slate-900 rounded-3xl p-5 sm:p-6 px-6 sm:px-8 flex items-center gap-6 shadow-sm border border-slate-200 relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] mb-1">처리 대기 상태</p>
            <p className="text-3xl font-black">{list.length} <span className="text-sm font-bold text-slate-500 ml-1">건 대기 중</span></p>
          </div>
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)] relative z-10 group-hover:scale-110 transition-transform">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {currentUser.role === 'teacher' && <TeacherClassTools currentUser={currentUser} />}

      <div className="space-y-8">
        {loading ? (
          <div className="py-32 text-center text-slate-500 font-bold">대기 요청을 불러오는 중입니다...</div>
        ) : error && list.length === 0 ? (
          <div role="alert" className="py-12 px-6 rounded-3xl border border-red-200 bg-red-50 text-center text-red-700 font-bold">{error}</div>
        ) : (
          <>
          {error && <div role="alert" className="px-6 py-4 rounded-2xl border border-red-200 bg-red-50 text-red-700 font-bold">{error}</div>}
          <AnimatePresence mode="popLayout">
            {list.length > 0 ? list.map((request) => (
              <motion.div
                layout
                key={request.id}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 group hover:border-slate-300 transition-all shadow-sm relative overflow-hidden"
              >
                <div className="flex flex-col lg:flex-row gap-12">
                  <div className="flex-1">
                    <div className="flex items-center gap-5 mb-7">
                      <div className={cn(
                        'w-16 h-16 rounded-3xl flex items-center justify-center shadow-inner transition-transform group-hover:scale-105',
                        request.type === 'home' ? 'bg-slate-900 text-white' : 'bg-blue-50 text-blue-600',
                      )}>
                        {request.type === 'home' ? <History className="w-8 h-8" /> : <Monitor className="w-8 h-8" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1.5">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">관리 번호: {request.id}</span>
                          <span className="px-2.5 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-full text-[10px] font-black uppercase">검토 필요</span>
                        </div>
                        <h3 className="font-black text-2xl text-slate-900">
                          {request.userName}
                          <span className="text-slate-400 font-mono text-sm ml-3 not-italic">({request.studentId})</span>
                        </h3>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="bg-slate-50 border border-slate-100 rounded-3xl p-8 group-hover:bg-slate-100/50 transition-colors">
                        <p className="text-[10px] uppercase font-black text-slate-400 mb-4 tracking-widest">신청 사유 및 목적</p>
                        <p className="text-base font-bold text-slate-700 leading-relaxed">
                          {request.reason || '사유가 등록되지 않았습니다.'}
                        </p>
                      </div>

                      <div className="flex flex-col justify-center gap-6 px-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                            <Check className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest">{request.type === 'home' ? '가정 대여 기간' : '교과 대여 주간'}</p>
                            <p className="text-sm font-black text-slate-900">
                              {request.type === 'home' ? `${request.startDate}${request.endDate ? ` — ${request.endDate}` : ''}` : request.weekLabel || request.startDate}
                            </p>
                          </div>
                        </div>
                        {request.slots && request.slots.length > 0 && (
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                              <Monitor className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest">신청 교시</p>
                            <p className="text-sm font-black text-slate-900">
                                {request.slots.map((slot) => formatRequestSlot(slot, request.startDate, request.weekLabel)).join(' / ')}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 border-t lg:border-t-0 lg:border-l border-slate-100 pt-6 lg:pt-0 lg:pl-8 w-full lg:w-64">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === request.id ? null : request.id)}
                      aria-expanded={expandedId === request.id}
                        className="flex-1 lg:flex-none min-h-12 flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 px-5 py-4 rounded-2xl font-black text-sm hover:bg-slate-50 transition-all"
                    >
                      <ChevronDown className={expandedId === request.id ? 'w-5 h-5 rotate-180 transition-transform' : 'w-5 h-5 transition-transform'} />
                      {expandedId === request.id ? '상세 닫기' : '상세 보기'}
                    </button>
                    {canManage ? (
                      <>
                        <button
                          onClick={() => handleAction(request.id, 'approve')}
                          disabled={processingId === request.id}
                          className="flex-1 lg:flex-none min-h-12 flex items-center justify-center gap-3 bg-slate-900 text-white px-5 py-4 rounded-2xl font-black text-sm hover:bg-slate-800 active:scale-[0.98] transition-all shadow-sm group/btn"
                        >
                          <Check className="w-5 h-5 group-hover/btn:scale-125 transition-transform" />
                          {processingId === request.id ? '처리 중...' : '신청 승인'}
                        </button>
                        <button
                          onClick={() => handleAction(request.id, 'reject')}
                          disabled={processingId === request.id}
                          className="flex-1 lg:flex-none min-h-12 flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-600 px-5 py-4 rounded-2xl font-black text-sm hover:bg-slate-50 hover:text-red-600 hover:border-red-200 transition-all group/btn2"
                        >
                          <X className="w-5 h-5 group-hover/btn2:scale-125 transition-transform" />
                          반려 처리
                        </button>
                      </>
                    ) : (
                      <div className="flex-1 lg:flex-none flex items-center justify-center gap-3 bg-slate-100 text-slate-700 px-8 py-6 rounded-2xl font-black text-sm border border-slate-200">
                        읽기 전용 선생님 권한
                      </div>
                    )}
                  </div>
                </div>
                {expandedId === request.id && (
                  <div className="mt-8 bg-slate-50 border border-slate-200 rounded-3xl p-8">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-[10px] uppercase text-slate-400 tracking-[0.3em] mb-2">수업/가정 대여</p>
                        <p className="font-black text-slate-900">{request.type === 'home' ? '가정 대여' : `${request.weekLabel || '교과 대여'}`}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-slate-400 tracking-[0.3em] mb-2">학생 정보</p>
                        <p className="font-black text-slate-900">{request.userName} / {request.studentId}</p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-[10px] uppercase text-slate-400 tracking-[0.3em] mb-2">신청 사유</p>
                        <p className="text-slate-700 font-medium leading-relaxed">{request.reason || '사유가 등록되지 않았습니다.'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-slate-400 tracking-[0.3em] mb-2">신청 일자</p>
                        <p className="font-black text-slate-900">{request.type === 'home' ? `${request.startDate}${request.endDate ? ` — ${request.endDate}` : ''}` : request.weekLabel || request.startDate}</p>
                        {request.type === 'class' && !hasCalendarWeekLabel(request.weekLabel) && <p className="mt-1 text-xs font-medium text-slate-500">이전 신청 형식이라 정확한 수업 날짜는 표시되지 않습니다.</p>}
                      </div>
                      {request.slots && request.slots.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase text-slate-400 tracking-[0.3em] mb-2">선택 교시</p>
                          <p className="text-slate-700 font-medium">
                            {request.slots.map((slot, index) => (
                              <span key={`${slot.dayIdx}-${slot.periodIdx}-${index}`} className="inline-block mb-1 mr-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs">
                                {formatRequestSlot(slot, request.startDate, request.weekLabel)}
                              </span>
                            ))}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-32 flex flex-col items-center justify-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-[40px]"
              >
                <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-xl mb-8">
                  <Bell className="w-10 h-10 text-slate-200" />
                </div>
                <p className="text-2xl font-black text-slate-400 italic">검토 완료</p>
                <p className="text-slate-400 font-bold mt-2 text-sm italic uppercase tracking-widest">모든 대기 요청이 처리되었습니다.</p>
              </motion.div>
            )}
          </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}
