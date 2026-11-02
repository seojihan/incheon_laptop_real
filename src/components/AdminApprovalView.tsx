import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Bell, Check, RefreshCw, X } from 'lucide-react';
import { LaptopRequest, RequestType, User, ViewType } from '../types';
import { cn } from '../lib/utils';
import { getNotebookInventory, getRecords, reviewLaptopRequests } from '../lib/db';
import { closePage, openNewPage, readPageParams } from '../lib/pageLinks';
import { formatRentalWhen, requestTypeLabel } from '../lib/requestSummary';
import TeacherClassTools from './TeacherClassTools';
import RequestCard from './approval/RequestCard';
import { PageBackButton, RejectReasonForm, RequestFields, RequestSignature, RequestStatusBadge, RequestTypeBadge, requestTypeTheme } from './approval/RequestParts';
import SignatureDialog from './approval/SignatureDialog';

interface AdminApprovalViewProps {
  currentUser: User;
  onNavigate: (view: ViewType) => void;
}

type ApprovalPage =
  | { kind: 'queue' }
  | { kind: 'type'; type: RequestType }
  | { kind: 'status'; status: 'approved' | 'rejected' }
  | { kind: 'detail'; requestId: string };

// A tab shows one page for its whole life: moving elsewhere opens another tab.
const readApprovalPage = (): ApprovalPage => {
  const { page, type, status, request } = readPageParams(window.location.search);
  if (page === 'detail' && request) return { kind: 'detail', requestId: request };
  if (page === 'type' && (type === 'home' || type === 'class')) return { kind: 'type', type };
  if (page === 'status' && (status === 'approved' || status === 'rejected')) return { kind: 'status', status };
  return { kind: 'queue' };
};

const closeToQueue = () => closePage({ view: 'admin-approval' });
const openDetail = (requestId: string) => openNewPage({ view: 'admin-approval', page: 'detail', request: requestId });

