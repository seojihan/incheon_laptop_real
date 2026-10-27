import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, BookOpen, Check, CircleOff, Home, Laptop, RefreshCw, Search, Save, Wrench, X } from 'lucide-react';
import { getNotebookInventory, updateNotebookCondition } from '../lib/db';
import { cn } from '../lib/utils';
import { NotebookInventoryItem, User } from '../types';

type InventoryFilter = 'all' | 'available' | 'home' | 'class' | 'unavailable' | 'maintenance' | 'retired';
type NotebookDraft = { number: number; condition: NotebookInventoryItem['condition']; note: string };

interface NotebookInventoryViewProps { currentUser: User; onOpenRecords: () => void }

export default function NotebookInventoryView({ currentUser, onOpenRecords }: NotebookInventoryViewProps) {
  const [notebooks, setNotebooks] = useState<NotebookInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingNumber, setSavingNumber] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedNotebookNumber, setSelectedNotebookNumber] = useState<number | null>(null);
  const [draft, setDraft] = useState<NotebookDraft | null>(null);
  const [searchText, setSearchText] = useState('');
  const [filter, setFilter] = useState<InventoryFilter>('all');
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const detailDialogRef = useRef<HTMLDialogElement>(null);
  const canManage = currentUser.role === 'helper' || currentUser.role === 'teacher' || currentUser.role === 'admin';
  const selectedNotebook = notebooks.find((item) => item.number === selectedNotebookNumber) || null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setNotebooks(await getNotebookInventory());
      setRefreshedAt(new Date());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '노트북 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [currentUser.id, load]);

  useEffect(() => {
    const dialog = detailDialogRef.current;
    if (!dialog) return;
    if (selectedNotebookNumber !== null && !dialog.open) dialog.showModal();
    if (selectedNotebookNumber === null && dialog.open) dialog.close();
  }, [selectedNotebookNumber]);

  const stats = useMemo(() => ({
    total: notebooks.length,
    available: notebooks.filter((item) => item.condition === 'available' && !getActiveRentalType(item)).length,
    home: notebooks.filter((item) => getActiveRentalType(item) === 'home').length,
    classroom: notebooks.filter((item) => getActiveRentalType(item) === 'class').length,
    maintenance: notebooks.filter((item) => item.condition === 'maintenance').length,
    retired: notebooks.filter((item) => item.condition === 'retired').length,
  }), [notebooks]);

  const visibleNotebooks = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase('ko-KR');
    return notebooks.filter((item) => {
      const activeType = getActiveRentalType(item);
      const statusMatch = filter === 'all'
        || (filter === 'available' && item.condition === 'available' && !activeType)
        || (filter === 'home' && activeType === 'home')
        || (filter === 'class' && activeType === 'class')
        || (filter === 'unavailable' && item.condition !== 'available')
        || (filter === 'maintenance' && item.condition === 'maintenance')
        || (filter === 'retired' && item.condition === 'retired');
      const queryMatch = !query || String(item.number).includes(query) || item.assetTag.toLocaleLowerCase('ko-KR').includes(query);
      return statusMatch && queryMatch;
    });
  }, [filter, notebooks, searchText]);

  const closeDetail = () => {
    setSelectedNotebookNumber(null);
    setDraft(null);
  };

  const saveCondition = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    setSavingNumber(draft.number);
    setError(null);
    setSuccess(null);
    try {
      await updateNotebookCondition(draft.number, draft.condition, draft.note);
      setSuccess(`${draft.number}번 노트북 메모와 상태를 저장했습니다.`);
      setDraft(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '장비 상태를 저장하지 못했습니다.');
    } finally {
      setSavingNumber(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl pb-16">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-800"><Laptop className="h-4 w-4" />장비 관리</span>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">노트북 현황</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">장비를 선택하면 대여 이력과 관리 메모를 확인할 수 있습니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-slate-500">{refreshedAt ? `${refreshedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 기준` : '데이터 확인 전'}</p>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />새로고침
          </button>
        </div>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" role="group" aria-label="노트북 현황 요약">
        <Stat label="전체 장비" value={stats.total} selected={filter === 'all'} onClick={() => setFilter('all')} style="bg-white border-slate-200 text-slate-900" />
        <Stat label="대여 가능" value={stats.available} selected={filter === 'available'} onClick={() => setFilter('available')} style="bg-emerald-50 border-emerald-100 text-emerald-800" />
        <Stat label="가정 대여 중" value={stats.home} selected={filter === 'home'} onClick={() => setFilter('home')} style="bg-amber-50 border-amber-100 text-amber-800" />
        <Stat label="교과 대여 중" value={stats.classroom} selected={filter === 'class'} onClick={() => setFilter('class')} style="bg-blue-50 border-blue-100 text-blue-800" />
        <Stat label="점검 · 퇴역" value={stats.maintenance + stats.retired} selected={filter === 'unavailable'} onClick={() => setFilter('unavailable')} style="bg-slate-100 border-slate-200 text-slate-700" />
      </div>

      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3.5 text-xs leading-5 text-blue-950 sm:text-sm">
        <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
        <p><strong>교과 대여 중</strong>은 교과 대여 신청이 승인되어 노트북이 배정된 상태입니다. 담당자가 대여 기록에서 반납 처리하면 다시 대여 가능으로 표시됩니다.</p>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-label="노트북 목록">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={searchText} onChange={(event) => setSearchText(event.target.value)} type="search" placeholder="노트북 번호 또는 자산 번호 검색" aria-label="노트북 검색" className="h-11 w-full rounded-xl border border-slate-200 bg-[#fbfaf7] pl-11 pr-4 text-sm text-slate-800 placeholder:text-slate-400" />
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="상태별 필터">
            {([
              ['all', '전체'], ['available', '대여 가능'], ['home', '가정 대여'], ['class', '교과 대여'], ['maintenance', '점검 중'], ['retired', '퇴역'],
            ] as const).map(([value, label]) => <button type="button" key={value} onClick={() => setFilter(value)} aria-pressed={filter === value} className={cn('shrink-0 rounded-full border px-3.5 py-2 text-xs font-bold transition', filter === value ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}>{label}</button>)}
          </div>
        </div>

        {error && <div role="alert" className="mb-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold leading-6 text-red-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
        {success && <div role="status" className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"><Check className="h-4 w-4" />{success}</div>}

        {loading && notebooks.length === 0 ? <div className="py-20 text-center text-sm font-medium text-slate-500" role="status">실제 장비 현황을 불러오고 있습니다...</div>
          : visibleNotebooks.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-16 text-center"><Search className="mx-auto mb-3 h-7 w-7 text-slate-400" /><p className="font-bold text-slate-700">조건에 맞는 노트북이 없습니다.</p><button type="button" onClick={() => { setSearchText(''); setFilter('all'); }} className="mt-3 text-sm font-bold text-blue-800 underline underline-offset-4">검색 조건 지우기</button></div>
            : <>
              <p className="mb-3 text-xs font-medium text-slate-500" aria-live="polite">{loading ? '현황을 갱신하는 중 · ' : ''}{visibleNotebooks.length}대 표시 / 전체 {notebooks.length}대</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {visibleNotebooks.map((notebook) => {
                  const status = getNotebookStatus(notebook);
                  const statusStyle = status === 'available' ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : status === 'home' ? 'border-amber-200 bg-amber-50 text-amber-800'
                      : status === 'class' ? 'border-blue-200 bg-blue-50 text-blue-800'
                        : status === 'maintenance' ? 'border-orange-200 bg-orange-50 text-orange-800'
                          : 'border-slate-300 bg-slate-100 text-slate-700';

                  return (
                    <button key={notebook.number} type="button" onClick={() => { setSelectedNotebookNumber(notebook.number); setDraft(null); setError(null); }} aria-haspopup="dialog" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
                      <span className="mb-3 flex items-start justify-between gap-2"><span className="text-2xl font-black tracking-tight text-slate-900">{String(notebook.number).padStart(2, '0')}<span className="ml-1 text-xs text-slate-400">번</span></span><span className={cn('rounded-full border px-2 py-1 text-[10px] font-black', statusStyle)}>{getNotebookStatusLabel(status)}</span></span>
                      <span className="block truncate text-xs font-bold text-slate-500">{notebook.assetTag}</span>
                      <span className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-500"><span>가정 대여 이력</span><strong className="text-slate-700">{notebook.homeRentalCount}회</strong></span>
                    </button>
                  );
                })}
              </div>
            </>}
      </section>

      {canManage && <p className="mt-4 flex items-start gap-2 px-1 text-xs leading-5 text-slate-500"><Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0" />장비를 선택해 상태와 메모를 관리할 수 있습니다. 대여 중인 노트북은 상태만 반납 후 변경할 수 있고, 메모는 대여 중에도 수정할 수 있습니다.</p>}
      {!canManage && <p className="mt-4 flex items-start gap-2 px-1 text-xs leading-5 text-slate-500"><CircleOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />현황 확인 전용 화면입니다.</p>}

      <dialog
        ref={detailDialogRef}
        aria-labelledby="notebook-detail-title"
        onCancel={(event) => { event.preventDefault(); closeDetail(); }}
        onClick={(event) => { if (event.target === detailDialogRef.current) closeDetail(); }}
        className="m-auto max-h-[92dvh] w-[min(94vw,44rem)] overflow-y-auto rounded-[1.75rem] border-0 bg-transparent p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/45 backdrop:backdrop-blur-[2px]"
      >
        {selectedNotebook && (() => {
          const status = getNotebookStatus(selectedNotebook);
          const activeType = getActiveRentalType(selectedNotebook);
          const isActiveRental = Boolean(activeType);
          const editing = draft?.number === selectedNotebook.number;
          return (
            <section className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-[#fffefa]">
              <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-5 sm:px-7">
                <div className="flex items-start gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-800"><Laptop className="h-6 w-6" /></span>
                  <div><p className="text-xs font-bold text-slate-500">장비 상세 정보</p><h2 id="notebook-detail-title" className="mt-0.5 text-2xl font-black tracking-tight text-slate-950">노트북 {String(selectedNotebook.number).padStart(2, '0')}번</h2><p className="mt-1 text-xs font-semibold text-slate-500">{selectedNotebook.assetTag}</p></div>
                </div>
                <button type="button" onClick={closeDetail} aria-label="장비 상세 닫기" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"><X className="h-4 w-4" /></button>
              </header>

              <div className="space-y-5 p-5 sm:p-7">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4"><p className="text-xs font-bold text-rose-800">가정 대여 횟수</p><p className="mt-1 text-3xl font-black tracking-tight text-slate-950">{selectedNotebook.homeRentalCount}<span className="ml-1 text-sm font-bold">회</span></p><p className="mt-1 text-[11px] leading-4 text-slate-500">기기가 배정된 승인·반납 건</p></div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold text-slate-500">장비 상태</p><p className="mt-2 text-lg font-black text-slate-900">{getConditionLabel(selectedNotebook.condition)}</p><p className="mt-1 text-[11px] text-slate-500">{selectedNotebook.note || '등록된 상태 메모가 없습니다.'}</p></div>
                </div>

                <div className={cn('rounded-2xl border p-4', status === 'class' ? 'border-blue-200 bg-blue-50/70' : status === 'home' ? 'border-amber-200 bg-amber-50/70' : status === 'maintenance' || status === 'retired' ? 'border-orange-200 bg-orange-50/70' : 'border-emerald-200 bg-emerald-50/70')}>
                  <div className="flex items-center gap-2 text-sm font-black text-slate-900">{activeType === 'class' ? <BookOpen className="h-4 w-4 text-blue-700" /> : activeType === 'home' ? <Home className="h-4 w-4 text-amber-700" /> : <Check className="h-4 w-4 text-emerald-700" />}{getNotebookStatusLabel(status)}</div>
                  {isActiveRental ? <>
                    <p className="mt-1.5 text-xs leading-5 text-slate-600">{activeType === 'class' ? '교과 대여 신청이 승인되어 노트북이 배정된 상태입니다.' : '가정 대여 신청이 승인되어 노트북이 배정된 상태입니다.'} 반납 처리 후 대여 가능으로 바뀝니다.</p>
                    <p className="mt-2 text-xs font-bold text-slate-700">대여 기간: {selectedNotebook.activeRentalStartDate || selectedNotebook.activeRequest?.startDate || '확인 불가'}{(selectedNotebook.activeRentalEndDate || selectedNotebook.activeRequest?.endDate) ? ` – ${selectedNotebook.activeRentalEndDate || selectedNotebook.activeRequest?.endDate}` : ''}</p>
                    {selectedNotebook.activeRequest && <p className="mt-1 text-xs text-slate-600">신청자: {selectedNotebook.activeRequest.userName} · {selectedNotebook.activeRequest.studentId}</p>}
                    {canManage && selectedNotebook.activeRequest && <button type="button" onClick={onOpenRecords} className="mt-3 min-h-10 rounded-xl border border-current/15 bg-white/70 px-3.5 text-xs font-black text-slate-700 transition hover:bg-white">대여 기록에서 반납 처리</button>}
                  </> : <p className="mt-1.5 text-xs leading-5 text-slate-600">{status === 'available' ? '현재 승인된 대여 건이 없습니다.' : '점검을 마친 뒤 상태를 대여 가능으로 바꿔주세요.'}</p>}
                </div>

                {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs font-bold leading-5 text-red-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
                {success && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-xs font-bold text-emerald-800"><Check className="h-4 w-4" />{success}</div>}

                {canManage && (editing ? <form onSubmit={saveCondition} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                  <div><p className="text-sm font-black text-slate-900">관리 정보 수정</p><p className="mt-1 text-xs text-slate-500">상태 메모는 대여 중에도 수정할 수 있습니다.</p></div>
                  <label className="block text-xs font-bold text-slate-600">장비 상태<select disabled={isActiveRental} value={draft.condition} onChange={(event) => setDraft({ ...draft, condition: event.target.value as NotebookInventoryItem['condition'] })} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 disabled:bg-slate-100 disabled:text-slate-500">
                    <option value="available">대여 가능</option><option value="maintenance">점검 중</option><option value="retired">퇴역</option>
                  </select>{isActiveRental && <span className="mt-1 block text-[11px] font-medium text-slate-500">대여 중에는 상태 변경이 잠겨 있습니다. 반납 후 변경할 수 있습니다.</span>}</label>
                  <label className="block text-xs font-bold text-slate-600">상태 메모 <span className="font-normal">({draft.note.length}/500)</span><textarea value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} maxLength={500} rows={3} placeholder="점검 내용이나 참고 사항을 적어주세요." className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-5 text-slate-800" /></label>
                  <div className="flex justify-end gap-2"><button type="button" onClick={() => setDraft(null)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600">취소</button><button type="submit" disabled={savingNumber === selectedNotebook.number} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-black text-white transition hover:bg-blue-800 disabled:opacity-60"><Save className="h-4 w-4" />{savingNumber === selectedNotebook.number ? '저장 중...' : '저장'}</button></div>
                </form> : <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4"><div><p className="text-sm font-black text-slate-900">상태 메모</p><p className="mt-1 text-xs leading-5 text-slate-600">{selectedNotebook.note || '등록된 메모가 없습니다.'}</p></div>{canManage && <button type="button" onClick={() => setDraft({ number: selectedNotebook.number, condition: selectedNotebook.condition, note: selectedNotebook.note || '' })} className="shrink-0 rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-black text-slate-700 transition hover:border-blue-300 hover:text-blue-800">수정</button>}</div>)}
              </div>
            </section>
          );
        })()}
      </dialog>
    </div>
  );
}

function getActiveRentalType(item: NotebookInventoryItem) {
  return item.activeRentalType || item.activeRequest?.type;
}

function getNotebookStatus(item: NotebookInventoryItem): InventoryFilter {
  const activeType = getActiveRentalType(item);
  if (activeType === 'home') return 'home';
  if (activeType === 'class') return 'class';
  if (item.condition === 'maintenance') return 'maintenance';
  if (item.condition === 'retired') return 'retired';
  return 'available';
}

function getConditionLabel(condition: NotebookInventoryItem['condition']) {
  if (condition === 'maintenance') return '점검 중';
  if (condition === 'retired') return '퇴역';
  return '정상';
}

function getNotebookStatusLabel(status: InventoryFilter) {
  switch (status) {
    case 'home': return '가정 대여 중';
    case 'class': return '교과 대여 중';
    case 'maintenance': return '점검 중';
    case 'retired': return '퇴역';
    default: return '대여 가능';
  }
}

function Stat({ label, value, selected, onClick, style }: { label: string; value: number; selected: boolean; onClick: () => void; style: string }) {
  return <button type="button" onClick={onClick} aria-pressed={selected} className={cn('rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-blue-600', style, selected && 'ring-2 ring-blue-700 ring-offset-1')}><p className="mb-1.5 text-xs font-bold">{label}</p><p className="text-2xl font-black tracking-tight">{value}<span className="ml-1 text-xs font-bold">대</span></p></button>;
}
