# Build stage (glibc)
FROM node:20-bookworm-slim as builder

WORKDIR /app

# Copia package + lock primeiro pra cache funcionar
COPY package*.json ./

# Instala exatamente o lockfile (mais estável)
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
