# November Travel

부산 출발 22개 지역, 46개 추천 코스를 탐색하고 일정을 편집하는 다크·차콜 테마 여행 플래너입니다.

지도 재생, 장소 추가·삭제, 방문 순서와 날짜 변경, 체류시간 조절, 되돌리기·다시 실행, 일정 내보내기·가져오기를 지원합니다.

## GitHub에 게시

Node.js, Python 3, Git, GitHub CLI가 설치된 Mac 터미널에서 실행합니다.

```bash
bash deploy.sh
```

필요하면 GitHub 로그인을 안내합니다. `llouis0622/november-travel` 공개 저장소를 새로 만들고 GitHub Pages를 설정합니다. 같은 이름의 기존 저장소가 있으면 자동 덮어쓰지 않고 중단합니다. 게시 완료 뒤 실제 주소를 출력합니다.

## 개발

`ui.css`는 디자인, `ui.js`는 화면·편집·재생, `engine.js`는 일정 계산, `data.json`은 여행 데이터, `map-fragment.html`은 지도입니다.

```bash
python3 build.py
python3 -m http.server 8080 --directory dist
```

빌드 산출물은 `dist/index.html`입니다. 외부 API 키나 별도 서버 없이 실행됩니다. 여행지의 운영시간·요금·배차는 실시간 조회가 아닙니다.

일정은 브라우저의 로컬 저장소에 저장되며 기기 간 자동 동기화되지 않습니다. 기존 파일에서 수정한 일정은 ‘저장·가져오기’로 내보낸 뒤 새 사이트에서 가져오세요.

## 검증 범위

`deploy.sh`는 게시 전에 계산·편집·재생·상태·정적 마크업 검사를 실행합니다. 이 검사는 실제 브라우저의 화면 배치와 터치 검증을 대체하지 않습니다.
