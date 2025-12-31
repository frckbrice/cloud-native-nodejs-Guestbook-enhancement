# Use base node 19-alpine image from Docker hub
FROM node:19-alpine

WORKDIR /frontend

# Copy package.json and install dependencies
COPY src/frontend/package*.json ./
RUN npm install

# Copy frontend application source code
COPY src/frontend/ ./

# Copy shared utilities to /shared (sibling to /frontend)
COPY src/shared/ /shared/

# Run app.js
ENTRYPOINT ["node", "app.js"]
