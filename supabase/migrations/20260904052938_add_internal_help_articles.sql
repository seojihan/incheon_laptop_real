create table public.internal_help_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(btrim(title)) between 2 and 120),
  summary text not null check (char_length(btrim(summary)) between 2 and 300),
  body text not null check (char_length(btrim(body)) between 2 and 20000),
  allowed_roles text[] not null,
  sort_order smallint not null default 100 check (sort_order between 0 and 32767),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint internal_help_articles_allowed_roles_check check (
    cardinality(allowed_roles) between 1 and 3
    and allowed_roles <@ array['teacher', 'helper', 'admin']::text[]
  )
);

create index internal_help_articles_published_order_idx
on public.internal_help_articles (published, sort_order, title);

create trigger internal_help_articles_set_updated_at
before update on public.internal_help_articles
for each row execute function private.set_updated_at();

alter table public.internal_help_articles enable row level security;

create policy internal_help_articles_select_by_role
on public.internal_help_articles for select to authenticated
using (
  published
  and (select private.current_role()) = any(allowed_roles)
);

create policy internal_help_articles_admin_manage
on public.internal_help_articles for all to authenticated
using ((select private.current_role()) = 'admin')
with check ((select private.current_role()) = 'admin');

revoke all privileges on public.internal_help_articles from anon;
grant select, insert, update, delete on public.internal_help_articles to authenticated;

comment on table public.internal_help_articles is
  'RLS-protected school-specific operating guidance. Never store passwords, API keys, or authentication tokens here.';

insert into public.internal_help_articles
  (slug, title, summary, body, allowed_roles, sort_order, published)
values
  (
    'staff-approval-and-return-sop',
    '승인·인계·반납 표준 절차',
    '교사·관리 도우미·관리자가 동일한 기준으로 장비를 처리하기 위한 내부 절차입니다.',
    E'1. 승인 전 학생 이름·학번·반, 신청 종류, 기간 또는 교시를 대조합니다.\n2. 진행 중인 대여와 미반납 기록, 사용 가능한 장비 수를 확인합니다.\n3. 승인 후 화면에 배정된 번호와 실물 자산 태그를 함께 확인한 뒤 학생에게 인계합니다.\n4. 파손이나 구성품 누락은 인계 전에 기록하고 학생과 담당자가 함께 확인합니다.\n5. 반납 시 전원, 외관, 충전기 등 학교가 정한 항목을 확인합니다.\n6. 실물을 회수한 뒤에만 반납 완료를 처리합니다. 기록을 먼저 완료하면 같은 장비가 다른 신청에 배정될 수 있습니다.\n7. 반려할 때는 학생이 수정할 수 있는 구체적인 사유를 작성하고 불필요한 민감정보는 적지 않습니다.\n8. 시스템 기록과 실물이 다르면 추가 처리를 멈추고 관리자에게 인계합니다.',
    array['teacher', 'helper', 'admin'],
    10,
    true
  ),
  (
    'staff-incident-response',
    '분실·파손·계정 사고 대응',
    '학생 지원과 증거 보존을 함께 고려한 담당자용 초기 대응 순서입니다.',
    E'1. 학생의 안전을 먼저 확인하고 장비 사용과 추가 로그인을 중단시킵니다.\n2. 배정 번호, 마지막 확인 시각과 장소, 발견 경위를 사실 중심으로 기록합니다.\n3. 대여 기록을 삭제하거나 임의로 반납 완료 처리하지 않습니다.\n4. 계정 노출이 의심되면 학생에게 로그아웃과 학교 계정 보안 절차를 안내합니다. 비밀번호나 인증 코드를 담당자가 대신 받지 않습니다.\n5. 개인정보 노출 가능성이 있으면 공개 채널에 화면 캡처를 올리지 말고 학교가 정한 보호 담당자에게 보고합니다.\n6. 장비 격리·수리·경찰 신고·보호자 연락 여부는 학교의 공식 사고 대응 기준에 따라 관리자가 결정합니다.\n7. 복구 후 신청, 승인, 장비 상태와 반납 기록을 대조하여 누락을 정리합니다.',
    array['teacher', 'helper', 'admin'],
    20,
    true
  ),
  (
    'admin-role-governance',
    '관리자 권한 부여·회수 기준',
    '강한 권한을 최소 인원과 기간에만 부여하기 위한 관리자 전용 기준입니다.',
    E'1. 역할을 변경하기 전에 대상자의 본인 확인, 담당 업무, 담당 반과 권한 종료일을 확인합니다.\n2. 학생은 student, 학생이면서 담당 반 신청을 돕는 경우에만 helper, 담당 반 승인자는 teacher, 전체 시스템 책임자만 admin으로 지정합니다.\n3. 역할 변경 전후의 사용자 ID, 승인자, 이유와 시각을 학교의 승인된 관리 기록에 남깁니다.\n4. helper와 teacher는 담당 반을 반드시 확인하고 다른 반 기록이 조회되지 않는지 시험 계정으로 검증합니다.\n5. 학기 종료, 졸업, 전보 또는 업무 변경 시 즉시 최소 권한으로 회수합니다.\n6. 공용 계정에는 관리자 권한을 부여하지 않으며 관리자 계정을 공유하지 않습니다.\n7. 권한 오부여가 의심되면 먼저 역할을 회수하고 세션 갱신 또는 재로그인을 안내한 뒤 접근 기록과 영향 범위를 확인합니다.',
    array['admin'],
    30,
    true
  ),
  (
    'admin-data-and-release-checklist',
    '관리자 데이터·배포 점검표',
    '배포 전후에 공개 정보와 내부 정보를 분리하고 권한을 검증하는 관리자 전용 점검표입니다.',
    E'1. 공개 저장소에 환경 변수, 비밀번호, secret/service role 키, 실제 학생 데이터와 내부 연락망이 없는지 검사합니다.\n2. 브라우저 코드에는 publishable 키만 사용하고 모든 공개 스키마 테이블에 RLS와 필요한 GRANT가 함께 설정되었는지 확인합니다.\n3. 학생·도우미·교사·관리자 시험 계정으로 조회 범위와 금지 동작을 각각 검증합니다. 화면에서 숨겨진 것만으로 권한 보호가 완료됐다고 판단하지 않습니다.\n4. 마이그레이션과 프런트엔드 유형 정의가 동일한지 확인하고 빌드·테스트를 통과시킵니다.\n5. 배포 주소와 OAuth 허용 주소가 일치하는지 확인합니다.\n6. 장애 시 사용할 오프라인 대체 절차, 백업 상태, 담당자 인수인계와 개인정보 사고 보고 경로를 확인합니다.\n7. 실제 학교 고유 정보는 이 RLS 보호 영역에만 입력하되, 비밀번호·API 키·인증 토큰은 이 영역에도 저장하지 않습니다.',
    array['admin'],
    40,
    true
  );
