import {
  ArrowDownRight,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  CircleHelp,
  ClipboardList,
  FileCheck2,
  Laptop,
  NotebookTabs,
  Pause,
  Play,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '../lib/utils';
import { User, UserRole, ViewType } from '../types';

interface HomeDashboardProps {
  currentUser: User;
  unreadCount: number;
  onNavigate: (view: ViewType) => void;
}

interface ServiceCard {
  id: ViewType;
  title: string;
  description: string;
  label: string;
  icon: typeof BookOpen;
  tone: string;
  badge?: string;
}

const roleLabel: Record<UserRole, string> = {
  student: '학생',
  helper: '관리 도우미',
  teacher: '교사',
  admin: '관리자',
};

const getServices = (role: UserRole, unreadCount: number): ServiceCard[] => {
  const services: ServiceCard[] = [];

  if (role === 'student' || role === 'helper') {
    services.push(
      { id: 'class-rental', title: '교과 대여 신청', description: '요일과 교시를 선택해 수업용 노트북을 신청합니다.', label: '주간 시간표', icon: BookOpen, tone: 'bg-blue-50 text-blue-700', badge: '신청하기' },
      { id: 'home-rental', title: '가정 대여 신청', description: '학습에 필요한 기간을 정해 장기 대여를 신청합니다.', label: '최대 30일', icon: CalendarDays, tone: 'bg-amber-50 text-amber-700', badge: '신청하기' },
    );
  }

  services.push({ id: 'records', title: '대여 기록 확인', description: '신청 상태와 배정된 장비, 반납 여부를 확인합니다.', label: '신청 현황', icon: NotebookTabs, tone: 'bg-violet-50 text-violet-700' });

  if (role !== 'student') {
    services.push(
      { id: 'admin-approval', title: '승인 관리', description: '담당 범위의 신청을 검토하고 처리합니다.', label: '담당자 메뉴', icon: CheckSquare, tone: 'bg-emerald-50 text-emerald-700' },
      { id: 'notebook-inventory', title: '노트북 현황', description: '대여 가능 장비와 현재 배정 정보를 살펴봅니다.', label: '장비 관리', icon: Laptop, tone: 'bg-cyan-50 text-cyan-800' },
    );
  }

  services.push(
    { id: 'notifications', title: '알림 확인', description: '신청 접수와 승인·반려 결과를 확인합니다.', label: unreadCount > 0 ? `새 알림 ${unreadCount}개` : '새 알림 없음', icon: Bell, tone: 'bg-rose-50 text-rose-700', badge: unreadCount > 0 ? '확인하기' : undefined },
    { id: 'info', title: '이용 안내', description: '내 역할에 맞는 이용 절차와 운영 기준을 확인합니다.', label: '처음 이용하나요?', icon: CircleHelp, tone: 'bg-orange-50 text-orange-700' },
    { id: 'guide', title: '학생 빠른 가이드', description: '신청부터 장비 수령·반납까지 필요한 내용을 봅니다.', label: '빠른 설명서', icon: ClipboardList, tone: 'bg-indigo-50 text-indigo-700' },
  );

  return services;
};

export default function HomeDashboard({ currentUser, unreadCount, onNavigate }: HomeDashboardProps) {
  const services = getServices(currentUser.role, unreadCount);
  const isStudentFlow = currentUser.role === 'student' || currentUser.role === 'helper';
  const primaryAction: ViewType = isStudentFlow ? 'class-rental' : 'admin-approval';
  const phrases = ['쉽게', '간편하게', '안전하게'];
  const carouselSlides = [
    { label: '교과 대여', title: '수업에 필요한 순간', description: '시간표를 고르고, 필요한 장비를 신청해요.', image: '/images/hero-class.svg', alt: '교과 대여 화면이 열린 노트북과 수업 시간표' },
    { label: '가정 대여', title: '공부가 이어지는 곳', description: '집에서도 학습을 편하게 이어가요.', image: '/images/hero-home.svg', alt: '가정 대여 안내가 열린 노트북과 따뜻한 책상' },
    { label: '수령·반납', title: '안심할 수 있는 관리', description: '배정 확인부터 반납까지 한눈에 살펴요.', image: '/images/hero-return.svg', alt: '안전한 반납 확인 표시가 있는 노트북' },
  ];
  const [typedPhrase, setTypedPhrase] = useState('');
  const [activeSlide, setActiveSlide] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [autoPlayPaused, setAutoPlayPaused] = useState(false);
  const [pointerInside, setPointerInside] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const isCarouselPaused = autoPlayPaused || pointerInside || focusInside;

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(preference.matches);
    updatePreference();
    preference.addEventListener('change', updatePreference);
    return () => preference.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setTypedPhrase(phrases[0]);
      return;
    }

    let phraseIndex = 0;
    let characterIndex = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;
    const advance = () => {
      const phrase = phrases[phraseIndex];
      characterIndex += deleting ? -1 : 1;
      setTypedPhrase(phrase.slice(0, characterIndex));

      if (!deleting && characterIndex === phrase.length) {
        deleting = true;
        timer = setTimeout(advance, 1500);
        return;
      }
      if (deleting && characterIndex === 0) {
        deleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        timer = setTimeout(advance, 300);
        return;
      }
      timer = setTimeout(advance, deleting ? 48 : 95);
    };

    timer = setTimeout(advance, 450);
    return () => clearTimeout(timer);
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion || isCarouselPaused) return;
    const timer = setInterval(() => setActiveSlide((slide) => (slide + 1) % carouselSlides.length), 6000);
    return () => clearInterval(timer);
  }, [isCarouselPaused, reducedMotion, carouselSlides.length]);

  const showSlide = (index: number) => {
    setActiveSlide((index + carouselSlides.length) % carouselSlides.length);
  };

  return (
    <div className="mx-auto max-w-7xl pb-10">
      <section className="relative isolate text-slate-950">
        <div className="relative z-10 -mt-[10px] grid items-center gap-9 px-2 py-5 sm:px-4 sm:py-8 xl:grid-cols-[.92fr_1.08fr] xl:gap-12 xl:px-2 xl:py-4">
          <div className="max-w-2xl">
            <h1 className="max-w-none text-5xl font-black leading-[1.04] tracking-[-0.055em] text-slate-950 sm:text-6xl lg:text-7xl xl:text-[5.5rem]">
              노트북 대여,<br />
              <span className="text-[#a36e22]">더 </span><span className="sr-only">쉽게</span><span aria-hidden="true" className="text-[#a36e22]">{typedPhrase}</span><span aria-hidden="true" className="ml-1 inline-block h-[0.78em] w-[3px] translate-y-1 rounded-full bg-amber-500 motion-safe:animate-pulse" />
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              필요한 장비를 신청하고, 승인과 수령·반납 현황까지 한곳에서 편하게 확인하세요.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button type="button" onClick={() => onNavigate(primaryAction)} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-amber-300 px-6 py-3.5 text-sm font-black text-slate-950 shadow-md shadow-amber-950/10 transition hover:-translate-y-0.5 hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-amber-700 sm:text-base">
                {isStudentFlow ? '교과 대여 신청' : '승인 대기 확인'} <ArrowRight className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => onNavigate('records')} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-slate-500 sm:text-base">
                대여 기록 보기 <ArrowDownRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div
            className="relative mx-auto w-full max-w-[560px] xl:ml-auto xl:mr-0 xl:max-w-[600px]"
            onMouseEnter={() => setPointerInside(true)}
            onMouseLeave={() => setPointerInside(false)}
            onFocusCapture={() => setFocusInside(true)}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusInside(false);
            }}
          >
            <div className="relative aspect-square overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_24px_64px_-34px_rgba(15,23,42,.3)] sm:rounded-[2rem] xl:rounded-[2.25rem]">
              {carouselSlides.map((slide, index) => (
                <div key={slide.image} aria-hidden={index !== activeSlide} className={cn('absolute inset-0 transition duration-700 motion-reduce:transition-none', index === activeSlide ? 'scale-100 opacity-100' : 'pointer-events-none scale-[1.025] opacity-0')}>
                  <img src={slide.image} alt={index === activeSlide ? slide.alt : ''} className="h-full w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/35 to-transparent px-5 pb-24 pt-28 text-white sm:px-7 sm:pb-24 sm:pt-32">
                    <p className="mb-1.5 text-[10px] font-extrabold tracking-[0.18em] text-amber-200 sm:text-[11px]">{slide.label}</p>
                    <p className="text-xl font-black tracking-tight sm:text-2xl">{slide.title}</p>
                    <p className="mt-1.5 text-xs font-medium text-white/85 sm:text-sm">{slide.description}</p>
                  </div>
                </div>
              ))}
              <svg aria-hidden="true" viewBox="0 0 320 280" className="pointer-events-none absolute right-0 top-0 z-10 h-auto w-[36%] opacity-90">
                <g fill="none" stroke="#776f5e" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M323 1C293 23 278 42 263 67c-13 22-31 35-52 48-20 13-31 34-48 51-20 19-39 33-52 59" strokeWidth="5" />
                  <path d="M281 39c-18-14-34-18-53-15m48 30c-20-3-34 1-49 13m14 22c-18-12-34-14-51-10m32 31c-19-4-35 1-48 13m-7 11c-17-12-31-13-47-9m21 31c-18-5-32 0-44 12m20 14c-17-9-30-9-44-3" strokeWidth="3" />
                  <path d="M269 45c-8-4-14-8-19-14m24 13c5-8 10-13 16-16M221 95c-7-7-13-11-20-13m22 14c4-8 9-13 15-17M150 166c-8-4-15-6-21-6m20 8c4-8 9-13 15-17" stroke="#a47b70" strokeWidth="2.5" />
                </g>
                <g fill="#6e8974">
                  <ellipse cx="249" cy="18" rx="7" ry="15" transform="rotate(-56 249 18)" /><ellipse cx="269" cy="20" rx="7" ry="15" transform="rotate(30 269 20)" />
                  <ellipse cx="238" cy="32" rx="7" ry="15" transform="rotate(-43 238 32)" /><ellipse cx="258" cy="37" rx="7" ry="15" transform="rotate(36 258 37)" />
                  <ellipse cx="222" cy="52" rx="7" ry="15" transform="rotate(-48 222 52)" /><ellipse cx="241" cy="56" rx="7" ry="15" transform="rotate(36 241 56)" />
                  <ellipse cx="204" cy="76" rx="7" ry="15" transform="rotate(-53 204 76)" /><ellipse cx="225" cy="81" rx="7" ry="15" transform="rotate(34 225 81)" />
                  <ellipse cx="185" cy="99" rx="7" ry="15" transform="rotate(-49 185 99)" /><ellipse cx="205" cy="103" rx="7" ry="15" transform="rotate(34 205 103)" />
                  <ellipse cx="163" cy="124" rx="7" ry="15" transform="rotate(-52 163 124)" /><ellipse cx="183" cy="129" rx="7" ry="15" transform="rotate(34 183 129)" />
                  <ellipse cx="144" cy="150" rx="7" ry="15" transform="rotate(-51 144 150)" /><ellipse cx="164" cy="156" rx="7" ry="15" transform="rotate(34 164 156)" />
                  <ellipse cx="120" cy="180" rx="7" ry="15" transform="rotate(-53 120 180)" /><ellipse cx="141" cy="185" rx="7" ry="15" transform="rotate(34 141 185)" />
                  <ellipse cx="97" cy="211" rx="7" ry="15" transform="rotate(-51 97 211)" /><ellipse cx="117" cy="216" rx="7" ry="15" transform="rotate(34 117 216)" />
                </g>
                <g fill="#91a38a" opacity=".9">
                  <ellipse cx="274" cy="57" rx="6" ry="13" transform="rotate(-52 274 57)" /><ellipse cx="291" cy="61" rx="6" ry="13" transform="rotate(29 291 61)" />
                  <ellipse cx="246" cy="95" rx="6" ry="13" transform="rotate(-51 246 95)" /><ellipse cx="263" cy="100" rx="6" ry="13" transform="rotate(32 263 100)" />
                  <ellipse cx="208" cy="139" rx="6" ry="13" transform="rotate(-54 208 139)" /><ellipse cx="225" cy="145" rx="6" ry="13" transform="rotate(32 225 145)" />
                  <ellipse cx="164" cy="181" rx="6" ry="13" transform="rotate(-52 164 181)" /><ellipse cx="181" cy="187" rx="6" ry="13" transform="rotate(34 181 187)" />
                </g>
                <g transform="translate(249 24)">
                  <ellipse cy="-9" rx="8" ry="12" fill="#d89d99" /><ellipse cx="9" cy="-3" rx="8" ry="12" transform="rotate(72 9 -3)" fill="#e7b8ad" />
                  <ellipse cx="6" cy="8" rx="8" ry="12" transform="rotate(144 6 8)" fill="#d99d99" /><ellipse cx="-6" cy="8" rx="8" ry="12" transform="rotate(216 -6 8)" fill="#e8b9ae" />
                  <ellipse cx="-9" cy="-3" rx="8" ry="12" transform="rotate(288 -9 -3)" fill="#d99d99" /><circle r="3.5" fill="#c89543" />
                </g>
                <g transform="translate(204 111) scale(.82)">
                  <ellipse cy="-9" rx="8" ry="12" fill="#d89d99" /><ellipse cx="9" cy="-3" rx="8" ry="12" transform="rotate(72 9 -3)" fill="#e7b8ad" />
                  <ellipse cx="6" cy="8" rx="8" ry="12" transform="rotate(144 6 8)" fill="#d99d99" /><ellipse cx="-6" cy="8" rx="8" ry="12" transform="rotate(216 -6 8)" fill="#e8b9ae" />
                  <ellipse cx="-9" cy="-3" rx="8" ry="12" transform="rotate(288 -9 -3)" fill="#d99d99" /><circle r="3.5" fill="#c89543" />
                </g>
                <g transform="translate(132 179) scale(.7)">
                  <ellipse cy="-9" rx="8" ry="12" fill="#d89d99" /><ellipse cx="9" cy="-3" rx="8" ry="12" transform="rotate(72 9 -3)" fill="#e7b8ad" />
                  <ellipse cx="6" cy="8" rx="8" ry="12" transform="rotate(144 6 8)" fill="#d99d99" /><ellipse cx="-6" cy="8" rx="8" ry="12" transform="rotate(216 -6 8)" fill="#e8b9ae" />
                  <ellipse cx="-9" cy="-3" rx="8" ry="12" transform="rotate(288 -9 -3)" fill="#d99d99" /><circle r="3.5" fill="#c89543" />
                </g>
              </svg>
              <div className="absolute right-4 top-4 z-20 rounded-full border border-white/70 bg-white/85 px-3 py-1.5 text-[10px] font-extrabold tracking-wide text-slate-600 shadow-sm backdrop-blur sm:right-5 sm:top-5 sm:text-[11px]">
                {String(activeSlide + 1).padStart(2, '0')} <span className="mx-1 text-slate-300">/</span> {String(carouselSlides.length).padStart(2, '0')}
              </div>
              <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-2 sm:inset-x-5 sm:bottom-5">
                <div role="group" className="flex items-center gap-1.5 rounded-full border border-white/20 bg-slate-950/35 px-2.5 py-2 backdrop-blur-md" aria-label={`이미지 ${activeSlide + 1} / ${carouselSlides.length}`}>
                  {carouselSlides.map((slide, index) => <button key={slide.image} type="button" onClick={() => showSlide(index)} aria-label={`${index + 1}번 이미지: ${slide.title}`} aria-current={index === activeSlide ? 'true' : undefined} className={cn('h-2.5 rounded-full transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white', index === activeSlide ? 'w-6 bg-white' : 'w-2.5 bg-white/55 hover:bg-white/85')} />)}
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => showSlide(activeSlide - 1)} aria-label="이전 이미지" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-slate-950/40 text-white backdrop-blur-md transition hover:bg-slate-950/65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><ChevronLeft className="h-5 w-5" /></button>
                  <button type="button" onClick={() => showSlide(activeSlide + 1)} aria-label="다음 이미지" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-slate-950/40 text-white backdrop-blur-md transition hover:bg-slate-950/65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><ChevronRight className="h-5 w-5" /></button>
                  {!reducedMotion && <button type="button" onClick={() => setAutoPlayPaused((paused) => !paused)} aria-label={autoPlayPaused ? '자동 재생 시작' : '자동 재생 일시 정지'} aria-pressed={autoPlayPaused} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-slate-950/40 text-white backdrop-blur-md transition hover:bg-slate-950/65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{autoPlayPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}</button>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-9 sm:mt-12" aria-labelledby="services-heading">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-extrabold uppercase tracking-[0.17em] text-blue-700">Explore services</p><h2 id="services-heading" className="mt-1.5 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">자주 쓰는 메뉴</h2></div>
          <button type="button" onClick={() => onNavigate('info')} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-white hover:text-blue-700">이용 방법 보기 <ArrowRight className="h-3.5 w-3.5" /></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <button key={service.id} type="button" onClick={() => onNavigate(service.id)} className="group flex min-h-[166px] flex-col rounded-[1.5rem] border border-slate-200 bg-white p-5 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-950/[0.06] focus-visible:ring-2 focus-visible:ring-blue-600 sm:min-h-[182px] sm:p-6">
                <span className="flex w-full items-center justify-between gap-3">
                  <span className={cn('flex h-12 w-12 items-center justify-center rounded-2xl', service.tone)}><Icon className="h-5 w-5" /></span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">{service.label}</span>
                </span>
                <span className="mt-5 flex w-full items-center justify-between gap-3">
                  <span><span className="block text-base font-black text-slate-900">{service.title}</span><span className="mt-1.5 block max-w-xs text-xs leading-5 text-slate-500">{service.description}</span></span>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition group-hover:border-blue-700 group-hover:bg-blue-700 group-hover:text-white"><ArrowRight className="h-4 w-4" /></span>
                </span>
                {service.badge && <span className="sr-only">{service.badge}</span>}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-9 grid gap-5 lg:mt-12 lg:grid-cols-[1.1fr_.9fr]" aria-label="이용 절차와 내 정보">
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><ClipboardList className="h-5 w-5" /></span><div><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">Simple steps</p><h2 className="mt-0.5 text-lg font-black text-slate-900">신청부터 반납까지</h2></div></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            {[
              ['01', '정보 확인', '내 학년·반·번호를 확인해요.'],
              ['02', '대여 신청', '교시나 기간을 선택해요.'],
              ['03', '승인 확인', '알림과 기록에서 결과를 봐요.'],
              ['04', '수령·반납', '배정 장비를 확인하고 반납해요.'],
            ].map(([step, title, detail]) => <div key={step} className="rounded-2xl bg-slate-50 p-4"><span className="text-[10px] font-black tracking-widest text-blue-700">STEP {step}</span><p className="mt-2 text-sm font-black text-slate-900">{title}</p><p className="mt-1.5 text-[11px] leading-5 text-slate-500">{detail}</p></div>)}
          </div>
        </div>

        <div className="flex flex-col justify-between gap-5 rounded-[1.75rem] border border-amber-200 bg-[#fffaf0] p-5 sm:p-7">
          <div>
            <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800"><ShieldCheck className="h-5 w-5" /></span><div><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-amber-700">My workspace</p><h2 className="mt-0.5 text-lg font-black text-slate-900">내 이용 정보</h2></div></div>
            <div className="mt-5 rounded-2xl border border-amber-100 bg-white/80 p-4">
              <p className="text-xs font-bold text-slate-500">현재 이용 역할</p>
              <p className="mt-1 text-base font-black text-slate-900">{roleLabel[currentUser.role]}</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">{currentUser.studentId ? '대여 신청에 필요한 학생 정보가 등록되어 있습니다.' : currentUser.role === 'student' || currentUser.role === 'helper' ? '신청이 되지 않으면 개인 설정에서 학생 정보를 확인하세요.' : '담당 메뉴는 계정 권한 범위에 따라 표시됩니다.'}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onNavigate('settings')} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-blue-800"><Settings2 className="h-4 w-4" /> 개인 설정</button>
            <button type="button" onClick={() => onNavigate('terms')} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-amber-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:border-amber-400"><FileCheck2 className="h-4 w-4" /> 이용약관</button>
          </div>
        </div>
      </section>
    </div>
  );
}
