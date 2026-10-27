import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { User, RequestStatus } from '../types';
import { Clock, Check, Calendar, Trash2, ChevronDown, Bell, Save, Copy, Layout, CalendarDays } from 'lucide-react';
import { createClassRequest, getUserRequests } from '../lib/db';
import { todayLocalIso, validateClassRentalSelection } from '../lib/validation';
import {
  ClassRentalWeek,
  formatRequestSlot,
  formatShortSchoolDate,
  getClassRentalWeeks,
  getDefaultClassRentalWeek,
  getFirstAvailableDay,
  getRequestSlotDate,
  hasCalendarWeekLabel,
  PERIODS,
  WEEKDAYS,
} from '../lib/rentalSchedule';

interface ClassRentalViewProps {
  currentUser: User;
  onOpenRecords: (requestId?: string) => void;
  onOpenSettings: () => void;
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
  startDate: string;
  slots: SelectedSlot[];
  status: RequestStatus;
  appliedAt: string;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function ClassRentalView({ currentUser, onOpenRecords, onOpenSettings }: ClassRentalViewProps) {
  const initialToday = todayLocalIso();
  const initialYear = Number(initialToday.slice(0, 4));
  const initialMonth = Number(initialToday.slice(5, 7));
  const initialWeeks = getClassRentalWeeks(initialYear, initialMonth, initialToday);
  const initialWeek = getDefaultClassRentalWeek(initialWeeks);
  const initialWeekData = initialWeeks.find((week) => week.week === initialWeek);
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(getFirstAvailableDay(initialWeekData, initialToday));
  const [selectedYear, setSelectedYear] = useState<number>(initialYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(initialMonth);
  const [selectedWeek, setSelectedWeek] = useState<number>(initialWeek);
  const [basket, setBasket] = useState<SelectedSlot[]>([]);
  const [templates, setTemplates] = useState<{ name: string; slots: SelectedSlot[] }[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [submissions, setSubmissions] = useState<WeeklyApplication[]>([]);
  const [viewDetail, setViewDetail] = useState<WeeklyApplication | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [scheduleNotice, setScheduleNotice] = useState<string | null>(null);
  const hasStudentId = Boolean(currentUser.studentId);
  const todayIso = todayLocalIso();
  const weeks = useMemo(() => getClassRentalWeeks(selectedYear, selectedMonth, todayIso), [selectedYear, selectedMonth, todayIso]);
  const selectedWeekData = weeks.find((week) => week.week === selectedWeek) ?? weeks[0];
  const selectedDayDate = selectedWeekData?.datesByDay[selectedDayIdx] ?? null;
  const dayIsAvailable = Boolean(selectedDayDate && selectedDayDate >= todayIso);
  const currentWeekRequest = submissions.find((item) => {
    if (!['pending', 'approved'].includes(item.status)) return false;
    if (item.year === selectedYear && item.month === selectedMonth && item.week === selectedWeek) return true;
    return item.slots.some((slot) => {
      const selectedDate = selectedWeekData?.datesByDay[slot.dayIdx];
      if (!selectedDate) return false;
      const existingDate = getRequestSlotDate(item.startDate, slot.dayIdx, hasCalendarWeekLabel(item.weekLabel));
      return selectedDate === existingDate;
    });
  });
  const currentWeekHasRequest = Boolean(currentWeekRequest);

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
            year: item.rentalYear || Number(item.startDate.slice(0, 4)),
            month: item.rentalMonth || Number(item.startDate.slice(5, 7)),
            week: item.rentalWeek || 0,
            weekLabel: item.weekLabel || '교과 대여',
            startDate: item.startDate,
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

  const changePeriod = (year: number, month: number) => {
    const nextWeeks = getClassRentalWeeks(year, month, todayLocalIso());
    const nextWeekNumber = getDefaultClassRentalWeek(nextWeeks);
    const nextWeek = nextWeeks.find((week) => week.week === nextWeekNumber);
    const nextToday = todayLocalIso();
    const nextDayIdx = getFirstAvailableDay(nextWeek, nextToday);
    const retained = basket.filter((slot) => {
      const date = nextWeek?.datesByDay[slot.dayIdx];
      return Boolean(date && date >= nextToday && PERIODS[slot.periodIdx]);
    });
    if (retained.length !== basket.length) {
      setScheduleNotice(`${basket.length - retained.length}개 선택은 새 기간에 없는 날짜라 제외했어요.`);
    } else if (basket.length > 0) {
      setScheduleNotice('선택한 교시는 유지했어요. 새 날짜에 맞는지 아래 요약에서 확인해 주세요.');
    } else {
      setScheduleNotice(null);
    }
    setSelectedYear(year);
    setSelectedMonth(month);
    setSelectedWeek(nextWeekNumber);
    setSelectedDayIdx(nextDayIdx);
    setBasket(retained);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const changeWeek = (week: ClassRentalWeek) => {
    if (!week.available) return;
    const nextToday = todayLocalIso();
    const nextDayIdx = getFirstAvailableDay(week, nextToday);
    const retained = basket.filter((slot) => {
      const date = week.datesByDay[slot.dayIdx];
      return Boolean(date && date >= nextToday && PERIODS[slot.periodIdx]);
    });
    if (retained.length !== basket.length) {
      setScheduleNotice(`${basket.length - retained.length}개 선택은 새 주간에 없는 날짜라 제외했어요.`);
    } else if (basket.length > 0) {
      setScheduleNotice('선택한 교시는 유지했어요. 새 날짜에 맞는지 아래 요약에서 확인해 주세요.');
    } else {
      setScheduleNotice(null);
    }
    setSelectedWeek(week.week);
    setSelectedDayIdx(nextDayIdx);
    setBasket(retained);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

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
      const allowedSlots = templateSlots.filter((slot) => {
        const date = selectedWeekData?.datesByDay[slot.dayIdx];
        return Boolean(date && date >= todayLocalIso() && PERIODS[slot.periodIdx]);
      });
      if (allowedSlots.length !== templateSlots.length) {
        setScheduleNotice(`${templateSlots.length - allowedSlots.length}개 선택은 이 주간에 없는 날짜라 제외했어요.`);
      } else {
        setScheduleNotice('저장한 구성을 불러왔어요. 날짜와 교시를 확인해 주세요.');
      }
      setBasket(allowedSlots);
      setShowTemplates(false);
    }
  };

  const handleFinalSubmit = async () => {
    if (!hasStudentId) {
      setErrorMessage('학생 정보가 등록되지 않아 제출할 수 없습니다. 설정에서 학번을 입력해주세요.');
      return;
    }

    if (!selectedWeekData) {
      setErrorMessage('신청할 수 있는 날짜가 있는 주간을 선택해주세요.');
      return;
    }

    const slotError = validateClassRentalSelection({
      year: selectedYear,
      month: selectedMonth,
      week: selectedWeek,
      weekStartDate: selectedWeekData.mondayDate,
      slots: basket,
    });
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
    const weekLabel = `${selectedYear}년 ${selectedMonth}월 ${selectedWeek}주차 · ${selectedWeekData.dateLabel}`;
      const created = await createClassRequest({
        userId: currentUser.id,
        userName: currentUser.name,
        studentId: currentUser.studentId,
        year: selectedYear,
        month: selectedMonth,
        week: selectedWeek,
        weekStartDate: selectedWeekData.mondayDate,
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
          startDate: selectedWeekData.mondayDate,
          slots: [...basket],
          status: 'pending',
          appliedAt: new Date().toISOString().split('T')[0],
        },
        ...prev,
      ]);
      setBasket([]);
      setShowConfirmModal(false);
      setScheduleNotice(null);
      setSuccessMessage(`${weekLabel} 교과 대여 신청을 접수했어요. 담당자 승인 후 장비가 배정됩니다.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '제출 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl pb-16">
      <header className="mb-6">
        <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-800"><CalendarDays className="h-4 w-4" />교과 대여</span>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">주간 교과 대여</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">실제 날짜가 표시된 수업 주간을 고르고 필요한 교시를 신청하세요.</p>
      </header>

      <section aria-label="대여 주차 선택" className="mb-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-black text-slate-500">대여할 달</p>
            <div className="flex items-center gap-2">
              <label className="shrink-0 rounded-xl border border-slate-200 bg-[#fbfaf7] px-3 text-xs font-bold text-slate-600">
                연도
                <select aria-label="대여 연도" value={selectedYear} onChange={(event) => changePeriod(Number(event.target.value), selectedMonth)} className="ml-2 h-10 bg-transparent text-sm font-black text-slate-800">
                  {[Number(todayIso.slice(0, 4)), Number(todayIso.slice(0, 4)) + 1].map((year) => <option key={year} value={year}>{year}년</option>)}
                </select>
              </label>
              <div className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-slate-200 bg-[#fbfaf7] p-1.5">
                <div className="flex min-w-max gap-1" role="group" aria-label="대여 월">
                  {MONTHS.map((month) => {
                    const monthIsPast = selectedYear === Number(todayIso.slice(0, 4)) && month < Number(todayIso.slice(5, 7));
                    return <button type="button" key={month} onClick={() => changePeriod(selectedYear, month)} disabled={monthIsPast} aria-pressed={selectedMonth === month} className={cn('h-9 min-w-9 rounded-lg px-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:text-slate-300', selectedMonth === month ? 'bg-blue-700 text-white shadow-sm disabled:bg-slate-300 disabled:text-white' : 'text-slate-600 hover:bg-white disabled:hover:bg-transparent')}>
                      {month}월
                    </button>;
                  })}
                </div>
              </div>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-black text-slate-500">수업 주간</p>
            <div className="flex max-w-full flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-[#fbfaf7] p-1.5" role="group" aria-label="대여 주차">
              {weeks.map((week) => <button type="button" key={week.week} onClick={() => changeWeek(week)} disabled={!week.available} aria-pressed={selectedWeek === week.week} aria-label={`${week.week}주차, ${week.dateLabel}${week.available ? '' : ', 신청 마감'}`} className={cn('flex min-h-12 min-w-20 flex-col items-center justify-center rounded-lg px-2 py-1 text-xs font-bold leading-4 transition disabled:cursor-not-allowed disabled:text-slate-300', selectedWeek === week.week ? 'bg-blue-700 text-white shadow-sm disabled:bg-slate-300 disabled:text-white' : 'text-slate-600 hover:bg-white disabled:bg-slate-100')}><span>{week.week}주</span><span className={cn('text-[9px] font-semibold', selectedWeek === week.week ? 'text-blue-100' : 'text-slate-500')}>{week.dateLabel.replace(/[()]/g, '')}</span></button>)}
            </div>
          </div>
          <div className="rounded-xl bg-blue-50 px-4 py-3 text-center md:min-w-40">
            <p className="text-sm font-black text-blue-900">{selectedMonth}월 {selectedWeek}주차</p>
            <p className="mt-1 text-xs font-bold text-blue-800">{selectedWeekData?.dateLabel ?? '신청 가능한 날짜 없음'}</p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">표시된 날짜가 실제 신청 날짜예요. 지난 날짜는 선택할 수 없고, 학교 행사·휴업일은 학교 일정표에서 확인해 주세요.</p>
      </section>

      <section className="mb-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label="요일과 시간 선택">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 overflow-x-auto rounded-2xl bg-[#f7f5ef] p-1.5" role="group" aria-label="대여 요일">
            {WEEKDAYS.map((day, index) => {
              const date = selectedWeekData?.datesByDay[index] ?? null;
              const selectable = Boolean(date && date >= todayIso && !currentWeekHasRequest);
              return <button type="button" key={day.short} onClick={() => setSelectedDayIdx(index)} disabled={!selectable} aria-pressed={selectedDayIdx === index} aria-label={`${day.full} ${date ? formatShortSchoolDate(date) : '해당 주간에 없음'}${selectable ? '' : ', 선택 불가'}`} className={cn('relative min-h-10 shrink-0 rounded-xl px-3 text-sm font-bold transition sm:px-4 disabled:cursor-not-allowed disabled:text-slate-300', selectedDayIdx === index ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 disabled:bg-slate-200 disabled:text-slate-500' : 'text-slate-600 hover:bg-white/70 disabled:hover:bg-transparent')}>
                <span className="block">{day.short}</span><span className="mt-0.5 block text-[10px] font-semibold">{date ? `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}` : '—'}</span>
                {basket.some((slot) => slot.dayIdx === index) && <span aria-label="선택한 교시 있음" className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-blue-700" />}
              </button>
            })}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={saveAsTemplate} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-xs font-black text-white transition hover:bg-blue-800 sm:flex-none"><Save className="h-4 w-4" />구성 저장</button>
            <button type="button" onClick={() => setShowTemplates((open) => !open)} aria-expanded={showTemplates} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 transition hover:bg-slate-50 sm:flex-none"><Layout className="h-4 w-4" />저장한 구성</button>
          </div>
        </div>
        {showTemplates && <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-3" aria-label="저장한 시간표 구성">
          <p className="mb-2 px-1 text-xs font-black text-slate-500">내 시간표 구성</p>
          {templates.length === 0 ? <p className="px-1 py-3 text-sm text-slate-500">저장한 구성이 없습니다.</p> : <div className="flex flex-wrap gap-2">{templates.map((template, index) => <button type="button" key={`${template.name}-${index}`} onClick={() => loadTemplate(template.slots)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 hover:border-blue-300 hover:text-blue-800">{template.name}<Copy className="h-3.5 w-3.5" /></button>)}</div>}
        </div>}
        <p className="mb-3 text-sm font-black text-slate-800">{WEEKDAYS[selectedDayIdx].full} {selectedDayDate ? formatShortSchoolDate(selectedDayDate) : ''} · 필요한 교시를 선택하세요</p>
        {successMessage && <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{successMessage}</div>}
        {errorMessage && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold leading-5 text-red-700">{errorMessage}</div>}
        {scheduleNotice && <div role="status" className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold leading-5 text-blue-800">{scheduleNotice}</div>}
        {currentWeekHasRequest && <div role="status" className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-900 sm:flex-row sm:items-center sm:justify-between"><span>이 기간과 겹치는 진행 중 신청이 있어요. 기존 신청 내용을 확인해 주세요.</span><button type="button" onClick={() => onOpenRecords(currentWeekRequest?.id)} className="shrink-0 font-black underline underline-offset-4">신청 내역 보기</button></div>}

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-3">
            {PERIODS.map((period, periodIdx) => {
              const selected = isSlotSelected(selectedDayIdx, periodIdx);
              return <button type="button" key={period.label} onClick={() => handlePeriodClick(periodIdx)} disabled={!dayIsAvailable || currentWeekHasRequest} aria-pressed={selected} aria-label={`${WEEKDAYS[selectedDayIdx].full} ${selectedDayDate ? formatShortSchoolDate(selectedDayDate) : ''} ${period.label} ${selected ? '선택 해제' : '선택'}`} className={cn('min-h-24 rounded-2xl border p-3 text-left transition sm:min-h-28 sm:p-4 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:opacity-60', selected ? 'border-blue-500 bg-blue-50 shadow-sm ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50')}>
                <div className="mb-3 flex items-center justify-between gap-2"><span className={cn('text-sm font-black', selected ? 'text-blue-900' : 'text-slate-800')}>{period.label}</span><span className={cn('flex h-6 w-6 items-center justify-center rounded-full border', selected ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-300 bg-white text-transparent')}><Check className="h-3.5 w-3.5" /></span></div>
                <p className="font-mono text-xs font-bold text-slate-500">{period.time}</p>
                <p className={cn('mt-2 text-[11px] font-bold', selected ? 'text-blue-800' : 'text-slate-400')}>{selected ? '선택됨' : '눌러서 선택'}</p>
              </button>;
            })}
          </div>

          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-24 sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="font-black text-slate-900">신청 구성</h2><p className="mt-1 text-xs text-slate-500">{selectedMonth}월 {selectedWeek}주차</p></div><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-800">{basket.length}개 교시</span></div>
            <div className="mb-4 max-h-64 space-y-3 overflow-y-auto">
              {WEEKDAYS.map((day, dayIdx) => {
                const daySlots = basket.filter((slot) => slot.dayIdx === dayIdx).sort((a, b) => a.periodIdx - b.periodIdx);
                if (!daySlots.length) return null;
                const date = selectedWeekData?.datesByDay[dayIdx];
                return <div key={day.short} className="rounded-xl border border-slate-200 bg-[#fbfaf7] p-3"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-black text-slate-700">{day.full}{date ? ` · ${formatShortSchoolDate(date)}` : ''}</p><button type="button" onClick={() => setBasket((prev) => prev.filter((slot) => slot.dayIdx !== dayIdx))} aria-label={`${day.full} 선택 모두 지우기`} className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button></div><div className="flex flex-wrap gap-1.5">{daySlots.map((slot) => <span key={slot.periodIdx} className="rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-slate-700">{PERIODS[slot.periodIdx].label}</span>)}</div></div>;
              })}
              {basket.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center"><Calendar className="mx-auto mb-2 h-5 w-5 text-slate-400" /><p className="text-xs font-bold leading-5 text-slate-600">요일을 선택하고 필요한 교시를 눌러주세요.</p></div>}
            </div>
            {!hasStudentId && <div className="mb-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900"><p>학생 정보가 등록되어 있지 않아 신청할 수 없습니다.</p><button type="button" onClick={onOpenSettings} className="mt-2 font-black underline underline-offset-4">개인 설정에서 학번 입력하기</button></div>}
            {errorMessage && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-xs leading-5 text-red-700">{errorMessage}</p>}
            <button type="button" disabled={basket.length === 0 || saving || !hasStudentId} onClick={() => setShowConfirmModal(true)} className="w-full rounded-xl bg-blue-700 px-4 py-3.5 text-sm font-black text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">{saving ? '제출 중...' : '신청 내용 확인'}</button>
            <p className="mt-3 text-center text-[11px] leading-5 text-slate-500">선택한 모든 시간은 한 번의 신청으로 접수됩니다.</p>
          </aside>
        </div>
      </section>

      <section aria-label="나의 주간 신청 내역" className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-800"><Bell className="h-5 w-5" /></div>
          <div><h2 className="font-black text-slate-900">나의 주간 신청 내역</h2><p className="text-xs text-slate-500">이전에 접수한 시간표와 처리 상태를 확인할 수 있어요.</p></div>
        </div>

        {loading ? <div className="py-12 text-center text-sm font-medium text-slate-500" role="status">신청 내역을 불러오는 중입니다...</div>
          : submissions.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center"><Clock className="mx-auto mb-3 h-6 w-6 text-slate-400" /><p className="font-bold text-slate-700">등록된 신청 내역이 없습니다.</p></div>
            : <div className="grid gap-3 lg:grid-cols-2">
              {submissions.map((submission) => {
                const expanded = viewDetail?.id === submission.id;
                const statusLabel = submission.status === 'approved' ? '승인 완료' : submission.status === 'rejected' ? '반려' : submission.status === 'cancelled' ? '취소' : submission.status === 'returned' ? '반납 완료' : '승인 대기';
                const statusClass = submission.status === 'approved' ? 'bg-emerald-50 text-emerald-800' : submission.status === 'rejected' || submission.status === 'cancelled' ? 'bg-red-50 text-red-700' : submission.status === 'returned' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-800';
                return <article key={submission.id} className="overflow-hidden rounded-2xl border border-slate-200">
                  <button type="button" onClick={() => setViewDetail(expanded ? null : submission)} aria-expanded={expanded} className="flex w-full items-center justify-between gap-4 p-4 text-left transition hover:bg-slate-50">
                    <span className="min-w-0"><span className="mb-1 flex flex-wrap items-center gap-2"><span className="font-black text-slate-900">{submission.weekLabel}</span><span className={cn('rounded-full px-2.5 py-1 text-[10px] font-black', statusClass)}>{statusLabel}</span></span><span className="block text-xs text-slate-500">{submission.appliedAt} 접수 · {submission.slots.length}개 교시</span>{!hasCalendarWeekLabel(submission.weekLabel) && <span className="mt-1 block text-[11px] text-slate-500">이전 신청은 정확한 날짜 없이 요일만 저장되어 있어요.</span>}</span>
                    <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-500 transition', expanded && 'rotate-180')} />
                  </button>
                  <AnimatePresence>{expanded && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-slate-200 bg-[#fbfaf7]">
                    <div className="space-y-2 p-4">
                      {WEEKDAYS.map((day, dayIdx) => {
                        const daySlots = submission.slots.filter((slot) => slot.dayIdx === dayIdx).sort((a, b) => a.periodIdx - b.periodIdx);
                        if (!daySlots.length) return null;
                        const dayDate = formatRequestSlot(daySlots[0], submission.startDate, submission.weekLabel).split(' · ')[0];
                        return <div key={day.short} className="flex flex-col gap-2 sm:flex-row sm:items-start"><span className="w-32 shrink-0 pt-1 text-xs font-black text-slate-600">{dayDate}</span><div className="flex flex-wrap gap-1.5">{daySlots.map((slot) => <span key={slot.periodIdx} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700">{PERIODS[slot.periodIdx].label} · {PERIODS[slot.periodIdx].time}</span>)}</div></div>;
                      })}
                    </div>
                  </motion.div>}</AnimatePresence>
                </article>;
              })}
            </div>}
      </section>
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
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative z-10 p-8 sm:p-10 text-center"
            >
              <div className="w-16 h-16 bg-blue-50 text-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Clock className="w-8 h-8" />
              </div>
              <h3 id="class-submit-title" className="text-3xl font-black text-slate-900 mb-4">신청을 제출할까요?</h3>
              <p className="text-slate-600 text-sm mb-4 leading-7 font-medium">
                {selectedYear}년 {selectedMonth}월 {selectedWeek}주차 · {selectedWeekData?.dateLabel}<br />{basket.length}개 교시를 한 번에 신청하며, 승인 후 노트북이 배정됩니다.
              </p>
              <div className="mb-6 max-h-48 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left">
                {WEEKDAYS.map((day, dayIdx) => {
                  const daySlots = basket.filter((slot) => slot.dayIdx === dayIdx).sort((a, b) => a.periodIdx - b.periodIdx);
                  if (daySlots.length === 0) return null;
                  const date = selectedWeekData?.datesByDay[dayIdx];
                  return <p key={day.short} className="text-xs leading-5 text-slate-700"><strong className="text-slate-900">{day.full}{date ? ` ${formatShortSchoolDate(date)}` : ''}</strong><span> · {daySlots.map((slot) => PERIODS[slot.periodIdx].label).join(', ')}</span></p>;
                })}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="min-h-12 py-3 text-sm font-black text-slate-600 hover:text-slate-900 transition-all"
                >
                  다시 검토하기
                </button>
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={saving}
                  className="bg-slate-900 text-white py-3 rounded-2xl font-black text-sm hover:bg-slate-800 shadow-sm transition-all active:scale-95"
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
