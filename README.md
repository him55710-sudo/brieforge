# BriefForge · 브리프포지

**막연한 아이디어를, 코딩 에이전트가 실행할 수 있는 브리프로.**

한국어 아이디어 입력 → 7문항 인터뷰 → 마스터 프롬프트 → 복사 / Markdown 다운로드. Wanted AI Championship 2026용 MVP입니다. 인증·결제·DB 없이 동작합니다.

## 로컬 실행

Node.js **20.9 이상**(권장: Node 22 LTS)과 npm이 필요합니다.

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000)을 여세요. API 키는 필요하지 않습니다. 패키지 설치 후에는 외부 네트워크가 없어도 로컬 서버에서 전체 설문과 생성이 동작합니다. 서비스 워커 기반의 설치형 PWA는 아닙니다.

프로덕션 실행:

```bash
npm run build
npm start
```

## 선택 사항: OpenAI 연결

`.env.example`을 `.env.local`로 복사하고 서버 환경 변수를 설정한 뒤 개발 서버를 재시작하세요.

```dotenv
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4.1-mini
```

- 키가 있으면 아이디어에 맞춰 10개 질문을 조정하고, 생성된 브리프에 데이터 모델·구현 단계·맞춤 검증 시나리오를 추가합니다.
- [공식 OpenAI Responses API 문서](https://developers.openai.com/api/reference/typescript/resources/beta/subresources/responses/methods/create)를 참고한 서버 측 REST 호출입니다. 모델은 `OPENAI_MODEL`로 변경할 수 있습니다.
- 사용자 답변과 스카우트 필수 계약은 결정적 템플릿에 보존합니다. AI 제안이 충돌하면 기존 요구사항이 우선합니다.
- 키 부재, 권한/한도 오류, 25초 타임아웃, 잘못된 응답은 기본 질문·템플릿으로 자동 전환됩니다. 화면에서 실제 생성 모드를 확인할 수 있습니다.
- **항상 로컬에서 생성하기**를 선택하면 API 키가 있어도 아이디어·답변을 전송하지 않습니다.
- OpenAI 호출은 비용이 발생할 수 있습니다. 공개 데모는 키 없이 배포해도 모든 기능을 시연할 수 있습니다. 이 MVP에는 계정별 사용량 제한이 없습니다.

## 데모 (약 3분)

1. **공모전 스카우트 프롬프트 만들기**를 누릅니다.
2. 미리 채워진 10개 답변과 준비물 상태를 확인하고 필요하면 수정합니다.
3. **마스터 브리프 생성**을 누릅니다.
4. 국내 오프라인/하이브리드 우선, AI·창업 우선, 생성형 광고·영상 제작 공모전 제외, 적합도 A/B 판단, 공식 출처 검증을 확인합니다.
5. `scout-results.json`용 JSON Schema와 인수 테스트가 포함된 문서를 복사하거나 `.md`로 다운로드합니다.
6. Cursor/Codex에 붙여넣어 구현을 지시합니다. BriefForge 자체가 실제 공고를 검색하거나 JSON 검색 결과를 생성하는 것은 아닙니다.

A는 주제·접수·참가 자격·일정이 확인된 후보, B는 제외 조건에는 해당하지 않으나 추가 확인이 남은 후보입니다. 기본 기준을 브리프에 명시하며 참가 프로필은 추측하지 않습니다.

## Vercel 배포

1. 이 폴더를 GitHub 저장소에 푸시합니다.
2. Vercel에서 **Add New → Project → 저장소 가져오기**를 선택합니다.
3. Framework Preset은 **Next.js**, Root Directory는 이 프로젝트 루트로 설정합니다.
4. Build Command `npm run build`, Install Command `npm install`, Node.js 22.x를 사용합니다.
5. 환경 변수 없이 배포하면 로컬 생성 모드입니다. AI를 사용하려면 `OPENAI_API_KEY`와 선택적인 `OPENAI_MODEL`을 추가하고 다시 배포합니다.
6. 배포 URL과 `/api/health`를 확인합니다. 이 저장소에는 배포 완료를 가정한 URL을 넣지 않았습니다.

## 구조

```text
app/
  page.tsx, layout.tsx, globals.css, icon.svg
  api/health/route.ts        # 설정 모드 확인 (외부 API 연결 테스트 아님)
  api/questions/route.ts     # 검증된 7문항 + 선택적 AI 조정
  api/generate/route.ts      # 템플릿 + 선택적 AI 구현 설계
components/brief-forge.tsx   # 랜딩/설문/결과, 복사/저장/복원 UI
lib/brief.ts                # 질문 뱅크, 프리셋, 합성기, Zod 스키마
lib/ai.ts                   # 서버 측 OpenAI 요청, 타임아웃, 본문 제한
tests/                     # 로직/API 테스트 및 실제 브라우저 테스트
CONTEST.md                 # 한국어 제출 답변
```

## API

- `GET /api/health`: `{ "status": "ok", "app": "BriefForge", "version": "1.0.0", "mode": "offline" }`. 키 설정 시 `mode`는 `ai`; 연결 성공을 보장하는 지표는 아닙니다.
- `POST /api/questions`: `{ idea, preset?, localOnly? }` → `{ questions, mode, fallback? }`.
- `POST /api/generate`: 위 입력 + `answers: { audience, goal, features, constraints, style, mood, layout, references, stack, success }` 및 `setup: { codex, claude, github, supabase, huggingface, vercel, openai }` (각 값: 준비됨 / 아직 / 이번엔 불필요) → `{ markdown, mode, fallback? }`.
- 아이디어 3~2,000자, 답변 각 1~2,000자, 요청 본문 최대 80KB. 잘못된 입력은 400. 응답은 `Cache-Control: no-store`.

## 개인정보와 저장

최근 완성한 브리프·아이디어·10개 답변과 준비물 상태 1개만 현재 브라우저의 `localStorage`에 저장합니다. 새 생성 시 덮어쓰며 최근 작업의 삭제 버튼으로 지울 수 있습니다. 저장소 접근이 차단되면 다운로드를 안내합니다. 일반 생성 과정에서는 질문 답변 초안을 저장하지 않으므로 새로고침 시 미완성 답변은 사라집니다.

앱에 인증·DB·사용자 입력 로그는 없습니다. 로컬 모드는 아이디어·답변을 전송하지 않습니다(상태 확인용 `/api/health` 요청은 수행). AI 모드는 서버를 통해 OpenAI에 전송하고 `store: false`를 사용합니다. 이는 OpenAI의 모든 별도 보관 정책을 면제한다는 의미는 아닙니다. 호스팅 서비스의 접속 메타데이터 기록이 적용될 수 있습니다.

## 검증

```bash
npm test                 # 결정적 생성, 필터/JSON 계약, 입력 검증, AI 성공/장애 모의 테스트
npm run build            # 프로덕션 빌드 + TypeScript 검사
npx playwright install chromium
npm run test:e2e         # 빌드된 서버를 3100 포트에서 자동 시작
```

브라우저 테스트: 프리셋 전체 흐름, 복사, 다운로드, 저장·복원·삭제, 모바일 사용자 지정 설문, 백엔드 연결 불가 상태, 손상된 저장값, 개인정보 대화상자. OpenAI 성공 경로는 모의 응답으로 검증하며 실제 유료 API 호출은 필수 테스트에 포함하지 않습니다.

배포 전 API 키가 필요 없는 데모로 충분한지 선택하세요. 실제 스카우트 서비스의 수집·주기 실행 기능은 생성된 브리프를 전달받은 코딩 에이전트가 구현할 대상입니다.
