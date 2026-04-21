# Inkroom

React와 Vite로 만든 소설 집필용 로컬 우선 워크벤치입니다.

## 첫 버전 기능

- 작품 생성과 선택
- 챕터 생성과 본문 작성
- 작품/챕터 삭제와 휴지통 복구
- 챕터 드래그 정렬
- Markdown/TXT 내보내기
- JSON 백업 내보내기/불러오기
- 집중 모드
- 원고 검색
- 챕터별 목표 글자 수
- 캐릭터 관계도
- React Router 기반 `집필`, `설정`, `통계` 화면
- React 상태 기반 편집과 브라우저 `localStorage` 자동 저장
- Tauri 런타임에서는 SQLite `inkroom.db`에도 상태 저장
- 캐릭터 카드, 설정 노트, 플롯 카드
- 오늘 작성 글자 수, 전체 글자 수, 챕터 글자 수

## 실행

의존성을 설치한 뒤 개발 서버를 실행합니다.

```powershell
npm install
npm run dev
```

데스크톱 앱은 Rust toolchain 설치 후 실행할 수 있습니다.

```powershell
npm run desktop:dev
```

## 다음 후보

- Rust toolchain 설치 후 Tauri 빌드 검증
- 원고 검색 하이라이트
- 관계도 노드 드래그
