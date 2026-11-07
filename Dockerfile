FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg python3 python3-venv ca-certificates && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/media && /opt/media/bin/pip install --no-cache-dir 'yt-dlp[default]' 'bgutil-ytdlp-pot-provider==2.0.2'
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.mjs ./
COPY lib ./lib
COPY public ./public
RUN mkdir -p /app/data && chown -R node:node /app/data
ENV PATH="/opt/media/bin:${PATH}"
ENV HOST=0.0.0.0 PORT=3000 FLUX_DATA_DIR=/app/data YTDLP_PATH=/opt/media/bin/yt-dlp FFMPEG_PATH=/usr/bin/ffmpeg
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["node", "-e", "const headers = {}; if (process.env.FLUX_ACCESS_PASSWORD) headers.authorization = 'Basic ' + Buffer.from((process.env.FLUX_ACCESS_USERNAME || 'flux') + ':' + process.env.FLUX_ACCESS_PASSWORD).toString('base64'); fetch('http://127.0.0.1:3000/api/health', { headers }).then((response) => response.json().then((body) => process.exit(response.ok && body.ready ? 0 : 1))).catch(() => process.exit(1))"]
VOLUME ["/app/data"]
CMD ["node", "server.mjs"]