export default function AdminApprovalView({ currentUser, onNavigate }: AdminApprovalViewProps) {
  const [page] = useState<ApprovalPage>(readApprovalPage);
  const [records, setRecords] = useState<LaptopRequest[]>([]);
  const [availability, setAvailability] = useState<{ available: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [signingIds, setSigningIds] = useState<string[] | null>(null);

  const canManage = currentUser.role === 'admin' || currentUser.role === 'helper' || currentUser.role === 'teacher';
  const requiresSignature = currentUser.role === 'admin' || currentUser.role === 'teacher';

  const loadAvailability = useCallback(async () => {
    try {
      const notebooks = await getNotebookInventory();
      setAvailability({
        total: notebooks.filter((item) => item.condition !== 'retired').length,
        available: notebooks.filter((item) => item.condition === 'available' && !item.activeRentalType).length,
      });
    } catch {
      setAvailability(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const loadRecords = async (silent: boolean) => {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const data = await getRecords(currentUser);
        if (active) setRecords(data);
      } catch (caught) {
        if (active && !silent) setError(caught instanceof Error ? caught.message : '신청 목록을 불러오지 못했습니다.');
      } finally {
        if (active && !silent) setLoading(false);
      }
    };

    // Approvals made in another tab show up here as soon as this tab is looked at.
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      void loadRecords(true);
      void loadAvailability();
    };

    void loadRecords(false);
    void loadAvailability();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadRecords(true);
    }, 10_000);
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [currentUser.id, currentUser.role, currentUser.grade, currentUser.classNum, loadAvailability]);

  const pending = useMemo(() => records.filter((item) => item.status === 'pending'), [records]);
  const approvedCount = useMemo(() => records.filter((item) => item.status === 'approved').length, [records]);
  const rejectedCount = useMemo(() => records.filter((item) => item.status === 'rejected').length, [records]);

  const queue = page.kind === 'type' ? pending.filter((item) => item.type === page.type) : pending;
  // A polled refresh can remove a selected request, so only count what is still listed.
  const selectedInQueue = queue.filter((item) => selectedIds.has(item.id));

  const toggleSelected = (id: string, selected: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const runReview = async (requestIds: string[], decision: 'approved' | 'rejected', options: { reviewNote?: string; signature?: string }) => {
    setBusy(true);
    setError(null);
    try {
      const result = await reviewLaptopRequests({ requestIds, decision, ...options, signerName: currentUser.name });
      setSelectedIds((current) => {
        const next = new Set(current);
        result.processed.forEach((id) => next.delete(id));
        return next;
      });
      if (result.failed.length > 0) {
        const lines = result.failed.map((failure) => {
          const request = records.find((item) => item.id === failure.id);
          return `${request ? `${request.studentId} ${request.userName}` : '신청'}: ${failure.message}`;
        });
        setError(`${result.processed.length}건 처리, ${result.failed.length}건 실패 — ${lines.join(' / ')}`);
      }
      setRecords(await getRecords(currentUser));
      void loadAvailability();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '요청 처리 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
      setSigningIds(null);
    }
  };

  const startApproval = (requestIds: string[]) => {
    if (requiresSignature) {
      setSigningIds(requestIds);
      return;
    }
    const confirmed = window.confirm(requestIds.length === 1
      ? '이 신청을 승인하고 사용 가능한 노트북을 배정할까요?'
      : `선택한 ${requestIds.length}건을 승인하고 사용 가능한 노트북을 배정할까요?`);
    if (confirmed) void runReview(requestIds, 'approved', {});
  };

  const signingRequests = signingIds ? records.filter((item) => signingIds.includes(item.id)) : [];
  const signingLabel = signingRequests.length === 1
    ? `${signingRequests[0].studentId} ${signingRequests[0].userName} · ${formatRentalWhen(signingRequests[0])}`
    : signingRequests.length > 1
      ? `${signingRequests[0].userName} 외 ${signingRequests.length - 1}명의 신청에 같은 서명이 적용됩니다.`
      : '';

  const signatureDialog = signingIds && (
    <SignatureDialog
      signerName={currentUser.name}
      targetLabel={signingLabel}
      count={signingIds.length}
      busy={busy}
      onCancel={() => setSigningIds(null)}
      onConfirm={(signature) => void runReview(signingIds, 'approved', { signature })}
    />
  );
  const errorBanner = error && <div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm font-bold leading-6 text-red-700">{error}</div>;
  const loadingMessage = <div role="status" className="py-32 text-center font-bold text-slate-500">신청 내역을 불러오는 중입니다...</div>;

  if (page.kind === 'detail') {
    const request = records.find((item) => item.id === page.requestId);
    return (
      <div className="mx-auto max-w-4xl pb-20">
        <PageBackButton label="창 닫고 돌아가기" onClick={closeToQueue} />
        {errorBanner}
        {loading ? loadingMessage : !request ? (
          <div className="rounded-3xl border-2 border-dashed border-slate-200 py-24 text-center font-bold text-slate-500">신청 내역을 찾지 못했습니다.</div>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <RequestTypeBadge type={request.type} />
              <RequestStatusBadge status={request.status} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 sm:text-4xl">{request.userName}<span className="ml-3 font-mono text-lg font-bold text-slate-500">{request.studentId}</span></h1>
            <p className="mt-2 font-bold text-slate-600">{formatRentalWhen(request)}</p>
            <section className={cn('mt-6 rounded-3xl border p-6 sm:p-8', requestTypeTheme[request.type].panel)}>
              <RequestFields request={request} full />
              <RequestSignature request={request} currentUser={currentUser} />
            </section>
            {canManage && request.status === 'pending' && (
              <DetailActions
                busy={busy}
                onApprove={() => startApproval([request.id])}
                onReject={(reason) => void runReview([request.id], 'rejected', { reviewNote: reason })}
              />
            )}
          </>
        )}
        {signatureDialog}
      </div>
    );
  }

  if (page.kind === 'status') {
    const items = records.filter((item) => item.status === page.status);
    return (
      <div className="mx-auto max-w-6xl pb-20">
        <PageBackButton label="창 닫고 돌아가기" onClick={closeToQueue} />
        <h1 className="text-4xl font-black text-slate-900">{page.status === 'approved' ? '승인된 노트북' : '반려된 노트북'}</h1>
        <p className="mb-8 mt-2 text-slate-500">
          {page.status === 'approved' ? '현재 노트북을 빌려 간 신청입니다. 반납 처리하면 이 목록에서 빠집니다.' : '반려된 신청과 사유입니다.'}
        </p>
        {errorBanner}
        {loading ? loadingMessage : items.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-slate-200 py-24 text-center font-bold text-slate-500">해당하는 신청이 없습니다.</div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openDetail(item.id)}
                className={cn('flex w-full flex-col gap-2 rounded-3xl border border-l-[6px] border-slate-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md sm:p-5 md:flex-row md:items-center md:gap-5', requestTypeTheme[item.type].stripe)}
              >
                <RequestTypeBadge type={item.type} />
                <span className="min-w-0 md:w-52 md:shrink-0">
                  <span className="font-mono text-sm font-bold text-slate-500">{item.studentId}</span>
                  <span className="ml-2 text-lg font-black text-slate-900">{item.userName}</span>
                </span>
                <span className="min-w-0 flex-1 text-sm font-bold text-slate-600">
                  {page.status === 'rejected' ? `사유: ${item.reviewNote || '사유 없음'}` : `${item.notebookNumber ?? '-'}번 노트북 · ${formatRentalWhen(item)}`}
                </span>
                <ArrowRight className="hidden h-5 w-5 shrink-0 text-slate-400 md:block" aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const isMainQueue = page.kind === 'queue';
  return (
    <div className="mx-auto max-w-6xl pb-20">
      {!isMainQueue && <PageBackButton label="창 닫고 돌아가기" onClick={closeToQueue} />}
      <div className="mb-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          {isMainQueue && <span className="mb-3 inline-block rounded-full bg-blue-50 px-4 py-1.5 text-xs font-black text-blue-800">승인 관리</span>}
          <h1 className="mb-3 text-4xl font-black tracking-tight text-slate-900">{page.kind === 'type' ? `${requestTypeLabel[page.type]} 승인 대기` : '승인 관리'}</h1>
          <p className="text-base font-medium text-slate-500">상자를 눌러 내용을 확인하고, 왼쪽 위 체크 칸으로 여러 건을 골라 한 번에 승인할 수 있습니다.</p>
        </div>
        {isMainQueue && (
          <div className="grid w-full shrink-0 grid-cols-2 divide-slate-100 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm sm:grid-cols-4 sm:divide-x lg:w-auto">
            <div className="px-5 py-4 sm:px-6">
              <p className="whitespace-nowrap text-xs font-bold text-slate-500">승인 대기</p>
              <p className="mt-1 text-3xl font-black text-slate-900">{pending.length}<span className="ml-1 text-sm font-bold text-slate-500">건</span></p>
            </div>
            <StatTile label="승인된 노트북" value={approvedCount} unit="대" className="text-[#2563eb]" onClick={() => openNewPage({ view: 'admin-approval', page: 'status', status: 'approved' })} />
            <StatTile label="반려된 노트북" value={rejectedCount} unit="대" className="text-red-600" onClick={() => openNewPage({ view: 'admin-approval', page: 'status', status: 'rejected' })} />
            <StatTile label="빌릴 수 있는 노트북" value={availability?.available ?? '-'} unit={availability ? `/ ${availability.total}대` : ''} className="text-slate-900" onClick={() => onNavigate('notebook-inventory')} />
          </div>
        )}
      </div>

      {isMainQueue && !loading && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          {(['home', 'class'] as RequestType[]).map((type) => (
            <button key={type} type="button" onClick={() => openNewPage({ view: 'admin-approval', page: 'type', type })} className={cn('flex min-h-14 items-center justify-between gap-3 rounded-2xl border px-5 py-3 text-left transition-colors', requestTypeTheme[type].tile)}>
              <span className="text-sm font-black">{requestTypeLabel[type]} 대기 <span className="ml-1 text-lg">{pending.filter((item) => item.type === type).length}</span>건</span>
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

      {errorBanner}

      {loading ? (
        <div role="status" className="py-32 text-center font-bold text-slate-500">대기 요청을 불러오는 중입니다...</div>
      ) : queue.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center rounded-[40px] border-2 border-dashed border-slate-200 bg-slate-50 py-24">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-sm"><Bell className="h-10 w-10 text-slate-300" /></div>
          <p className="text-2xl font-black text-slate-500">검토 완료</p>
          <p className="mt-2 text-sm font-bold text-slate-500">모든 대기 요청이 처리되었습니다.</p>
        </motion.div>
      ) : (
        <>
          <div className="space-y-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {queue.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  canManage={canManage}
                  busy={busy}
                  selected={selectedIds.has(request.id)}
                  onSelectedChange={(selected) => toggleSelected(request.id, selected)}
                  onApprove={() => startApproval([request.id])}
                  onReject={(reason) => void runReview([request.id], 'rejected', { reviewNote: reason })}
                  onOpenDetail={() => openDetail(request.id)}
                />
              ))}
            </AnimatePresence>
          </div>
          {canManage && selectedInQueue.length > 0 && (
            <div className="sticky bottom-4 z-20 mt-4 flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-lg">
              <p className="text-sm font-black text-slate-900">{selectedInQueue.length}건 선택됨</p>
              <button type="button" onClick={() => startApproval(selectedInQueue.map((item) => item.id))} disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-50">
                {busy ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}승인
              </button>
            </div>
          )}
        </>
      )}

      {isMainQueue && currentUser.role === 'teacher' && <div className="mt-10"><TeacherClassTools currentUser={currentUser} /></div>}
      {signatureDialog}
    </div>
  );
}

function StatTile({ label, value, unit, className, onClick }: { label: string; value: number | string; unit: string; className: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group px-5 py-4 text-left transition-colors hover:bg-slate-50 sm:px-6">
      <p className="flex items-center gap-1 whitespace-nowrap text-xs font-bold text-slate-500">{label}<ArrowRight className="h-3 w-3 opacity-50 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></p>
      <p className={cn('mt-1 whitespace-nowrap text-3xl font-black', className)}>{value}{unit && <span className="ml-1 text-sm font-bold text-slate-500">{unit}</span>}</p>
    </button>
  );
}

function DetailActions({ busy, onApprove, onReject }: { busy: boolean; onApprove: () => void; onReject: (reason: string) => void }) {
  const [rejecting, setRejecting] = useState(false);
  return (
    <div className="mt-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={() => setRejecting((value) => !value)} disabled={busy} aria-expanded={rejecting} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-600 transition hover:border-red-200 hover:text-red-600 disabled:opacity-50"><X className="h-5 w-5" />반려 처리</button>
        <button type="button" onClick={onApprove} disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-50"><Check className="h-5 w-5" />{busy ? '처리 중...' : '신청 승인'}</button>
      </div>
      {rejecting && <div className="mt-3"><RejectReasonForm busy={busy} onCancel={() => setRejecting(false)} onSubmit={onReject} /></div>}
    </div>
  );
}
