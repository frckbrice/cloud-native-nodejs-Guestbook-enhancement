################################################################################
# Multi-stage Dockerfile for Development
#
# Motivation:
# Provides a unified Dockerfile for local development and testing.
# Supports building both frontend and backend services.
#
# Usage:
# - For production, use individual Dockerfiles in src/backend and src/frontend
# - This file is primarily for CI/CD and development workflows
################################################################################
FROM node:18-alpine AS base
WORKDIR /app

FROM base AS dependencies
COPY package*.json ./
RUN npm ci --only=production

FROM base AS development
COPY . .
RUN npm install

FROM development AS default
CMD ["npm", "start"]

