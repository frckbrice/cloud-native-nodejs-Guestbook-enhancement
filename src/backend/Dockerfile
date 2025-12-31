# Use base node 19.9.0-alpine image from Docker hub
FROM node:19.9.0-alpine

WORKDIR /backend

# Install build dependencies for native modules (bcrypt)
RUN apk add --no-cache python3 make g++

# Copy package.json and install dependencies
COPY src/backend/package*.json ./
RUN npm install

# Copy backend application source code
COPY src/backend/ ./

# Copy shared utilities to /shared (sibling to /backend)
COPY src/shared/ /shared/

# Run app.js
ENTRYPOINT ["node", "app.js"]
