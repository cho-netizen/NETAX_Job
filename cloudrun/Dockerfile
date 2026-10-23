# [2026.10.23 T6 2단계] 읽기 전용 시험 서비스 — 빌드 문맥은 저장소 루트(gs-backend 원본에서 조립하기 위해).
#   docker build -f cloudrun/Dockerfile -t netax-case-reader .   /   gcloud builds submit --config cloudrun/cloudbuild.yaml .
# 조립 모듈 dist/reader.js는 git에 없고(.gitignore) 여기서 매번 원본으로 만든다 — 두 벌 금지.
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY cloudrun/package.json ./cloudrun/
RUN cd cloudrun && npm install --omit=dev --no-audit --no-fund
COPY gs-backend ./gs-backend
COPY tools/build-reader.js ./tools/build-reader.js
COPY cloudrun ./cloudrun
# .git이 없어 조립기가 SHA를 못 읽는다 — 빌드 인자로 넘기면 머리글·codeVersion에 쓴다
ARG CODE_VERSION=unknown
ENV CODE_VERSION=${CODE_VERSION}
RUN node tools/build-reader.js && node --check dist/reader.js && rm -rf gs-backend
USER node
EXPOSE 8080
CMD ["node", "cloudrun/server.js"]
