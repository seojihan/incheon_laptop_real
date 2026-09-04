import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileText,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  UserCog,
  Wrench,
} from 'lucide-react';
import operationsGuideUrl from '../../docs/인천중산고_노트북관리시스템_운영_사용자_매뉴얼_v1.0.docx?url';
import { getInternalHelpArticles } from '../lib/db';
import type { InternalHelpArticle, User } from '../types';

interface InfoViewProps {
  currentUser: User;
  onOpenStudentGuide: () => void;
  onOpenTerms: () => void;
}

const roleLabel = {
  student: '학생',
  helper: '관리 도우미',
  teacher: '담당 교사',
  admin: '시스템 관리자',
} as const;

const roleGuides = {
  student: {
    scope: '본인의 신청·기록·알림만 확인할 수 있습니다.',
    example: '예: 2학년 3반 17번 학생이 9월 둘째 주 월요일 1·2교시를 신청하고, 승인 알림의 배정 번호를 확인한 뒤 장비를 수령합니다.',
    checklist: [
      '개인 설정에서 이름, 학년, 반, 번호를 정확하게 확인합니다.',
      '교과 대여는 연도·월·주차와 필요한 요일·교시를 선택합니다.',
      '가정 대여는 시작일과 종료일을 30일 이내로 선택하고 필요한 사유만 적습니다.',
      '승인 전 대기 신청은 기록 화면에서 취소할 수 있습니다.',
      '승인 후에는 알림의 노트북 번호와 실물 자산 번호를 확인합니다.',
      '반납 전에 개인 파일을 삭제하고 모든 개인 계정에서 로그아웃합니다.',
      '실물을 담당자에게 전달하고 반납 완료 알림까지 확인합니다.',
    ],
  },
  helper: {
    scope: '학생 기능을 사용하면서 본인 담당 반의 신청 검토·반납·재고 조회를 지원합니다.',
    example: '예: 3반 관리 도우미는 자신의 대여를 신청할 수 있고 3반 학생 신청만 처리합니다. 4반 기록은 조회하거나 처리할 수 없습니다.',
    checklist: [
      '학생 이름·학번·반과 신청 기간 또는 교시를 먼저 대조합니다.',
      '중복 신청, 진행 중 대여, 미반납 장비 여부를 확인합니다.',
      '승인 후 자동 배정 번호와 실물 자산 태그를 확인하고 인계합니다.',
      '반려 사유는 수정 가능한 내용으로 구체적으로 적고 민감정보는 적지 않습니다.',
      '실물 회수와 상태 확인이 끝난 뒤에만 반납 완료를 선택합니다.',
      '처리 범위가 본인 담당 반을 벗어나면 교사 또는 관리자에게 인계합니다.',
      '학기 또는 담당 업무가 끝나면 helper 권한 회수를 관리자에게 요청합니다.',
    ],
  },
  teacher: {
    scope: '본인 담당 반의 신청, 기록과 장비 배정을 검토하고 학생 지원을 책임집니다.',
    example: '예: 담당 반이 03인 교사는 3반 신청만 승인·반려합니다. 가용 장비가 없거나 기록과 실물이 다르면 승인을 멈추고 관리자에게 확인합니다.',
    checklist: [
      '매일 승인 대기 건과 기한이 지난 대여를 확인합니다.',
      '교육 목적, 수업 일정, 가정 대여 기간과 학교 규정 적합성을 확인합니다.',
      '장비 인계 전 기존 손상과 구성품 누락을 학생과 함께 확인합니다.',
      '분실·파손·계정 사고는 기록을 삭제하지 말고 학교의 공식 보고 절차로 인계합니다.',
      '학생 개인정보와 대여 화면을 공개 게시판이나 개인 메신저에 공유하지 않습니다.',
      '관리 도우미에게 필요한 최소 업무만 맡기고 무단 권한 공유를 금지합니다.',
      '주간 단위로 미처리·미반납·점검 중 장비를 관리자와 대조합니다.',
    ],
  },
  admin: {
    scope: '전체 반의 기록·승인·장비 현황과 사용자 역할을 관리하고 보안·인수인계를 책임집니다.',
    example: '예: 새 학기 전 명단을 확인하고 교사는 담당 반과 함께 teacher, 학생 도우미는 기간을 정해 helper로 부여합니다. 시험 계정으로 각 역할의 조회 범위를 검증합니다.',
    checklist: [
      '역할 변경 전 사용자 본인, 담당 업무, 담당 반, 승인자와 종료일을 확인합니다.',
      'student → helper/teacher/admin 순서를 서열이 아닌 서로 다른 업무 범위로 이해합니다.',
      '관리자 전용 역할 변경 함수 또는 승인된 관리 절차만 사용합니다.',
      '역할 변경 뒤 대상자가 다시 로그인하도록 안내하고 허용·금지 화면을 모두 검증합니다.',
      '매일 승인 대기·미반납·장비 상태를, 매주 역할과 담당 반을 대조합니다.',
      '학기 종료 시 helper·teacher·admin 권한을 업무 필요성에 따라 회수합니다.',
      '공개 저장소와 브라우저 코드에 학생 데이터, 비밀번호, secret/service role 키를 두지 않습니다.',
      '장애·개인정보 사고·권한 오부여 기록과 조치 결과를 학교 승인 보관소에 남깁니다.',
    ],
  },
} as const;

