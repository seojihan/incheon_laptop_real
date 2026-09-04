# Incheon School Laptop Management System

학교 노트북 대여 신청, 승인 및 기록 관리를 위한 React 기반 웹 애플리케이션입니다.

This React web application helps schools manage laptop rental requests, approvals, and rental records.

## Documentation / 문서

- [한국어 사용 설명서](docs/USER_GUIDE_KO.md)
- [운영·사용자 통합 매뉴얼(DOCX)](docs/인천중산고_노트북관리시스템_운영_사용자_매뉴얼_v1.0.docx)
- [English User Guide](docs/USER_GUIDE_EN.md)
- [한국어 이용약관](docs/TERMS_KO.md)
- [Terms of Use](docs/TERMS_EN.md)
- [Supabase 설정 안내](SUPABASE_SETUP.md)

## Main features / 주요 기능

- Google 계정을 이용한 로그인
- 사용자 프로필 및 역할 관리
- 교내·가정용 노트북 대여 신청
- 신청 내역 확인
- 관리자 또는 담당자의 신청 승인·반려
- 로그인 전 확인할 수 있는 상세 이용약관
- 역할별 이용 안내와 Supabase RLS로 보호되는 교직원·관리자 내부 안내

## Requirements / 실행 환경

- Node.js 22.12 or later
- npm
- A Supabase project

## Local setup / 로컬 실행

1. Install dependencies.

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env`.

3. Enter your Supabase client settings in `.env`.

   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
   ```

4. Start the development server.

   ```bash
   npm run dev
   ```

5. Open `http://localhost:3100`.

## Available commands / 명령어

```bash
npm run dev
npm run build
npm run preview
npm run live
npm run lint
npm run test
npm run check
```

## VS Code Live Server / VS Code 라이브 서버

1. VS Code에서 권장 확장인 **Live Server**를 설치합니다.
2. `npm run live:build`를 실행해 `dist` 폴더를 계속 갱신합니다.
3. VS Code 상태 표시줄의 **Go Live**를 누릅니다.

`.vscode/settings.json`이 Live Server 루트를 `dist`, 포트를 `5500`으로 지정합니다. Google OAuth의 허용 Redirect URL에는 `http://localhost:5500`과 `http://127.0.0.1:5500`도 등록해야 합니다. 확장 없이 동일한 결과를 확인하려면 `npm run live`를 사용합니다.

Supabase 없이 UI만 확인하려면 `.env`에서 `VITE_ENABLE_DEMO_MODE=true`로 설정할 수 있습니다. 운영 환경에서는 반드시 `false`로 두십시오.

## Security / 보안

- Do not commit `.env` files.
- Never place a Supabase `service_role` key or database password in frontend code.
- The Supabase anon key is only safe when Row Level Security policies are correctly configured.
- Do not store real student information in sample files or public issues.
- The public repository and bundled DOCX contain no passwords, API keys, student records, or school-only contact lists.
- School-specific internal guidance is stored in `internal_help_articles` and returned only when its RLS policy allows the signed-in role.

`.env`, `node_modules`, build output, logs, and temporary files are excluded through `.gitignore`.

## Deployment responsibility / 배포 책임

Before using this application in a real school, the operator must review access control, Supabase Row Level Security policies, privacy notices, data retention rules, and applicable school or education-office policies.

실제 학교에서 사용하기 전 운영자는 접근 권한, Supabase RLS 정책, 개인정보 처리 안내, 보존 기간 및 학교·교육청 규정을 반드시 검토해야 합니다.
