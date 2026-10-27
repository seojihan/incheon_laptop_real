import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, BookOpen, Chrome, Laptop, ShieldCheck, UserRound, UsersRound } from 'lucide-react';
import { LoginIntent, signInWithGoogle } from '../lib/auth';
import { isDemoModeEnabled } from '../lib/supabase';
import SchoolLogo from './SchoolLogo';

interface LoginViewProps {
  authError?: string | null;
  onAuthError?: (message: string | null) => void;
  onAuthSuccess?: (session: any) => void;
  onOpenTerms: () => void;
}

export default function LoginView({ authError, onAuthError, onAuthSuccess, onOpenTerms }: LoginViewProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loginIntent, setLoginIntent] = useState<LoginIntent>(() => {
    try { return window.localStorage.getItem('icjs-login-intent') === 'teacher' ? 'teacher' : 'student'; }
    catch { return 'student'; }
  });

  const handleGoogleLogin = async () => {
    try {
      onAuthError?.(null);
      setIsLoading(true);
      const result = await signInWithGoogle(loginIntent);
      if (result && 'session' in result && result.session) onAuthSuccess?.(result.session);
    } catch (error) {
      onAuthError?.(error instanceof Error ? error.message : '구글 로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#faf7f0] text-slate-900">
      <a href="#login-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-white focus:px-5 focus:py-3 focus:text-sm focus:font-bold focus:text-slate-900 focus:shadow-lg">본문으로 건너뛰기</a>
      <header className="relative z-10 border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <SchoolLogo className="h-10 w-10" />
            <span><span className="block text-sm font-black tracking-tight sm:text-base">인천중산고 노트북 포털</span><span className="mt-0.5 block text-[9px] font-extrabold tracking-[0.18em] text-slate-400">INCHEON JUNG SAN HIGH SCHOOL</span></span>
          </div>
          <button type="button" onClick={onOpenTerms} className="rounded-full px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100 hover:text-blue-700">이용약관</button>
        </div>
      </header>

      <main id="login-main" className="mx-auto grid min-h-[calc(100vh-72px)] max-w-7xl items-center gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[1.1fr_.9fr] lg:gap-16 lg:py-16">
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3.5 py-2 text-[11px] font-extrabold text-blue-800 shadow-sm"><ShieldCheck className="h-4 w-4" /> 학교 구성원을 위한 대여 관리 서비스</div>
          <h1 className="max-w-2xl text-4xl font-black leading-[1.14] tracking-tight text-slate-950 sm:text-5xl lg:text-[3.7rem]">노트북 대여,<br /><span className="text-blue-700">쉽고 빠르게</span> 시작하세요.</h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">학교에서 허용한 Google 계정으로 로그인하면 교과·가정 대여를 신청하고, 처리 현황과 장비 정보를 한곳에서 확인할 수 있습니다.</p>

          <div className="relative mt-9 max-w-xl overflow-hidden rounded-[2rem] bg-[#293d31] p-5 text-white shadow-xl shadow-slate-900/10 sm:p-7">
            <div aria-hidden="true" className="absolute -right-12 -top-20 h-52 w-52 rounded-full bg-cyan-400/20 blur-3xl" />
            <div className="relative flex items-start justify-between gap-4">
              <div><p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-cyan-200">One place, clear status</p><h2 className="mt-2 text-xl font-black sm:text-2xl">신청부터 반납까지<br />이용 흐름을 한눈에</h2></div>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-cyan-200"><BookOpen className="h-6 w-6" /></span>
            </div>
            <div className="relative mt-6 grid grid-cols-3 gap-2 text-center">
              {[['01', '신청'], ['02', '승인 확인'], ['03', '반납']].map(([number, label]) => <div key={number} className="rounded-2xl border border-white/10 bg-white/[0.07] px-2 py-3"><span className="block text-[10px] font-black text-amber-300">{number}</span><span className="mt-1 block text-xs font-bold text-white/90">{label}</span></div>)}
            </div>
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="order-first mx-auto w-full max-w-md lg:order-none">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/[0.06] sm:p-9">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><Laptop className="h-6 w-6" /></span>
            <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.16em] text-blue-700">Welcome back</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">로그인하고 계속하기</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">이용 유형을 선택해 주세요. 선생님은 담당 학년과 반을 입력한 뒤 바로 시작할 수 있습니다.</p>

            <fieldset className="mt-6">
              <legend className="mb-2 text-xs font-black text-slate-700">로그인 유형</legend>
              <div className="grid grid-cols-2 gap-2">
              {([
                { id: 'student' as const, label: '학생', icon: UserRound, detail: '대여 신청과 내 기록' },
                { id: 'teacher' as const, label: '선생님', icon: UsersRound, detail: '담당 반으로 바로 시작' },
              ]).map(({ id, label, icon: Icon, detail }) => (
                <label key={id} className={`cursor-pointer rounded-2xl border p-3 text-left transition ${loginIntent === id ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:bg-slate-50'} focus-within:ring-2 focus-within:ring-blue-300`}>
                  <input className="sr-only" type="radio" name="login-intent" value={id} checked={loginIntent === id} onChange={() => setLoginIntent(id)} />
                  <span className="flex items-center gap-2 text-sm font-black text-slate-900"><Icon className="h-4 w-4 text-blue-700" />{label}</span>
                  <span className="mt-1 block text-[11px] leading-4 text-slate-500">{detail}</span>
                </label>
              ))}
              </div>
            </fieldset>

            <button type="button" onClick={handleGoogleLogin} disabled={isLoading} className="mt-7 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-blue-700 px-5 py-4 text-sm font-black text-white shadow-lg shadow-blue-800/15 transition hover:bg-blue-800 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60">
              <Chrome className="h-5 w-5" />{isLoading ? '연결 중...' : isDemoModeEnabled ? '데모 계정으로 시작하기' : 'Google 계정으로 로그인'}<ArrowRight className="ml-auto h-4 w-4" />
            </button>

            {authError && <div role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold leading-6 text-red-700">{authError}</div>}
            {isDemoModeEnabled && <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-900">로컬 데모 모드입니다. 입력 내용은 이 브라우저에만 저장됩니다.</p>}

            <div className="mt-6 flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <p className="text-xs leading-5 text-slate-600">교사 유형은 담당 학년·반을 등록해 해당 반의 교사 메뉴를 사용합니다.</p>
            </div>
            <button type="button" onClick={onOpenTerms} className="mt-5 w-full rounded-xl py-2 text-xs font-bold text-slate-500 underline decoration-slate-300 underline-offset-4 transition hover:text-blue-700">로그인 전 이용약관 확인</button>
          </div>
          <p className="mt-5 text-center text-[11px] font-medium text-slate-400">계정 접속에 문제가 있으면 학교 담당자에게 문의해 주세요.</p>
        </motion.section>
      </main>
    </div>
  );
}
