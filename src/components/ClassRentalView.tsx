import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { User, RequestStatus } from '../types';
import { Clock, Check, Calendar, Trash2, ChevronDown, Bell, Save, Copy, Layout, CalendarDays } from 'lucide-react';
import { createClassRequest, getUserRequests } from '../lib/db';
import { getCurrentWeekOfMonth, validateSlots } from '../lib/validation';

interface ClassRentalViewProps {
  currentUser: User;
}

interface SelectedSlot {
  dayIdx: number;
  periodIdx: number;
}

interface WeeklyApplication {
  id: string;
  year: number;
  month: number;
  week: number;
  weekLabel: string;
  slots: SelectedSlot[];
  status: RequestStatus;
  appliedAt: string;
}

const PERIODS = [
  { label: '등교 전', time: '08:00 - 08:40' },
  { label: '1교시', time: '08:40 - 09:30' },
  { label: '2교시', time: '09:40 - 10:30' },
  { label: '3교시', time: '10:40 - 11:30' },
  { label: '4교시', time: '11:40 - 12:30' },
  { label: '점심시간', time: '12:30 - 13:30' },
  { label: '5교시', time: '13:30 - 14:20' },
  { label: '6교시', time: '14:30 - 15:20' },
  { label: '7교시', time: '15:30 - 16:20' },
];

const DAYS = ['월요일', '화요일', '수요일', '목요일', '금요일'];
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const WEEKS_IN_MONTH = [1, 2, 3, 4, 5];

