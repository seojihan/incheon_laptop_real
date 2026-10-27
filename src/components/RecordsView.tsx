import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, History, Monitor, RefreshCw, Search } from 'lucide-react';
import { cancelLaptopRequest, getRecords, returnLaptopRequest } from '../lib/db';
import { cn } from '../lib/utils';
import { LaptopRequest, RequestStatus, User } from '../types';
import { formatRequestSlot, hasCalendarWeekLabel } from '../lib/rentalSchedule';

interface RecordsViewProps {
  currentUser: User;
  initialRequestId?: string | null;
  onRequestTargetHandled?: () => void;
}

const statusLabel: Record<RequestStatus, string> = {
  pending: '승인 대기', approved: '승인 완료', rejected: '반려', returned: '반납 완료', cancelled: '신청 취소',
};

export default function RecordsView({ currentUser, initialRequestId, onRequestTargetHandled }: RecordsViewProps) {
  const [records, setRecords] = useState<LaptopRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | RequestStatus>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try { setRecords(await getRecords(currentUser)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : '기록을 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [currentUser.id, currentUser.role, currentUser.classNum]);

  useEffect(() => {
    if (loading || !initialRequestId) return;
    if (error) {
      onRequestTargetHandled?.();
      return;
    }
    const target = records.find((record) => record.id === initialRequestId);
    if (target) setExpandedId(target.id);
    else setError('연결된 신청 내역을 찾지 못했습니다. 목록을 새로고침해 주세요.');
    onRequestTargetHandled?.();
  }, [initialRequestId, loading, records, error, onRequestTargetHandled]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ko-KR');
    return records.filter((record) => {
      if (statusFilter !== 'all' && record.status !== statusFilter) return false;
      if (!query) return true;
      return [record.userName, record.studentId, record.reason, record.weekLabel, record.id, record.notebookNumber?.toString()]
        .some((value) => value?.toLocaleLowerCase('ko-KR').includes(query));
    });
  }, [records, search, statusFilter]);

  const handleCancel = async (record: LaptopRequest) => {
    if (!window.confirm('이 대기 신청을 취소할까요? 취소한 신청은 다시 되돌릴 수 없습니다.')) return;
    setProcessingId(record.id);
    setError(null);
    try {
      const updated = await cancelLaptopRequest(record.id);
      setRecords((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (caught) { setError(caught instanceof Error ? caught.message : '신청을 취소하지 못했습니다.'); }
    finally { setProcessingId(null); }
  };

  const handleReturn = async (record: LaptopRequest) => {
    if (!window.confirm(`${record.notebookNumber ?? ''}번 노트북을 반납 완료로 처리할까요? 실제 장비를 확인한 후 진행해주세요.`)) return;
    setProcessingId(record.id);
    setError(null);
    try {
      const updated = await returnLaptopRequest(record.id);
      setRecords((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (caught) { setError(caught instanceof Error ? caught.message : '반납 처리하지 못했습니다.'); }
    finally { setProcessingId(null); }
  };

  const scopeLabel = currentUser.role === 'admin'
    ? '전체 기록'
    : currentUser.role === 'student'
      ? '나의 기록'
      : `${Number(currentUser.classNum || 0)}반 기록`;

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-8 gap-6">
        <div>
          <span className="inline-flex px-3 py-1 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest mb-3">{scopeLabel}</span>
          <h1 className="text-4xl font-black text-slate-900">대여 통합 기록</h1>
          <p className="text-slate-500 mt-2">신청부터 승인·반납까지의 상태를 확인합니다.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <label className="relative">
            <span className="sr-only">기록 검색</span><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="이름, 학번, 사유, 번호 검색" className="w-full sm:w-72 bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </label>
          <label><span className="sr-only">상태 필터</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"><option value="all">모든 상태</option>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold disabled:opacity-50"><RefreshCw className="w-4 h-4" />새로고침</button>
        </div>
      </div>

      {error && <div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">{error}</div>}

      {loading ? <div className="py-24 text-center text-slate-400" role="status">기록을 불러오는 중입니다...</div> : filtered.length === 0 ? (
        <div className="py-24 text-center text-slate-400 font-bold border-2 border-dashed border-slate-200 rounded-3xl">{records.length ? '검색 조건에 맞는 기록이 없습니다.' : '아직 대여 기록이 없습니다.'}</div>
      ) : (
        <div className="space-y-4">
          {filtered.map((record) => (
            <article key={record.id} className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
              <div className="p-5 sm:p-7 flex flex-col lg:flex-row lg:items-center gap-6">
                <div className="flex items-center gap-5 min-w-0 flex-1">
                  <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center shrink-0', record.type === 'home' ? 'bg-slate-900 text-white' : 'bg-blue-50 text-blue-600')}>{record.type === 'home' ? <History className="w-6 h-6" /> : <Monitor className="w-6 h-6" />}</div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2"><span className="text-xs font-bold text-slate-400">{new Date(record.createdAt).toLocaleDateString('ko-KR')}</span><StatusBadge status={record.status} />{record.notebookNumber && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black text-blue-700">노트북 {record.notebookNumber}번</span>}</div>
                    <h2 className="text-lg font-black text-slate-900 truncate">{record.userName} — {record.type === 'home' ? '가정 대여' : record.weekLabel || '교과 대여'}</h2>
                    <p className="text-sm text-slate-500 mt-1">{record.type === 'home' ? `${record.startDate} ~ ${record.endDate}` : `${record.weekLabel || '교과 대여'} · ${record.slots?.length ?? 0}개 교시 선택`}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {record.status === 'pending' && record.userId === currentUser.id && <button type="button" onClick={() => void handleCancel(record)} disabled={processingId === record.id} className="rounded-xl border border-red-200 px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50">신청 취소</button>}
                  {record.status === 'approved' && ['admin', 'teacher', 'helper'].includes(currentUser.role) && <button type="button" onClick={() => void handleReturn(record)} disabled={processingId === record.id} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">반납 확인</button>}
                  <button type="button" onClick={() => setExpandedId(expandedId === record.id ? null : record.id)} aria-expanded={expandedId === record.id} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50">상세 보기 <ChevronDown className={cn('w-4 h-4 transition-transform', expandedId === record.id && 'rotate-180')} /></button>
                </div>
              </div>
              {expandedId === record.id && (
                <div className="border-t border-slate-100 bg-slate-50 p-5 sm:p-7 grid gap-5 md:grid-cols-2 text-sm">
                  <Detail label="학생 정보" value={`${record.userName} / ${record.studentId}`} />
                  <Detail label="관리 번호" value={record.id} />
                  <Detail label="신청 사유" value={record.reason || '등록된 사유 없음'} />
                  <Detail label="검토 내용" value={record.reviewNote || '등록된 검토 메모 없음'} />
                  {record.slots && record.slots.length > 0 && <div className="md:col-span-2"><p className="text-[10px] uppercase text-slate-400 tracking-widest mb-2">{hasCalendarWeekLabel(record.weekLabel) ? '선택 날짜와 교시' : '선택 요일과 교시'}</p>{!hasCalendarWeekLabel(record.weekLabel) && <p className="mb-2 text-xs text-slate-500">이전 신청 형식이라 정확한 날짜는 저장되어 있지 않습니다.</p>}<div className="flex flex-wrap gap-2">{record.slots.map((slot, index) => <span key={`${slot.dayIdx}-${slot.periodIdx}-${index}`} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold">{formatRequestSlot(slot, record.startDate, record.weekLabel)}</span>)}</div></div>}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] uppercase text-slate-400 tracking-widest mb-2">{label}</p><p className="font-bold text-slate-800 break-words">{value}</p></div>;
}

function StatusBadge({ status }: { status: RequestStatus }) {
  const style: Record<RequestStatus, string> = {
    approved: 'bg-emerald-50 text-emerald-700', pending: 'bg-amber-50 text-amber-700', returned: 'bg-slate-100 text-slate-600', rejected: 'bg-red-50 text-red-700', cancelled: 'bg-zinc-100 text-zinc-600',
  };
  return <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-black', style[status])}>{statusLabel[status]}</span>;
}
