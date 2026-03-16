FROM oven/bun:alpine

WORKDIR /app
COPY src/ src/
COPY package.json .

EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
