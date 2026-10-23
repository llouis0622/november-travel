#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
command -v gh >/dev/null || { echo 'GitHub CLI가 필요합니다: brew install gh'; exit 1; }
gh auth status >/dev/null 2>&1 || gh auth login --hostname github.com --web --git-protocol https
owner=$(gh api user --jq .login)
if [ "$owner" != 'llouis0622' ]; then
  echo "llouis0622 계정으로 로그인해 주세요. 현재 계정: $owner"
  exit 1
fi
repo="$owner/november-travel"
python3 build.py
touch dist/.nojekyll
for test in test-engine.js test-gestures.js test-playback.js test-ui-state.js test-workspace-ui.js test-editing.js test-responsive.js; do
  node "$test"
done
python3 test-presentation.py
if [ ! -d .git ]; then git init -b main; fi
git add .gitignore README.md deploy.sh build.py ui.css ui.js engine.js data.json map-fragment.html dist test-*.js test-presentation.py
if ! git diff --cached --quiet; then
  git -c user.name="$owner" -c user.email="$owner@users.noreply.github.com" commit -m 'Improve responsive travel workspace'
fi
if ! git remote get-url origin >/dev/null 2>&1; then
  # Fails safely if that name already exists; never attaches to an unrelated repository.
  gh repo create "$repo" --public --source=. --remote=origin --description '부산 출발 22개 지역 여행 지도 및 일정 편집기'
fi
remote=$(git remote get-url origin)
case "$remote" in
  "https://github.com/$repo"|"https://github.com/$repo.git"|"git@github.com:$repo.git") ;;
  *) echo "예상하지 못한 origin: $remote"; exit 1;;
esac
gh auth setup-git
git push -u origin main
# Publish only the compiled static files, keeping source and tests out of the site.
pages_commit=$(git subtree split --prefix dist main)
git push origin "$pages_commit:refs/heads/gh-pages"
if gh api "repos/$repo/pages" >/dev/null 2>&1; then
  gh api --method PUT "repos/$repo/pages" -f 'source[branch]=gh-pages' -f 'source[path]=/' >/dev/null
else
  gh api --method POST "repos/$repo/pages" -f 'source[branch]=gh-pages' -f 'source[path]=/' >/dev/null
fi
url=$(gh api "repos/$repo/pages" --jq .html_url)
echo "배포 요청 완료: $url"
echo '배포 상태를 확인합니다. 첫 배포는 수 분 걸릴 수 있습니다.'
for attempt in {1..36}; do
  status=$(gh api "repos/$repo/pages/builds/latest" --jq .status 2>/dev/null || true)
  if [ "$status" = built ]; then
    if curl --fail --silent --location "$url" | python3 -c 'import sys; assert "11 Travel" in sys.stdin.read()'; then
      echo "사이트 응답 확인 완료: $url"
      exit 0
    fi
  fi
  if [ "$status" = errored ]; then echo 'GitHub Pages 빌드 실패'; exit 1; fi
  sleep 10
done
echo "배포 진행 중입니다. 상태: https://github.com/$repo/actions"
exit 2
