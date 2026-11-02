import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Check, ChevronDown, X } from 'lucide-react';
import { formatRentalWhen } from '../../lib/requestSummary';
import { cn } from '../../lib/utils';
import { LaptopRequest } from '../../types';
import { RejectReasonForm, RequestFields, RequestTypeBadge, requestTypeTheme } from './RequestParts';

interface RequestCardProps {
  request: LaptopRequest;
  canManage: boolean;
  busy: boolean;
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onOpenDetail: () => void;
}

export default function RequestCard({ request, canManage, busy, selected, onSelectedChange, onApprove, onReject, onOpenDetail }: RequestCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const theme = requestTypeTheme[request.type];

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.18 }}
      className={cn(
        'overflow-hidden rounded-3xl border border-l-[6px] border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md',
        theme.stripe,
        selected && 'ring-2 ring-slate-900/30',
      )}
    >
      <div className="flex items-stretch">
        {canManage && (
          <label className="flex w-12 shrink-0 cursor-pointer items-start justify-center pt-5 sm:w-14 sm:pt-6">
            <input
              type="checkbox"
              checked={selected}
              disabled={busy}
              onChange={(event) => onSelectedChange(event.target.checked)}
              aria-label={`${request.studentId} ${request.userName} 신청 선택`}
              className="h-5 w-5 cursor-pointer rounded accent-slate-900"
            />
          </label>
        )}
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className={cn('flex min-w-0 flex-1 items-center gap-3 py-4 pr-4 text-left sm:py-5 sm:pr-5', !canManage && 'pl-4 sm:pl-5')}
        >
          <span className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-center md:gap-5">
            <RequestTypeBadge type={request.type} />
            <span className="min-w-0 md:w-52 md:shrink-0">
              <span className="font-mono text-sm font-bold text-slate-500">{request.studentId}</span>
              <span className="ml-2 text-lg font-black text-slate-900">{request.userName}</span>
            </span>
            <span className="min-w-0 text-sm font-bold text-slate-600">{formatRentalWhen(request)}</span>
          </span>
          <ChevronDown className={cn('h-5 w-5 shrink-0 text-slate-400 transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
          <span className="sr-only">{expanded ? '접기' : '펼치기'}</span>
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 p-4 sm:p-6">
          <div className={cn('rounded-2xl border p-5 sm:p-6', theme.panel)}>
            <RequestFields request={request} />
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <button type="button" onClick={onOpenDetail} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 hover:bg-slate-50 sm:mr-auto">
              상세 페이지<ArrowRight className="h-4 w-4" />
            </button>
            {canManage && (
              <>
                <button type="button" onClick={() => setRejecting((value) => !value)} disabled={busy} aria-expanded={rejecting} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-600 transition hover:border-red-200 hover:text-red-600 disabled:opacity-50">
                  <X className="h-5 w-5" />반려 처리
                </button>
                <button type="button" onClick={onApprove} disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-50">
                  <Check className="h-5 w-5" />{busy ? '처리 중...' : '신청 승인'}
                </button>
              </>
            )}
          </div>
          {rejecting && canManage && (
            <div className="mt-3">
              <RejectReasonForm busy={busy} onCancel={() => setRejecting(false)} onSubmit={onReject} />
            </div>
          )}
        </div>
      )}
    </motion.article>
  );
}
