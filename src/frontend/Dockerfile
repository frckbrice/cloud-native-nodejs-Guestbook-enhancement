# Use base node 19-alpine image from Docker hub
FROM node:19-alpine

WORKDIR /frontend

# Copy package.json and install dependencies
# Build context should be project root (.)
COPY src/frontend/package*.json ./
RUN npm install

# Copy frontend application source code
COPY src/frontend/ ./

# Copy shared utilities to /shared (sibling to /frontend)
COPY src/shared/ /shared/

# Set NODE_PATH so shared utilities can find modules installed in /frontend/node_modules
ENV NODE_PATH=/frontend/node_modules

# Run app.js
ENTRYPOINT ["node", "app.js"]