export default function ClassRentalView({ currentUser }: ClassRentalViewProps) {
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(0);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedWeek, setSelectedWeek] = useState<number>(getCurrentWeekOfMonth());
  const [basket, setBasket] = useState<SelectedSlot[]>([]);
  const [templates, setTemplates] = useState<{ name: string; slots: SelectedSlot[] }[]>([]);
  const [submissions, setSubmissions] = useState<WeeklyApplication[]>([]);
  const [viewDetail, setViewDetail] = useState<WeeklyApplication | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const hasStudentId = Boolean(currentUser.studentId);

  useEffect(() => {
    try {
      const savedTemplates = localStorage.getItem(`icjs-templates-${currentUser.id}`);
      if (!savedTemplates) return;
      const parsed = JSON.parse(savedTemplates);
      if (Array.isArray(parsed)) setTemplates(parsed.slice(0, 20));
    } catch {
      setErrorMessage('저장된 시간표 템플릿을 읽지 못해 초기화했습니다.');
    }
  }, [currentUser.id]);

  useEffect(() => {
    const loadUserRequests = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const data = await getUserRequests(currentUser.id);
        const classRequests = data
          .filter((item) => item.type === 'class')
          .map((item) => ({
            id: item.id,
            year: item.rentalYear || new Date(item.startDate).getFullYear(),
            month: item.rentalMonth || 0,
            week: item.rentalWeek || 0,
            weekLabel: item.weekLabel || '교과 대여',
            slots: item.slots || [],
            status: item.status,
            appliedAt: item.createdAt.split('T')[0],
          }));

        setSubmissions(classRequests);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : '신청 내역을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    loadUserRequests();
  }, [currentUser.id]);

  const handlePeriodClick = (pIdx: number) => {
    const found = basket.some((slot) => slot.dayIdx === selectedDayIdx && slot.periodIdx === pIdx);
    if (found) {
      setBasket((prev) => prev.filter((slot) => !(slot.dayIdx === selectedDayIdx && slot.periodIdx === pIdx)));
      return;
    }
    setBasket((prev) => [...prev, { dayIdx: selectedDayIdx, periodIdx: pIdx }]);
  };

  const isSlotSelected = (dIdx: number, pIdx: number) => basket.some((slot) => slot.dayIdx === dIdx && slot.periodIdx === pIdx);

  const saveAsTemplate = () => {
    if (basket.length === 0) {
      alert('저장할 시간표 구성이 없습니다.');
      return;
    }

    const name = prompt('템플릿 이름을 입력하세요 (예: 1학기 고정 시간표)', `나의 템플릿 ${templates.length + 1}`);
    if (!name) return;

    const cleanName = name.trim().slice(0, 40);
    if (!cleanName) return;
    const newTemplates = [...templates, { name: cleanName, slots: [...basket] }].slice(-20);
    setTemplates(newTemplates);
    try {
      localStorage.setItem(`icjs-templates-${currentUser.id}`, JSON.stringify(newTemplates));
      setSuccessMessage('현재 구성을 템플릿으로 저장했습니다.');
    } catch {
      setErrorMessage('브라우저 저장 공간이 차단되어 템플릿을 저장하지 못했습니다.');
    }
  };

  const loadTemplate = (templateSlots: SelectedSlot[]) => {
    if (confirm('현재 작업을 지우고 템플릿을 불러올까요?')) {
      setBasket([...templateSlots]);
    }
  };

  const handleFinalSubmit = async () => {
    if (!hasStudentId) {
      setErrorMessage('학생 정보가 등록되지 않아 제출할 수 없습니다. 설정에서 학번을 입력해주세요.');
      return;
    }

    const slotError = validateSlots(basket);
    if (slotError) {
      setErrorMessage(slotError);
      return;
    }

    if (submissions.some((item) => item.year === selectedYear && item.month === selectedMonth && item.week === selectedWeek && ['pending', 'approved'].includes(item.status))) {
      setErrorMessage('선택한 주차에 처리 중인 신청이 이미 있습니다. 신청 내역을 확인해주세요.');
      setShowConfirmModal(false);
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      const weekLabel = `${selectedYear}년 ${selectedMonth}월 ${selectedWeek}주차`;
      const created = await createClassRequest({
        userId: currentUser.id,
        userName: currentUser.name,
        studentId: currentUser.studentId,
        year: selectedYear,
        month: selectedMonth,
        week: selectedWeek,
        weekLabel,
        slots: basket,
        reason: '교과 대여 신청',
      });

      setSubmissions((prev) => [
        {
          id: created.id,
          year: selectedYear,
          month: selectedMonth,
          week: selectedWeek,
          weekLabel,
          slots: [...basket],
          status: 'pending',
          appliedAt: new Date().toISOString().split('T')[0],
        },
        ...prev,
      ]);
      setBasket([]);
      setShowConfirmModal(false);
      setSuccessMessage(`${selectedYear}년 ${selectedMonth}월 ${selectedWeek}주차 신청이 제출되었습니다.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '제출 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-32">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 mb-3">주간 교과 대여 시스템</h1>
          <p className="text-slate-500 text-base font-medium">인천중산고 학생들을 위한 주간 시간표 신청 도구입니다.</p>
        </div>

        <div className="flex flex-wrap gap-3 max-w-full">
          <label className="bg-white border border-slate-200 rounded-xl px-3 flex items-center gap-2 shadow-sm text-[10px] font-black text-slate-400 uppercase">
            Year
            <select value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))} className="h-10 bg-transparent text-sm font-black text-slate-800 outline-none">
              {[new Date().getFullYear(), new Date().getFullYear() + 1].map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          <div className="max-w-full overflow-x-auto bg-white border border-slate-200 rounded-xl p-2 flex items-center gap-1 shadow-sm">
            <span className="px-3 text-[10px] font-black text-slate-400 uppercase">Month</span>
            <div className="flex gap-1">
              {MONTHS.map((m) => (
                <button
                  key={m}
                  onClick={() => setSelectedMonth(m)}
                  className={cn(
                    'w-8 h-8 rounded-lg text-xs font-bold transition-all',
                    selectedMonth === m ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700',
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-2 flex items-center gap-1 shadow-sm">
            <span className="px-3 text-[10px] font-black text-slate-400 uppercase">Week</span>
            <div className="flex gap-1">
              {WEEKS_IN_MONTH.map((w) => (
                <button
                  key={w}
                  onClick={() => setSelectedWeek(w)}
                  className={cn(
                    'w-8 h-8 rounded-lg text-xs font-bold transition-all',
                    selectedWeek === w ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700',
                  )}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center bg-slate-100 p-2 rounded-2xl border border-slate-200 mb-8 gap-4">
        <div className="flex gap-1.5 overflow-x-auto w-full md:w-auto">
          {DAYS.map((day, i) => (
            <button
              key={i}
              onClick={() => setSelectedDayIdx(i)}
              className={cn(
                'px-10 py-3 text-sm font-black rounded-xl transition-all relative whitespace-nowrap',
                selectedDayIdx === i
                  ? 'bg-white text-slate-900 shadow-xl ring-1 ring-slate-200'
                  : 'text-slate-400 hover:bg-white/50 hover:text-slate-600',
              )}
            >
              {day}
              {basket.some((s) => s.dayIdx === i) && (
                <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-blue-600 rounded-full border-2 border-white" />
              )}
            </button>
          ))}
        </div>

        <div className="flex gap-2 w-full md:w-auto px-2">
          <button
            onClick={saveAsTemplate}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition-all shadow-md"
          >
            <Save className="w-4 h-4" /> 템플릿 저장
          </button>
          <div className="relative group flex-1 md:flex-none">
            <button className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-black hover:bg-slate-50 transition-all shadow-sm">
              <Layout className="w-4 h-4" /> 불러오기
            </button>
            <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all z-50 p-2 overflow-hidden">
              <p className="text-[10px] font-black text-slate-400 px-3 py-2 uppercase">My Templates</p>
              {templates.length === 0 && <p className="text-[10px] text-slate-300 px-3 py-4 italic">저장된 템플릿 없음</p>}
              {templates.map((t, idx) => (
                <button
                  key={idx}
                  onClick={() => loadTemplate(t.slots)}
                  className="w-full text-left px-3 py-3 text-xs font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-all flex items-center justify-between group/item"
                >
                  {t.name}
                  <Copy className="w-3 h-3 opacity-0 group-hover/item:opacity-100" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {successMessage && <div role="status" className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-700">{successMessage}</div>}

      <div className="relative bg-white border-2 border-slate-100 rounded-[32px] shadow-2xl overflow-x-auto mb-12">
        <div className="min-w-[900px]">
        <div className="grid grid-cols-9 border-b border-slate-100 bg-slate-50/30">
          {PERIODS.map((period, i) => (
            <div key={i} className="py-6 text-center border-r border-slate-100 last:border-0 px-2">
              <p className={cn(
                'text-[10px] font-black uppercase tracking-[0.1em] mb-1.5',
                period.label === '등교 전' || period.label === '점심시간' ? 'text-blue-600' : 'text-slate-400',
              )}
              >
                {period.label}
              </p>
              <p className="text-[10px] text-slate-400 font-mono font-bold">{period.time}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-9 h-80">
          {PERIODS.map((_, pIdx) => {
            const isMine = isSlotSelected(selectedDayIdx, pIdx);

            return (
              <button
                type="button"
                key={pIdx}
                onClick={() => handlePeriodClick(pIdx)}
                aria-pressed={isMine}
                aria-label={`${DAYS[selectedDayIdx]} ${PERIODS[pIdx].label} ${isMine ? '선택 해제' : '선택'}`}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-4 py-8 border-r border-slate-100 last:border-0 transition-all cursor-pointer group',
                  isMine ? 'bg-blue-600/[0.04]' : 'hover:bg-slate-50/50',
                )}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className={cn(
                    'w-16 h-16 rounded-3xl border-2 transition-all duration-500 flex items-center justify-center shadow-sm',
                    isMine ? 'bg-blue-600 border-blue-600 shadow-[0_15px_30px_rgba(37,99,235,0.3)] scale-110' : 'bg-white border-slate-100 group-hover:border-slate-300',
                  )}>
                    {isMine ? (
                      <Check className="w-8 h-8 text-white stroke-[4]" />
                    ) : (
                      <div className="w-3 h-3 rounded-full bg-slate-100 group-hover:bg-slate-300 transition-colors" />
                    )}
                  </div>
                  <span className={cn(
                    'text-[10px] font-black uppercase tracking-widest transition-colors',
                    isMine ? 'text-blue-600' : 'text-slate-300 group-hover:text-slate-500',
                  )}
                  >
                    {isMine ? '신청됨' : '대여 가능'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          <div className="bg-white border border-slate-200 rounded-3xl p-10 shadow-xl">
            <div className="flex items-center justify-between mb-10">
              <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                <CalendarDays className="w-8 h-8 text-blue-600" />
                {selectedMonth}월 {selectedWeek}주차 신청 상세
              </h3>
            </div>

            <div className="space-y-4">
              {DAYS.map((day, dIdx) => {
                const daySlots = basket.filter((s) => s.dayIdx === dIdx).sort((a, b) => a.periodIdx - b.periodIdx);
                if (daySlots.length === 0) return null;

                return (
                  <div key={dIdx} className="bg-slate-50/50 border border-slate-200 rounded-[24px] p-6 flex items-center justify-between group">
                    <div className="flex items-center gap-8">
                      <div className="w-20 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-sm font-black text-blue-700 shadow-sm">
                        {day}
                      </div>
                      <div className="flex flex-wrap gap-2.5">
                        {daySlots.map((slot) => (
                          <span key={slot.periodIdx} className="px-5 py-2.5 bg-slate-900 text-white text-[11px] font-black rounded-xl shadow-lg ring-1 ring-white/10">
                            {PERIODS[slot.periodIdx].label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBasket((prev) => prev.filter((s) => s.dayIdx !== dIdx))}
                      aria-label={`${day} 선택 모두 지우기`}
                      className="p-3 text-slate-400 hover:text-red-500 hover:bg-white rounded-xl transition-all shadow-sm sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                );
              })}

              {basket.length === 0 && (
                <div className="py-24 text-center border-2 border-dashed border-slate-100 rounded-3xl">
                  <Clock className="w-12 h-12 text-slate-200 mx-auto mb-6" />
                  <p className="text-slate-400 font-bold text-lg">아직 구성된 일정이 없습니다.</p>
                  <p className="text-slate-300 text-sm mt-2">상단 시간표에서 필요한 교시를 선택해 주세요.</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-10 shadow-xl">
            <h3 className="text-2xl font-black text-slate-900 mb-10 flex items-center gap-3">
              <Bell className="w-8 h-8 text-amber-500" />
              나의 주간 신청 내역
            </h3>

            {loading ? (
              <div className="py-20 text-center text-slate-400 font-bold">신청 내역을 불러오는 중입니다...</div>
            ) : errorMessage ? (
              <div className="py-20 text-center text-red-600 font-bold">{errorMessage}</div>
            ) : submissions.length === 0 ? (
              <div className="py-20 text-center text-slate-400 font-bold">등록된 신청 내역이 없습니다.</div>
            ) : (
              <div className="space-y-4">
                {submissions.map((sub) => (
                  <motion.div
                    layout
                    key={sub.id}
                    onClick={() => setViewDetail(viewDetail?.id === sub.id ? null : sub)}
                    className={cn(
                      'border border-slate-100 rounded-[28px] overflow-hidden transition-all cursor-pointer group',
                      viewDetail?.id === sub.id ? 'ring-2 ring-blue-600 shadow-2xl scale-[1.02]' : 'hover:border-slate-300 hover:bg-slate-50',
                    )}
                  >
                    <div className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex items-center gap-7">
                        <div className={cn(
                          'w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg',
                          sub.status === 'approved' ? 'bg-emerald-500 text-white' : sub.status === 'rejected' || sub.status === 'cancelled' ? 'bg-red-500 text-white' : sub.status === 'returned' ? 'bg-slate-500 text-white' : 'bg-amber-500 text-white',
                        )}>
                          <Check className="w-8 h-8" />
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-1.5">
                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{sub.id} • {sub.appliedAt}</span>
                            <span className={cn(
                              'text-[10px] font-black px-2.5 py-1 rounded-full border shadow-sm',
                              sub.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : sub.status === 'rejected' || sub.status === 'cancelled' ? 'bg-red-50 text-red-600 border-red-100' : sub.status === 'returned' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-amber-50 text-amber-600 border-amber-100',
                            )}
                            >
                              {sub.status === 'approved' ? '승인 완료' : sub.status === 'rejected' ? '신청 반려' : sub.status === 'cancelled' ? '신청 취소' : sub.status === 'returned' ? '반납 완료' : '승인 대기'}
                            </span>
                          </div>
                          <h4 className="font-black text-xl text-slate-900">{sub.weekLabel} 대여 내역</h4>
                          <p className="text-sm font-bold text-slate-500 mt-1">총 {sub.slots.length}개 슬롯 구성됨</p>
                        </div>
                      </div>
                      <div className="flex items-center text-slate-400 font-bold text-sm">
                        {viewDetail?.id === sub.id ? '상세 닫기' : '상세 보기'}
                        <ChevronDown className={cn('ml-2 w-5 h-5 transition-transform', viewDetail?.id === sub.id && 'rotate-180')} />
                      </div>
                    </div>

                    <AnimatePresence>
                      {viewDetail?.id === sub.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="bg-slate-900 p-8 border-t border-slate-800"
                        >
                          <div className="grid grid-cols-6 gap-2">
                            <div className="h-10" />
                            {DAYS.map((d) => (
                              <div key={d} className="text-center text-[10px] font-black text-slate-500 uppercase">{d}</div>
                            ))}

                            {PERIODS.map((period, pIdx) => (
                              <div key={`row-${pIdx}`} className="contents">
                                <div className="text-right pr-4 text-[10px] font-black text-slate-600 pt-2 flex items-center justify-end">{period.label}</div>
                                {DAYS.map((_, dIdx) => {
                                  const isActive = sub.slots.some((slot) => slot.dayIdx === dIdx && slot.periodIdx === pIdx);
                                  return (
                                    <div
                                      key={`s-${dIdx}-${pIdx}`}
                                      className={cn(
                                        'h-10 rounded-lg transition-all',
                                        isActive ? 'bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)] ring-1 ring-white/10' : 'bg-slate-800/30',
                                      )}
                                    />
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-slate-900 text-white p-12 rounded-[40px] shadow-2xl sticky top-10 border border-white/5 overflow-hidden">
            <div className="relative z-10">
              <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center mb-10 shadow-2xl shadow-blue-500/40">
                <Calendar className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-3xl font-black mb-8 leading-tight italic">
                통합 신청서<br />전송 준비 완료
              </h3>
              <p className="text-slate-400 text-base leading-relaxed mb-12 font-medium">
                {selectedYear}년 {selectedMonth}월 {selectedWeek}주차에 사용할 노트북 세트 대여를 신청합니다. <br /><br />
                설정하신 모든 교시를 하나의 통합된 일정으로 전송하여 관리자의 승인을 받습니다.
              </p>
              {errorMessage && (
                <div className="mb-6 rounded-2xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
                  {errorMessage}
                </div>
              )}
              {!hasStudentId && (
                <div className="mb-6 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm">
                  학생 정보가 등록되어 있지 않습니다. 먼저 설정에서 학번을 입력해주세요.
                </div>
              )}
              <button
                disabled={basket.length === 0 || saving || !hasStudentId}
                onClick={() => setShowConfirmModal(true)}
                className="w-full bg-blue-600 text-white py-6 rounded-2xl font-black text-lg hover:bg-blue-700 disabled:bg-slate-800 disabled:text-slate-600 transition-all shadow-[0_20px_40px_rgba(37,99,235,0.3)] active:scale-[0.98]"
              >
                {saving ? '제출 중...' : '최종 신청 제출하기'}
              </button>
            </div>
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-blue-600/10 rounded-full blur-[90px] pointer-events-none opacity-50" />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-labelledby="class-submit-title">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl"
              onClick={() => setShowConfirmModal(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              className="bg-white rounded-[40px] shadow-2xl w-full max-w-md relative z-10 p-16 text-center"
            >
              <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-10 ring-[12px] ring-blue-50/50">
                <Clock className="w-12 h-12" />
              </div>
              <h3 id="class-submit-title" className="text-3xl font-black text-slate-900 mb-4">신청을 제출할까요?</h3>
              <p className="text-slate-500 text-base mb-14 leading-relaxed font-bold">
                {selectedMonth}월 {selectedWeek}주차 전체 일정이<br />하나의 통합 신청으로 저장됩니다.
              </p>

              <div className="grid grid-cols-2 gap-5">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="py-5 text-sm font-black text-slate-400 hover:text-slate-700 transition-all"
                >
                  다시 검토하기
                </button>
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={saving}
                  className="bg-slate-900 text-white py-5 rounded-2xl font-black text-sm hover:bg-black shadow-xl transition-all active:scale-95"
                >
                  {saving ? '제출 중...' : '네, 제출합니다'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
