#!/bin/bash
################################################################################
# MongoDB Backup Script
#
# Motivation:
# Implements automated backup strategy for MongoDB data as mentioned in
# PROJECT_OVERVIEW.md. This script creates backups of the MongoDB database
# and stores them in a persistent location.
#
# Approach:
# - Uses mongodump to create database backups
# - Compresses backups to save storage space
# - Stores backups with timestamp in filename
# - Implements retention policy to manage disk space
# - Provides logging for backup operations
#
# Benefits:
# - Automated database backups
# - Data recovery capability
# - Configurable retention policy
# - Simple and reliable backup process
#
# Usage:
# This script is designed to run as a Kubernetes CronJob. It can also be
# executed manually for on-demand backups.
################################################################################

set -euo pipefail

# Configuration
DB_HOST="${MONGODB_HOST:-nodejs-guestbook-mongodb}"
DB_PORT="${MONGODB_PORT:-27017}"
DB_NAME="${MONGODB_DB_NAME:-guestbook}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/mongodb-backup-${TIMESTAMP}.archive.gz"
LOG_FILE="${BACKUP_DIR}/backup.log"

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Log function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_FILE}"
}

# Error handler
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Check if mongodump is available
if ! command -v mongodump &> /dev/null; then
    error_exit "mongodump command not found. Please install MongoDB client tools."
fi

log "Starting MongoDB backup..."
log "Database: ${DB_NAME}@${DB_HOST}:${DB_PORT}"
log "Backup file: ${BACKUP_FILE}"

# Create backup using mongodump
if mongodump \
    --host="${DB_HOST}:${DB_PORT}" \
    --db="${DB_NAME}" \
    --archive="${BACKUP_FILE}" \
    --gzip \
    --quiet; then
    log "Backup completed successfully: ${BACKUP_FILE}"
    
    # Get backup file size
    BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    log "Backup size: ${BACKUP_SIZE}"
else
    error_exit "Backup failed!"
fi

# Clean up old backups (retention policy)
log "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "mongodb-backup-*.archive.gz" -type f -mtime +${RETENTION_DAYS} -delete
DELETED_COUNT=$(find "${BACKUP_DIR}" -name "mongodb-backup-*.archive.gz" -type f | wc -l)
log "Retained ${DELETED_COUNT} backup(s)"

# List current backups
log "Current backups:"
ls -lh "${BACKUP_DIR}"/mongodb-backup-*.archive.gz 2>/dev/null || log "No backups found"

log "Backup process completed successfully"

