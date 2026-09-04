import { useState, FormEvent } from 'react';
import { motion } from 'motion/react';
import { Calendar as CalendarIcon, CheckCircle2 } from 'lucide-react';
import { User, LaptopRequest } from '../types';
import { createHomeRequest } from '../lib/db';
import { todayLocalIso, validateHomeRental } from '../lib/validation';

interface HomeRentalViewProps {
  currentUser: User;
}

export default function HomeRentalView({ currentUser }: HomeRentalViewProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [request, setRequest] = useState<LaptopRequest | null>(null);
  const hasStudentId = Boolean(currentUser.studentId);
  const minDate = todayLocalIso();
  const maxDate = (() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  })();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!hasStudentId) {
      setErrorMessage('학생 정보가 등록되지 않아 신청할 수 없습니다. 설정에서 학번을 입력해주세요.');
      setStatus('error');
      return;
    }

    const validationError = validateHomeRental(startDate, endDate, reason);
    if (validationError) {
      setErrorMessage(validationError);
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    try {
      const created = await createHomeRequest({
        userId: currentUser.id,
        userName: currentUser.name,
        studentId: currentUser.studentId,
        startDate,
        endDate,
        reason: reason || '가정용 노트북 대여 신청',
      });
      setRequest(created);
      setStatus('success');
    } catch (error: any) {
      setErrorMessage(error instanceof Error ? error.message : '대여 신청 중 오류가 발생했습니다.');
      setStatus('error');
    }
  };

  const resetForm = () => {
    setStartDate('');
    setEndDate('');
    setReason('');
    setStatus('idle');
    setRequest(null);
    setErrorMessage(null);
  };

  if (status === 'success' && request) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-12 rounded-lg border border-slate-200 shadow-xl flex flex-col items-center max-w-sm text-center"
        >
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-8 border border-emerald-100">
            <CheckCircle2 className="text-emerald-500 w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">대여 신청 완료</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-8">
            {currentUser.name} 학생의 가정 대여 신청이 정상적으로 접수되었습니다.
          </p>
          <div className="text-left w-full mb-8 space-y-3">
            <p className="text-sm text-slate-600"><span className="font-bold">요청 번호:</span> {request.id}</p>
            <p className="text-sm text-slate-600"><span className="font-bold">대여 기간:</span> {request.startDate} — {request.endDate}</p>
            <p className="text-sm text-slate-600"><span className="font-bold">사유:</span> {request.reason}</p>
          </div>
          <button
            onClick={resetForm}
            className="w-full bg-blue-600 text-white py-4 rounded-md font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
          >
            다른 신청 계속하기
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-800 mb-3">가정 대여 신청</h1>
        <p className="text-slate-500 text-base">학습을 위한 노트북 장기 대여 신청서입니다.</p>
      </div>

      <div className="grid md:grid-cols-5 gap-10">
        <div className="md:col-span-3 space-y-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">기본 정보</label>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 p-4 rounded-md">
                  <p className="text-[10px] uppercase text-slate-400 font-bold mb-1">Student Name</p>
                  <p className="font-semibold text-slate-700">{currentUser.name}</p>
                </div>
                <div className="bg-white border border-slate-200 p-4 rounded-md">
                  <p className="text-[10px] uppercase text-slate-400 font-bold mb-1">Student ID</p>
                  <p className="font-bold font-mono text-slate-700">{currentUser.studentId}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">대여 기간 설정</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="home-start-date" className="text-xs font-bold text-slate-600">대여 시작일</label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="date"
                      id="home-start-date"
                      value={startDate}
                      min={minDate}
                      max={maxDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        if (endDate && endDate < e.target.value) setEndDate(e.target.value);
                        if (status === 'error') setStatus('idle');
                      }}
                      required
                      className="w-full bg-white border border-slate-200 rounded-md pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all text-slate-600"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="home-end-date" className="text-xs font-bold text-slate-600">반납 예정일</label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="date"
                      id="home-end-date"
                      value={endDate}
                      min={startDate || minDate}
                      max={maxDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        if (status === 'error') setStatus('idle');
                      }}
                      required
                      className="w-full bg-white border border-slate-200 rounded-md pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all text-slate-600"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between gap-4"><label htmlFor="home-reason" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">특이 사항 (선택)</label><span className="text-xs text-slate-400">{reason.length}/500</span></div>
              <textarea
                id="home-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                placeholder="관리자가 알아야 할 특이 사항이 있다면 입력해 주세요."
                className="w-full bg-white border border-slate-200 rounded-md p-5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all min-h-[100px] text-slate-600"
              />
            </div>

            {!hasStudentId && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 font-bold">
                학생 정보가 등록되어 있지 않습니다. 먼저 <span className="font-black">설정</span>에서 학번을 입력해주세요.
              </div>
            )}

            {status === 'error' && errorMessage && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-bold">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'loading' || !hasStudentId}
              className="w-full bg-blue-600 text-white py-4 rounded-md font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all mt-4 disabled:opacity-60"
            >
              {status === 'loading' ? '접수 중...' : '대여 신청 접수'}
            </button>
          </form>
        </div>

        <div className="md:col-span-2 space-y-6">
          <div className="bg-slate-900 text-white p-8 rounded-lg shadow-xl border border-slate-800">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
              대여 준수 사항
            </h3>
            <ul className="space-y-4">
              {[
                '학습 목적 이외의 사용을 금지합니다.',
                '파손 시 즉시 학교 행정실로 보고하십시오.',
                '대여 기한을 초과하지 않도록 주의하십시오.',
                '반납 시 초기화 상태를 유지하십시오.',
              ].map((text, i) => (
                <li key={i} className="flex gap-3 text-sm text-slate-400 leading-relaxed">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShieldCheck({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