export default function InfoView({ currentUser, onOpenStudentGuide, onOpenTerms }: InfoViewProps) {
  const [internalArticles, setInternalArticles] = useState<InternalHelpArticle[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const isStaff = currentUser.role !== 'student';
  const guide = roleGuides[currentUser.role];

  const loadInternalArticles = async () => {
    if (!isStaff) return;
    setInternalLoading(true);
    setInternalError(null);
    try {
      setInternalArticles(await getInternalHelpArticles());
    } catch (error) {
      setInternalError(error instanceof Error ? error.message : '내부 안내를 불러오지 못했습니다.');
    } finally {
      setInternalLoading(false);
    }
  };

  useEffect(() => { void loadInternalArticles(); }, [currentUser.id, currentUser.role]);

  const studentFlow = useMemo(() => [
    ['1. 계정·정보 확인', '학교에서 허용한 Google 계정으로 로그인하고 이름·학년·반·번호를 확인합니다.'],
    ['2. 신청', '교과 대여는 주차와 교시를, 가정 대여는 30일 이내의 기간을 선택해 제출합니다.'],
    ['3. 결과 확인', '대여 기록과 알림에서 승인·반려 여부와 배정된 노트북 번호를 확인합니다.'],
    ['4. 수령·사용', '배정 번호와 실물 자산 태그를 대조하고 승인된 목적과 기간에만 사용합니다.'],
    ['5. 반납', '개인 파일과 계정을 정리한 뒤 실물을 전달하고 담당자의 반납 완료 처리를 확인합니다.'],
  ], []);

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <header className="mb-10">
        <span className="inline-flex px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-black mb-4">이용 안내 · {roleLabel[currentUser.role]}</span>
        <h1 className="text-4xl font-black text-slate-900">신청부터 반납, 운영까지</h1>
        <p className="text-slate-500 mt-3 leading-7">현재 로그인한 역할에 필요한 기능과 처리 기준을 안내합니다.</p>
      </header>

      <section className="rounded-3xl bg-slate-950 p-7 text-white sm:p-9">
        <div className="flex items-start gap-4">
          <ShieldCheck className="mt-1 h-7 w-7 shrink-0 text-cyan-300" />
          <div>
            <h2 className="text-xl font-black">내 역할: {roleLabel[currentUser.role]}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">{guide.scope}</p>
            <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-7 text-slate-200">{guide.example}</p>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-black text-slate-950">학생 기본 이용 흐름</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {studentFlow.map(([title, body]) => (
            <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-black text-slate-900">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-7 sm:p-9">
        <h2 className="flex items-center gap-3 text-xl font-black"><ClipboardCheck className="h-6 w-6 text-blue-600" />{roleLabel[currentUser.role]} 체크리스트</h2>
        <ol className="mt-6 grid gap-3 text-sm leading-7 text-slate-700 md:grid-cols-2">
          {guide.checklist.map((item, index) => (
            <li key={item} className="flex gap-3 rounded-2xl bg-slate-50 p-4">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black text-[11px] font-black text-white">{index + 1}</span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-7 sm:p-9">
        <h2 className="flex items-center gap-3 text-xl font-black"><BookOpenCheck className="h-6 w-6 text-blue-600" />상세 문서</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">저장소에 함께 관리되는 최신 문서입니다. DOCX 문서에는 실제 비밀번호·키·학생 데이터가 포함되지 않습니다.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={onOpenStudentGuide} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black hover:bg-slate-50">
            <FileText className="h-4 w-4" /> 학생용 빠른 설명서
          </button>
          <a href={operationsGuideUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-black text-white hover:bg-zinc-800">
            <BookOpenCheck className="h-4 w-4" /> 전체 운영·사용자 매뉴얼(DOCX) <ExternalLink className="h-3 w-3" />
          </a>
          <button type="button" onClick={onOpenTerms} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black hover:bg-slate-50">
            <ShieldCheck className="h-4 w-4" /> 이용약관 전문
          </button>
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-7 sm:p-9">
        <h2 className="flex items-center gap-3 text-xl font-black text-amber-950"><AlertTriangle className="h-6 w-6" />문제가 생겼을 때</h2>
        <dl className="mt-5 grid gap-5 text-sm md:grid-cols-3">
          <div><dt className="font-black text-amber-950">신청 버튼이 비활성</dt><dd className="mt-1 leading-6 text-amber-900">개인 설정의 학년·반·번호와 기존 진행 중 신청을 확인합니다.</dd></div>
          <div><dt className="font-black text-amber-950">승인됐지만 장비가 없음</dt><dd className="mt-1 leading-6 text-amber-900">배정 번호를 확인하고 다른 장비를 임의로 사용하지 말고 담당자에게 알립니다.</dd></div>
          <div><dt className="font-black text-amber-950">분실·파손·계정 노출</dt><dd className="mt-1 leading-6 text-amber-900">사용을 중단하고 공개 캡처 없이 즉시 담당 교사나 관리자에게 보고합니다.</dd></div>
        </dl>
      </section>

      {isStaff && (
        <section className="mt-10 rounded-[2rem] border-2 border-indigo-200 bg-indigo-50/50 p-6 sm:p-9" aria-labelledby="internal-guide-title">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-indigo-950 px-3 py-1 text-xs font-black text-white"><LockKeyhole className="h-3.5 w-3.5" />권한 사용자 전용</span>
              <h2 id="internal-guide-title" className="mt-4 text-2xl font-black text-indigo-950">학교 내부 운영 안내</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-indigo-900">이 영역은 화면 숨김만이 아니라 Supabase RLS가 현재 계정의 역할을 확인한 후 허용된 글만 전송합니다.</p>
            </div>
            <button type="button" onClick={() => void loadInternalArticles()} disabled={internalLoading} className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm font-black text-indigo-950 hover:bg-indigo-50 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${internalLoading ? 'animate-spin' : ''}`} /> 새로고침
            </button>
          </div>

          <div className="mt-6 grid gap-4">
            {internalLoading && <div role="status" className="rounded-2xl bg-white p-6 text-sm font-bold text-slate-500">권한을 확인하고 내부 안내를 불러오는 중입니다...</div>}
            {internalError && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">{internalError}</div>}
            {!internalLoading && !internalError && internalArticles.length === 0 && (
              <div className="rounded-2xl border border-indigo-100 bg-white p-6 text-sm leading-7 text-slate-600">현재 역할에 게시된 내부 안내가 없습니다. 관리자는 RLS 보호 테이블에 학교 고유 연락처와 절차를 등록할 수 있습니다.</div>
            )}
            {internalArticles.map((article) => (
              <details key={article.id} className="group rounded-2xl border border-indigo-100 bg-white p-5 open:shadow-sm">
                <summary className="cursor-pointer list-none pr-4">
                  <div className="flex items-start gap-3">
                    {article.slug.includes('role') ? <UserCog className="mt-1 h-5 w-5 shrink-0 text-indigo-700" /> : article.slug.includes('incident') ? <Wrench className="mt-1 h-5 w-5 shrink-0 text-indigo-700" /> : <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-indigo-700" />}
                    <div><h3 className="font-black text-slate-950">{article.title}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{article.summary}</p></div>
                  </div>
                </summary>
                <div className="mt-5 space-y-3 border-t border-slate-100 pt-5 text-sm leading-7 text-slate-700">
                  {article.body.split('\n').filter(Boolean).map((line) => <p key={line}>{line}</p>)}
                </div>
              </details>
            ))}
          </div>

          <div className="mt-6 rounded-2xl bg-indigo-950 p-5 text-sm leading-7 text-indigo-100">
            <p className="flex items-center gap-2 font-black text-white"><KeyRound className="h-4 w-4" />비밀정보 보관 금지</p>
            <p className="mt-2">이 내부 안내 영역에도 비밀번호, API 키, 인증 토큰은 저장하지 않습니다. 공개 GitHub 저장소에는 학교 내부 연락망, 실제 학생정보와 운영 로그를 넣지 않습니다.</p>
          </div>
        </section>
      )}
    </div>
  );
}
