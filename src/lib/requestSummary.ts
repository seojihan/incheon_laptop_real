import { LaptopRequest, RequestStatus, RequestType } from '../types';
import { formatRequestSlot } from './rentalSchedule';

export const requestTypeLabel: Record<RequestType, string> = { home: '가정 대여', class: '교과 대여' };

export const requestStatusLabel: Record<RequestStatus, string> = {
  pending: '승인 대기',
  approved: '승인 완료',
  rejected: '반려',
  returned: '반납 완료',
  cancelled: '신청 취소',
};

// The one-line "when" shown on a collapsed card.
export const formatRentalWhen = (request: LaptopRequest) => {
  if (request.type === 'home') {
    return `${request.startDate}${request.endDate ? ` ~ ${request.endDate}` : ''}`;
  }
  const slots = request.slots ?? [];
  if (slots.length === 0) return request.weekLabel || request.startDate;
  const first = formatRequestSlot(slots[0], request.startDate, request.weekLabel);
  return slots.length === 1 ? first : `${first} 외 ${slots.length - 1}개 교시`;
};

export interface ActivityEvent {
  key: string;
  at: string;
  title: string;
  detail: string;
  tone: 'neutral' | 'approved' | 'rejected';
  requestId: string;
}

// A student's activity, newest first, built from timestamps on their requests.
export const buildStudentActivity = (requests: LaptopRequest[]): ActivityEvent[] => {
  const events: ActivityEvent[] = [];
  requests.forEach((request) => {
    const label = requestTypeLabel[request.type];
    const when = formatRentalWhen(request);
    events.push({ key: `${request.id}-created`, at: request.createdAt, title: `${label} 신청`, detail: when, tone: 'neutral', requestId: request.id });
    if (request.reviewedAt && ['approved', 'returned'].includes(request.status)) {
      events.push({ key: `${request.id}-approved`, at: request.reviewedAt, title: `${label} 승인`, detail: `${request.notebookNumber ?? '-'}번 노트북 배정`, tone: 'approved', requestId: request.id });
    }
    if (request.reviewedAt && request.status === 'rejected') {
      events.push({ key: `${request.id}-rejected`, at: request.reviewedAt, title: `${label} 반려`, detail: request.reviewNote || '사유 없음', tone: 'rejected', requestId: request.id });
    }
    if (request.status === 'returned' && request.updatedAt) {
      events.push({ key: `${request.id}-returned`, at: request.updatedAt, title: '노트북 반납', detail: `${request.notebookNumber ?? '-'}번 노트북`, tone: 'neutral', requestId: request.id });
    }
    if (request.status === 'cancelled' && request.updatedAt) {
      events.push({ key: `${request.id}-cancelled`, at: request.updatedAt, title: `${label} 신청 취소`, detail: when, tone: 'neutral', requestId: request.id });
    }
  });
  return events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
};
