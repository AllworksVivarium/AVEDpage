FROM node:24-alpine
ENV NODE_ENV=production PORT=4173 HOST=0.0.0.0 DATA_DIR=/app/data
WORKDIR /app
COPY --chown=node:node *.mjs ./
COPY --chown=node:node public ./public
COPY --chown=node:node tools ./tools
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 4173
CMD ["node", "server.mjs"]

