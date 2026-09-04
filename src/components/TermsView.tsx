import { ArrowLeft, FileCheck2, Printer, ShieldCheck } from 'lucide-react';
import { TERMS_EFFECTIVE_DATE, TERMS_VERSION, termsSections } from '../content/terms.ko';

interface TermsViewProps {
  onBack?: () => void;
}

export default function TermsView({ onBack }: TermsViewProps) {
  return (
    <div className="max-w-6xl mx-auto pb-24 print:max-w-none">
      <header className="rounded-[2rem] bg-slate-950 px-6 py-8 text-white sm:px-10 sm:py-12 print:bg-white print:text-black print:border print:border-slate-300">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex rounded-full bg-cyan-300/10 px-3 py-1 text-xs font-black text-cyan-200 print:text-black">공개 문서 · 버전 {TERMS_VERSION}</span>
            <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-5xl">서비스 이용약관</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 print:text-slate-700">
              인천중산고등학교 노트북 대여 관리 서비스의 계정, 신청, 장비 관리, 개인정보 및 분쟁 처리 원칙입니다.
            </p>
          </div>
          <ShieldCheck className="h-14 w-14 text-cyan-300 print:text-slate-800" aria-hidden="true" />
        </div>
        <div className="mt-8 grid gap-3 text-xs font-bold text-slate-300 sm:grid-cols-3 print:text-slate-700">
          <div className="rounded-2xl border border-white/10 px-4 py-3 print:border-slate-300">시행 예정일<br /><span className="mt-1 block text-white print:text-black">{TERMS_EFFECTIVE_DATE}</span></div>
          <div className="rounded-2xl border border-white/10 px-4 py-3 print:border-slate-300">운영기관<br /><span className="mt-1 block text-white print:text-black">[학교 승인 후 입력]</span></div>
          <div className="rounded-2xl border border-white/10 px-4 py-3 print:border-slate-300">공식 문의처<br /><span className="mt-1 block text-white print:text-black">[담당 부서 승인 후 입력]</span></div>
        </div>
      </header>

      <div className="mt-6 flex flex-wrap gap-3 print:hidden">
        {onBack && (
          <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" /> 이전 화면
          </button>
        )}
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-black text-white hover:bg-zinc-800">
          <Printer className="h-4 w-4" /> 인쇄·PDF 저장
        </button>
      </div>

      <section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-6 sm:p-8">
        <h2 className="flex items-center gap-2 font-black text-amber-950"><FileCheck2 className="h-5 w-5" /> 운영 전 확정 필요</h2>
        <p className="mt-3 text-sm leading-7 text-amber-900">
          이 문서는 실제 서비스 구조를 반영한 정밀 초안입니다. 운영기관명, 문의처, 개인정보 보유 기간, 대여·변상 기준과 학교 내부 절차를 입력한 뒤 학교·교육청·개인정보 보호 또는 법률 담당자의 검토를 받아 확정해야 합니다.
        </p>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label="약관 목차" className="h-fit rounded-3xl border border-slate-200 bg-white p-5 lg:sticky lg:top-4 print:hidden">
          <h2 className="px-2 text-sm font-black text-slate-900">약관 목차</h2>
          <ol className="mt-3 max-h-[65vh] space-y-1 overflow-auto text-xs font-bold text-slate-600">
            {termsSections.map((section) => (
              <li key={section.id}><a href={`#terms-${section.id}`} className="block rounded-xl px-2 py-2 hover:bg-slate-100 hover:text-black">{section.title}</a></li>
            ))}
          </ol>
        </nav>

        <article className="space-y-5">
          {termsSections.map((section) => (
            <section id={`terms-${section.id}`} key={section.id} className="scroll-mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 print:break-inside-avoid print:shadow-none">
              <h2 className="text-xl font-black text-slate-950">{section.title}</h2>
              <div className="mt-4 space-y-3 text-sm leading-7 text-slate-700">
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.items && (
                  <ul className="list-disc space-y-2 pl-5">
                    {section.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
