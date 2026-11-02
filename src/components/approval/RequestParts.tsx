import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Home, LoaderCircle, X } from 'lucide-react';
import { getApprovalSignature, REVIEW_NOTE_MAX_LENGTH } from '../../lib/db';
import { formatRequestSlot, hasCalendarWeekLabel } from '../../lib/rentalSchedule';
import { requestStatusLabel, requestTypeLabel } from '../../lib/requestSummary';
import { cn } from '../../lib/utils';
import { ApprovalSignature, LaptopRequest, RequestStatus, RequestType, User } from '../../types';

// Rental types use the same colors as their cards on the home dashboard.
export const requestTypeTheme: Record<RequestType, { stripe: string; badge: string; panel: string; tile: string }> = {
  home: {
    stripe: 'border-l-amber-400',
    badge: 'bg-amber-100 text-amber-900',
    panel: 'bg-amber-50 border-amber-200',
    tile: 'border-amber-200 bg-amber-50 text-amber-950 hover:border-amber-400',
  },
  class: {
    stripe: 'border-l-blue-500',
    badge: 'bg-blue-100 text-blue-900',
    panel: 'bg-blue-50 border-blue-200',
    tile: 'border-blue-200 bg-blue-50 text-blue-950 hover:border-blue-400',
  },
};

export function RequestTypeBadge({ type }: { type: RequestType }) {
  const Icon = type === 'home' ? Home : BookOpen;
  return <span className={cn('inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black', requestTypeTheme[type].badge)}><Icon className="h-3.5 w-3.5" />{requestTypeLabel[type]}</span>;
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const style: Record<RequestStatus, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-100',
    approved: 'bg-[#e8f0fe] text-[#1d4ed8] border-[#c7d9fb]',
    rejected: 'bg-red-50 text-red-700 border-red-100',
    returned: 'bg-slate-100 text-slate-600 border-slate-200',
    cancelled: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  };
  return <span className={cn('inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-black', style[status])}>{requestStatusLabel[status]}</span>;
}

export function PageBackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"><ArrowLeft className="h-4 w-4" />{label}</button>;
}

function DetailField({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'md:col-span-2' : undefined}>
      <p className="mb-1.5 text-xs font-bold text-slate-500">{label}</p>
      <div className="font-bold leading-relaxed text-slate-800 break-words">{children}</div>
    </div>
  );
}

const formatDateTime = (value?: string) => value ? new Date(value).toLocaleString('ko-KR') : '-';

// Everything known about a request. Used when a card is expanded and on the detail page.
export function RequestFields({ request, full }: { request: LaptopRequest; full?: boolean }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <DetailField label={request.type === 'home' ? '왜 빌리는지 (신청 사유)' : '신청 사유'} wide>
        {request.reason || '사유가 등록되지 않았습니다.'}
      </DetailField>
      <DetailField label={request.type === 'home' ? '가정 대여 기간' : '교과 대여 주간'}>
        {request.type === 'home' ? `${request.startDate}${request.endDate ? ` ~ ${request.endDate}` : ''}` : request.weekLabel || request.startDate}
        {request.type === 'class' && !hasCalendarWeekLabel(request.weekLabel) && <p className="mt-1 text-xs font-medium text-slate-500">이전 신청 형식이라 정확한 수업 날짜는 표시되지 않습니다.</p>}
      </DetailField>
      <DetailField label="학생 정보">{request.grade}학년 {Number(request.classNum)}반 · {request.studentId} {request.userName}</DetailField>
      <DetailField label="신청 일시">{formatDateTime(request.createdAt)}</DetailField>
      {request.notebookNumber && <DetailField label="배정 노트북">{request.notebookNumber}번</DetailField>}
      {request.slots && request.slots.length > 0 && (
        <DetailField label={`선택 교시 (${request.slots.length}개)`} wide>
          <div className="flex flex-wrap gap-2">
            {request.slots.map((slot, index) => (
              <span key={`${slot.dayIdx}-${slot.periodIdx}-${index}`} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700">
                {formatRequestSlot(slot, request.startDate, request.weekLabel)}
              </span>
            ))}
          </div>
        </DetailField>
      )}
      {full && request.reviewedAt && <DetailField label="처리 일시">{formatDateTime(request.reviewedAt)}</DetailField>}
      {request.reviewNote && <DetailField label={request.status === 'rejected' ? '반려 사유' : '검토 내용'} wide>{request.reviewNote}</DetailField>}
      {full && <DetailField label="관리 번호" wide><span className="font-mono text-xs text-slate-500">{request.id}</span></DetailField>}
    </div>
  );
}

export function RequestSignature({ request, currentUser }: { request: LaptopRequest; currentUser: User }) {
  const signatureId = request.approvalSignatureId;
  const canView = currentUser.role === 'teacher' || currentUser.role === 'admin';
  const [signature, setSignature] = useState<ApprovalSignature | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (!signatureId || !canView) return;
    let active = true;
    setState('loading');
    getApprovalSignature(signatureId)
      .then((value) => { if (active) { setSignature(value); setState('ready'); } })
      .catch(() => { if (active) setState('error'); });
    return () => { active = false; };
  }, [signatureId, canView]);

  if (!signatureId || !canView) return null;
  return (
    <div className="mt-6 border-t border-slate-200 pt-5">
      <p className="mb-2 text-xs font-bold text-slate-500">승인 서명</p>
      {state === 'loading' && <p role="status" className="text-sm text-slate-500">서명을 불러오는 중입니다...</p>}
      {state === 'error' && <p role="alert" className="text-sm font-bold text-red-700">서명을 불러오지 못했습니다.</p>}
      {state === 'ready' && !signature && <p className="text-sm text-slate-500">서명을 조회할 수 없습니다.</p>}
      {state === 'ready' && signature && (
        <figure className="inline-block">
          <img src={signature.signatureData} alt={`${signature.signerName} 승인 서명`} className="h-24 rounded-xl border border-slate-200 bg-white" />
          <figcaption className="mt-1.5 text-xs text-slate-500">{signature.signerName} · {formatDateTime(signature.createdAt)}</figcaption>
        </figure>
      )}
    </div>
  );
}

interface RejectReasonFormProps {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
}

export function RejectReasonForm({ busy, onCancel, onSubmit }: RejectReasonFormProps) {
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();
  return (
    <form
      className="rounded-2xl border border-red-200 bg-red-50 p-4"
      onSubmit={(event) => { event.preventDefault(); if (trimmed) onSubmit(trimmed); }}
    >
      <label className="block text-sm font-black text-red-900">
        반려 사유
        <textarea
          autoFocus
          required
          rows={3}
          maxLength={REVIEW_NOTE_MAX_LENGTH}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="왜 반려하는지 적어주세요. 학생 알림에 그대로 표시됩니다."
          className="mt-2 block w-full resize-y rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-red-800">{reason.length} / {REVIEW_NOTE_MAX_LENGTH}자</span>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50">취소</button>
          <button type="submit" disabled={busy || !trimmed} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-700 px-4 text-sm font-black text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40">
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}{busy ? '처리 중...' : '반려 확정'}
          </button>
        </div>
      </div>
    </form>
  );
}
