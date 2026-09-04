import { ArrowLeft, Bell, CalendarDays, CheckCircle2, CircleHelp, ClipboardList, Laptop, Printer, RotateCcw, ShieldCheck } from 'lucide-react';

interface StudentGuideViewProps {
  onBack: () => void;
}

const statusItems = [
  ['승인 대기', '신청이 접수되어 담당자가 확인하기 전입니다. 이 상태에서는 본인이 취소할 수 있습니다.'],
  ['대여 중', '담당자가 승인하고 노트북 번호를 배정했습니다. 알림의 번호와 실물을 확인하세요.'],
  ['반려', '신청 조건이 맞지 않아 승인되지 않았습니다. 반려 사유를 확인하고 수정해 새로 신청하세요.'],
  ['신청 취소', '승인 전에 본인이 취소한 신청입니다. 장비는 배정되지 않습니다.'],
  ['반납 완료', '담당자가 실물 회수를 확인하고 시스템 처리를 마친 상태입니다.'],
] as const;

export default function StudentGuideView({ onBack }: StudentGuideViewProps) {
  return (
    <div className="mx-auto max-w-6xl pb-24 print:max-w-none">
      <header className="rounded-[2rem] bg-gradient-to-br from-blue-700 via-blue-800 to-slate-950 px-6 py-9 text-white sm:px-10 sm:py-12 print:border print:border-slate-300 print:bg-white print:text-black">
        <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-black">학생용 빠른 설명서</span>
        <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-5xl">노트북을 신청하고 반납하는 방법</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-blue-100 print:text-slate-700">
          처음 로그인한 순간부터 신청, 승인 확인, 장비 수령, 안전한 사용과 반납 완료까지 학생이 실제로 해야 할 일을 순서대로 설명합니다.
        </p>
      </header>

      <div className="mt-5 flex flex-wrap gap-3 print:hidden">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black hover:bg-slate-50">
          <ArrowLeft className="h-4 w-4" /> 이용 안내로 돌아가기
        </button>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-black text-white hover:bg-zinc-800">
          <Printer className="h-4 w-4" /> 인쇄·PDF 저장
        </button>
      </div>

      <section className="mt-8 rounded-3xl border border-blue-200 bg-blue-50 p-6 sm:p-8">
        <h2 className="flex items-center gap-3 text-xl font-black text-blue-950"><CheckCircle2 className="h-6 w-6" />시작하기 전에</h2>
        <ol className="mt-5 grid gap-3 text-sm leading-7 text-blue-950 sm:grid-cols-3">
          <li className="rounded-2xl bg-white p-5"><strong className="block">1. 본인 계정 사용</strong>학교가 허용한 Google 계정으로 로그인합니다. 친구 계정을 대신 사용하지 않습니다.</li>
          <li className="rounded-2xl bg-white p-5"><strong className="block">2. 학생 정보 확인</strong>개인 설정에서 이름, 학년, 반, 번호가 실제 정보와 같은지 확인합니다.</li>
          <li className="rounded-2xl bg-white p-5"><strong className="block">3. 기존 신청 확인</strong>대여 기록에서 처리 중이거나 반납하지 않은 신청이 없는지 먼저 확인합니다.</li>
        </ol>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-8">
          <h2 className="flex items-center gap-3 text-xl font-black"><CalendarDays className="h-6 w-6 text-blue-600" />교과 대여 신청</h2>
          <ol className="mt-5 space-y-3 text-sm leading-7 text-slate-700">
            <li><strong>1.</strong> 왼쪽 메뉴에서 <strong>교과 대여</strong>를 선택합니다.</li>
            <li><strong>2.</strong> 수업이 있는 연도, 월과 주차를 확인합니다.</li>
            <li><strong>3.</strong> 월요일부터 금요일까지 필요한 교시 칸을 선택합니다.</li>
            <li><strong>4.</strong> 잘못 선택한 교시는 다시 눌러 해제합니다.</li>
            <li><strong>5.</strong> 신청 내용을 확인한 후 통합 신청을 제출합니다.</li>
          </ol>
          <p className="mt-5 rounded-2xl bg-slate-100 p-4 text-sm leading-7 text-slate-700"><strong>예시:</strong> 9월 둘째 주 월요일 1·2교시와 수요일 5교시가 필요하면 세 칸을 선택해 한 번에 제출합니다.</p>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-8">
          <h2 className="flex items-center gap-3 text-xl font-black"><Laptop className="h-6 w-6 text-blue-600" />가정 대여 신청</h2>
          <ol className="mt-5 space-y-3 text-sm leading-7 text-slate-700">
            <li><strong>1.</strong> 왼쪽 메뉴에서 <strong>가정에 대여</strong>를 선택합니다.</li>
            <li><strong>2.</strong> 시작일과 반납 예정일을 선택합니다. 한 번에 최대 30일까지 신청할 수 있습니다.</li>
            <li><strong>3.</strong> 특이사항이 꼭 필요할 때만 500자 이내로 적습니다.</li>
            <li><strong>4.</strong> 대여 수칙과 기간을 다시 확인하고 신청을 제출합니다.</li>
            <li><strong>5.</strong> 기존 가정 대여가 대기 또는 승인 상태이면 먼저 해당 신청을 처리해야 합니다.</li>
          </ol>
          <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm leading-7 text-amber-900"><strong>개인정보 주의:</strong> 신청 사유에는 전화번호, 집 주소, 건강정보나 자세한 가정 사정을 적지 않습니다.</p>
        </section>
      </div>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-7 sm:p-9">
        <h2 className="flex items-center gap-3 text-xl font-black"><ClipboardList className="h-6 w-6 text-blue-600" />신청 상태 읽는 법</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {statusItems.map(([name, description]) => (
            <div key={name} className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
              <h3 className="font-black text-slate-950">{name}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-3xl bg-slate-950 p-7 text-white sm:p-9">
        <h2 className="flex items-center gap-3 text-xl font-black"><Bell className="h-6 w-6 text-cyan-300" />승인 이후 수령과 사용</h2>
        <ol className="mt-6 grid gap-4 text-sm leading-7 text-slate-200 md:grid-cols-2">
          <li className="rounded-2xl border border-white/10 p-5"><strong className="block text-white">1. 배정 번호 확인</strong>알림과 대여 기록에 표시된 노트북 번호를 확인합니다.</li>
          <li className="rounded-2xl border border-white/10 p-5"><strong className="block text-white">2. 실물 대조</strong>담당자와 함께 화면 번호와 노트북 자산 태그가 같은지 확인합니다.</li>
          <li className="rounded-2xl border border-white/10 p-5"><strong className="block text-white">3. 이상 상태 보고</strong>화면 파손, 충전기 누락, 전원 문제는 사용하기 전에 담당자에게 알립니다.</li>
          <li className="rounded-2xl border border-white/10 p-5"><strong className="block text-white">4. 승인 범위 준수</strong>승인된 목적, 기간과 장소에서만 사용하고 다른 사람에게 빌려주지 않습니다.</li>
        </ol>
      </section>

      <section className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-7 sm:p-9">
        <h2 className="flex items-center gap-3 text-xl font-black text-emerald-950"><RotateCcw className="h-6 w-6" />안전하게 반납하기</h2>
        <ol className="mt-5 space-y-3 text-sm leading-7 text-emerald-950">
          <li><strong>1.</strong> 개인 파일을 필요한 곳에 옮긴 후 노트북에서 삭제합니다.</li>
          <li><strong>2.</strong> Google 등 개인 계정에서 로그아웃하고 저장된 비밀번호를 남기지 않습니다.</li>
          <li><strong>3.</strong> 노트북과 학교가 함께 빌려준 구성품을 담당자에게 직접 전달합니다.</li>
          <li><strong>4.</strong> 담당자가 실물과 상태를 확인할 때까지 기다립니다.</li>
          <li><strong>5.</strong> 대여 기록 또는 알림에서 <strong>반납 완료</strong>가 표시되는지 확인합니다.</li>
        </ol>
        <p className="mt-5 rounded-2xl bg-white p-4 text-sm font-bold leading-7 text-emerald-900">책상이나 보관함에 두는 것만으로는 반납이 완료되지 않습니다. 반드시 담당자에게 직접 전달하세요.</p>
      </section>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-7 sm:p-9">
        <h2 className="flex items-center gap-3 text-xl font-black"><CircleHelp className="h-6 w-6 text-blue-600" />자주 발생하는 문제</h2>
        <dl className="mt-6 space-y-5 text-sm">
          <div><dt className="font-black text-slate-950">신청 버튼이 눌리지 않아요.</dt><dd className="mt-1 leading-7 text-slate-600">개인 설정의 학년·반·번호를 확인하고, 같은 기간에 진행 중인 신청이 있는지 대여 기록에서 확인합니다.</dd></div>
          <div><dt className="font-black text-slate-950">잘못 신청했어요.</dt><dd className="mt-1 leading-7 text-slate-600">승인 대기 상태라면 대여 기록에서 취소합니다. 이미 승인된 경우에는 임의로 장비를 보관하지 말고 담당자에게 변경을 요청합니다.</dd></div>
          <div><dt className="font-black text-slate-950">승인됐는데 장비를 받을 수 없어요.</dt><dd className="mt-1 leading-7 text-slate-600">알림의 배정 번호를 확인하고 담당 교사에게 문의합니다. 다른 번호의 장비를 임의로 사용하지 않습니다.</dd></div>
          <div><dt className="font-black text-slate-950">노트북을 잃어버렸거나 파손했어요.</dt><dd className="mt-1 leading-7 text-slate-600">숨기거나 직접 수리하지 말고 마지막 사용 장소와 시간을 정리해 즉시 담당 교사나 관리자에게 알립니다.</dd></div>
        </dl>
      </section>

      <section className="mt-8 rounded-3xl border border-red-200 bg-red-50 p-7 sm:p-9">
        <h2 className="flex items-center gap-3 text-xl font-black text-red-950"><ShieldCheck className="h-6 w-6" />반드시 지켜야 할 안전 수칙</h2>
        <ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-7 text-red-900">
          <li>친구나 선생님의 계정을 대신 사용하지 않습니다.</li>
          <li>배정되지 않은 노트북을 가져가거나 다른 학생에게 넘기지 않습니다.</li>
          <li>학생 정보와 대여 기록 화면을 공개 게시판이나 단체 채팅방에 공유하지 않습니다.</li>
          <li>학교의 보안 설정을 해제하거나 승인되지 않은 프로그램을 설치하지 않습니다.</li>
          <li>분실, 파손, 의심스러운 로그인이나 개인정보 노출은 즉시 담당자에게 알립니다.</li>
        </ul>
      </section>
    </div>
  );
}
