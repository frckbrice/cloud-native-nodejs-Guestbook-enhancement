# Use base node 19.9.0-alpine image from Docker hub
FROM node:19.9.0-alpine

WORKDIR /backend

# Install build dependencies for native modules (bcrypt)
RUN apk add --no-cache python3 make g++

# Copy package.json and install dependencies first
COPY src/backend/package*.json ./
RUN npm install

# Copy backend application source code
# .dockerignore will exclude node_modules, so this won't overwrite the installed modules
COPY src/backend/app.js ./
COPY src/backend/routes ./routes
COPY src/backend/scripts ./scripts

# Copy shared utilities to /shared (sibling to /backend)
COPY src/shared /shared

# Set NODE_PATH so shared utilities can find modules installed in /backend/node_modules
ENV NODE_PATH=/backend/node_modules

# Run app.js
ENTRYPOINT ["node", "app.js"]
