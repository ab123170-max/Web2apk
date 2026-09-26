FROM ghcr.io/cirruslabs/android-sdk:34
RUN apt-get update && apt-get install -y --no-install-recommends nodejs npm && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.js ./
ENV PORT=8080
EXPOSE 8080
CMD ["npm","start"]
