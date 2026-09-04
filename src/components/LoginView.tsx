import { useState } from 'react';
import { motion } from 'motion/react';
import { Monitor, Chrome, ShieldCheck } from 'lucide-react';
import { signInWithGoogle } from '../lib/auth';
import { isDemoModeEnabled } from '../lib/supabase';

interface LoginViewProps {
  authError?: string | null;
  onAuthError?: (message: string | null) => void;
  onAuthSuccess?: (session: any) => void;
  onOpenTerms: () => void;
}

export default function LoginView({ authError, onAuthError, onAuthSuccess, onOpenTerms }: LoginViewProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      onAuthError?.(null);
      setIsLoading(true);
      const result = await signInWithGoogle();
      if (result && 'session' in result && result.session) {
        onAuthSuccess?.(result.session);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '구글 로그인 중 오류가 발생했습니다.';
      onAuthError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden font-sans">
      {/* Background accents */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/5 rounded-full blur-[120px]" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-white/5 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md z-10 px-6"
      >
        <div className="flex flex-col items-center mb-10">
          <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(255,255,255,0.1)]">
            <Monitor className="text-black w-7 h-7" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-white italic">INCHEON JUNGSAN</h1>
          <p className="text-white/40 text-[10px] font-black tracking-[0.4em] uppercase mt-1 italic">Digital Asset Deck</p>
        </div>

        <div className="bg-white rounded-[40px] p-10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-black/5 rounded-full blur-3xl -mr-16 -mt-16" />
          
          <button 
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full bg-black text-white py-5 rounded-2xl font-black text-sm mb-8 flex items-center justify-center gap-3 hover:bg-zinc-800 transition-all shadow-2xl active:scale-[0.98] italic disabled:bg-zinc-500"
          >
            <Chrome className="w-5 h-5 text-white" />
            {isLoading ? '연결 중...' : isDemoModeEnabled ? '데모 계정으로 시작하기' : '구글 계정으로 시작하기'}
          </button>

          {authError ? (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-bold">
              {authError}
            </div>
          ) : null}
        </div>

        <div className="mt-8 bg-white/5 rounded-2xl p-6 border border-white/10 backdrop-blur-xl">
          <p className="text-[10px] text-white/40 leading-relaxed italic">
            <span className="font-black text-white uppercase tracking-widest block mb-2 underline decoration-white/20 underline-offset-4">Guide:</span>
            Google 계정으로 로그인한 뒤, 할당된 역할에 필요한 프로필 정보를 입력해 주세요.
          </p>
          {isDemoModeEnabled && <p className="mt-3 rounded-xl bg-amber-300/10 px-3 py-2 text-[10px] font-bold text-amber-100">로컬 데모 모드입니다. 입력 내용은 이 브라우저에만 저장됩니다.</p>}
          <button type="button" onClick={onOpenTerms} className="mt-4 inline-flex items-center gap-2 text-[10px] font-black text-white/70 underline decoration-white/20 underline-offset-4 hover:text-white">
            <ShieldCheck className="h-3.5 w-3.5" /> 로그인 전 이용약관 확인
          </button>
        </div>

        <p className="mt-12 text-center text-white/20 text-[9px] font-black uppercase tracking-[0.4em] italic">
          © 2026 INCHEON JUNGSAN HIGH SCHOOL DECK
        </p>
      </motion.div>
    </div>
  );
}
