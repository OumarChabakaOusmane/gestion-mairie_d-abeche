FROM node:18-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --only=production || npm ci

# Copy app source
COPY . .

# Expose port
EXPOSE 3000

# Environment
ENV NODE_ENV=production

# Start
CMD ["node", "app.js"]


