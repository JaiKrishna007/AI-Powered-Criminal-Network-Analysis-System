FROM node:22-alpine

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application source
COPY . .

# Build TypeScript to dist
RUN npm run build

# Expose backend port
EXPOSE 3000

# Start compiled server
CMD ["npm", "start"]
