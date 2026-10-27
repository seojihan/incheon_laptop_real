# Supabase 설정 안내

## 1. 연결된 프로젝트

이 저장소는 Supabase의 `seojihan's Projectㄴ` 프로젝트(`qvjjscwswznknlyolqsa`, 서울 리전)에 연결되어 있습니다. 프로젝트 URL과 게시 가능 키(`sb_publishable_...`)는 로컬 `.env`에 설정되어 있습니다. 브라우저에는 게시 가능 키만 사용하며 secret/service role 키를 넣지 마십시오.

## 2. 환경 변수

프로젝트 루트의 `.env.example`을 `.env`로 복사한 후 값을 입력합니다.

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
VITE_ENABLE_DEMO_MODE=false
```

`.env`는 GitHub에 올리지 마십시오. `service_role` 키와 데이터베이스 비밀번호는 프런트엔드 코드에 절대 넣지 마십시오.

## 3. 데이터베이스 마이그레이션

`supabase/migrations`의 마이그레이션은 2026-08-23에 연결된 원격 프로젝트에 적용되었습니다. 이 스크립트는 프로필, 대여 신청, 33대의 노트북 인벤토리, 알림, 승인·취소·반납 함수, 인덱스와 Row Level Security 정책을 함께 생성합니다.

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push --dry-run
npx supabase db push
```

운영 환경에 적용하기 전 학교의 실제 역할 구조와 권한 정책에 맞는지 반드시 검토하십시오.

## 4. Google 로그인

1. Supabase Dashboard에서 Authentication > Providers > Google을 엽니다.
2. Google 로그인을 활성화하고 Google Cloud에서 발급한 OAuth 정보를 입력합니다.
3. Supabase Authentication의 URL Configuration에 아래 주소를 등록합니다.
   - `http://localhost:3100`
   - `http://127.0.0.1:3100`
   - `http://localhost:5500`
   - `http://127.0.0.1:5500`
   - 실제 배포 주소 (예: `https://<프로젝트명>.vercel.app`, Site URL도 이 주소로 변경)
4. Google Cloud OAuth 클라이언트의 Authorized JavaScript origins에 로컬/배포 Origin을, Authorized redirect URIs에는 `https://qvjjscwswznknlyolqsa.supabase.co/auth/v1/callback`을 등록합니다.
5. 학교 계정만 허용할 경우 Google Workspace 및 OAuth 동의 화면의 Audience 설정을 확인합니다.

Google 공급자 활성화에는 프로젝트 소유자의 Google Cloud OAuth Client ID와 Client Secret이 반드시 필요합니다. 이 두 값은 소스 코드나 `.env`에 넣지 말고 Supabase Dashboard의 Google 공급자 설정에만 저장하십시오.

이 전시용 사이트에서는 로그인 화면에서 학생 또는 교사를 선택할 수 있습니다. 교사는 담당 학년·반을 입력해 바로 시작하며, 프로필의 역할과 담당 반은 Supabase에 저장되어 학급별 접근 범위에 사용됩니다. 전시용 정책이므로 실제 운영 서비스에 공개하기 전에는 교사 역할의 자체 선택을 제한하는 별도 승인 정책으로 바꾸어야 합니다. 이 흐름은 교사 권한 신청이나 관리자 승인 요청을 보내지 않습니다.

```sql
update public.profiles
set role = 'admin'
where user_id = '<auth.users의 사용자 UUID>';
```

교사는 `class_num`을 두 자리 형식(예: `03`)으로 지정해야 하며, 도우미는 학생 정보가 모두 필요합니다.

## 5. 운영 전 점검

- 학생이 자신의 정보와 신청 내역만 볼 수 있는지 확인
- 관리자·담당자 권한이 서버 측 정책에서도 제한되는지 확인
- 로그에 학생 개인정보나 인증 정보가 기록되지 않는지 확인
- 탈퇴·졸업·보존기간 만료 시 데이터 삭제 절차 준비
- 백업과 장애 복구 절차 확인
