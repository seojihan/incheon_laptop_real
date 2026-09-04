import { MonitorCog } from 'lucide-react';
import { isDemoModeEnabled } from '../lib/supabase';

export default function ConfigurationView() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-5">
      <section className="max-w-xl w-full rounded-3xl border border-white/10 bg-slate-900 p-8 sm:p-10 shadow-2xl">
        <MonitorCog className="w-12 h-12 text-cyan-300 mb-6" />
        <h1 className="text-3xl font-black">Supabase 연결 설정이 필요합니다</h1>
        <p className="text-slate-300 mt-4 leading-7">프로젝트 루트의 <code className="text-cyan-200">.env</code> 파일에 프로젝트 URL과 게시 가능 키를 입력한 뒤 개발 서버를 다시 시작하세요.</p>
        <pre className="mt-6 rounded-2xl bg-black/40 p-5 text-sm text-cyan-100 overflow-auto">{`VITE_SUPABASE_URL=https://프로젝트.supabase.co\nVITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`}</pre>
        <p className="mt-5 text-xs text-slate-400">로컬 기능만 확인하려면 <code>VITE_ENABLE_DEMO_MODE=true</code>를 사용할 수 있습니다. 데모 모드는 실제 운영 데이터와 연결되지 않습니다.</p>
        {isDemoModeEnabled && <p className="mt-4 rounded-xl bg-amber-400/10 border border-amber-300/20 px-4 py-3 text-sm text-amber-100">데모 모드가 켜져 있지만 페이지가 갱신되지 않았습니다. 개발 서버를 다시 시작하세요.</p>}
      </section>
    </main>
  );
}
