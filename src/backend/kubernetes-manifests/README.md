# Kubernetes Manifests

This directory contains Kubernetes manifests for deploying the guestbook application.

## MongoDB Deployment

** IMPORTANT: Only StatefulSet is used for MongoDB (persistent storage)**

-  **Use**: `mongo.statefulset.yaml` - StatefulSet with persistent storage
-  **Use**: `mongo.service.yaml` - Headless service for StatefulSet
-  **Deprecated**: `mongo.deployment.yaml.deprecated` - Ephemeral storage (DO NOT USE)

The `mongo.deployment.yaml` file has been renamed to `.deprecated` to prevent accidental deployment. The Skaffold configuration explicitly excludes it.

### Why StatefulSet?

- **Persistent Storage**: Data survives pod restarts and deployments
- **Stable Network Identity**: Predictable DNS names for service discovery
- **Ordered Deployment**: Ensures database is ready before apps connect
- **Production Ready**: Proper resource management and health checks

### Deployment

The StatefulSet automatically creates PVCs using `volumeClaimTemplates`. No need to manually create PVCs unless you want to use a specific storage class.

## Files

### Backend
- `guestbook-backend.statefulset.yaml` - Backend StatefulSet with persistent storage (✅ USE THIS)
- `guestbook-backend.deployment.yaml` - Old ephemeral deployment (❌ DO NOT USE)
- `guestbook-backend.service.yaml` - Backend service

### Database
- `mongo.statefulset.yaml` - MongoDB StatefulSet (✅ USE THIS)
- `mongo.service.yaml` - MongoDB headless service
- `mongo.deployment.yaml.deprecated` - Old ephemeral deployment (❌ DO NOT USE)
- `mongo.pvc.yaml` - Optional manual PVC (StatefulSet creates PVCs automatically)

### Network
- `network-policy.yaml` - Network policies for security

### Backup
- `mongodb-backup-pvc.yaml` - PersistentVolumeClaim for storing MongoDB backups (20Gi)
- `mongodb-backup-cronjob.yaml` - CronJob for automated daily MongoDB backups

## Backend StatefulSet

**IMPORTANT: Backend now uses StatefulSet for persistent storage of uploaded images**

The backend has been migrated from Deployment to StatefulSet to persist uploaded image files across pod restarts. This prevents 404 errors when images are referenced in the database but the actual files are lost.

### Why StatefulSet for Backend?

- **Persistent Storage**: Image files persist across pod restarts and deployments
- **No More 404 Errors**: Images referenced in MongoDB remain accessible
- **Production Ready**: Proper file storage solution for user uploads

### Architecture

- **MongoDB StatefulSet**: Stores database data (messages, users, imageUrl references)
- **Backend StatefulSet**: Stores actual image files in `/app/uploads`
- **Both work together**: MongoDB has metadata, Backend has files

### Migration

If you're using the old Deployment, migrate to StatefulSet:

```bash
# Delete old Deployment
kubectl delete deployment nodejs-guestbook-backend

# Apply StatefulSet
kubectl apply -f src/backend/kubernetes-manifests/guestbook-backend.statefulset.yaml

# Verify
kubectl get statefulset nodejs-guestbook-backend
kubectl get pvc -l app=nodejs-guestbook,tier=backend
```

## Skaffold Configuration

The `skaffold.yaml` uses wildcards to deploy all manifests. This includes:

- **Backend**: StatefulSet, Service
- **MongoDB**: StatefulSet, Service, PVC (optional, StatefulSet creates its own)
- **Backup**: PVC (`mongodb-backup-pvc.yaml`), CronJob (`mongodb-backup-cronjob.yaml`)
- **Network**: Network Policies

```yaml
manifests:
  - ./kubernetes-manifests/*.yaml  # Deploys all YAML files
```

**Note**: 
- Make sure `guestbook-backend.deployment.yaml` is not in the directory (it's been renamed to `.deprecated`)
- The backup resources (PVC and CronJob) are automatically deployed via the wildcard pattern
- Kubernetes handles dependency ordering automatically (PVC is created before CronJob)

## MongoDB Backup

Automated backups are configured via CronJob that runs daily at 2:00 AM (configurable).

### Backup Components

1. **PersistentVolumeClaim** (`mongodb-backup-pvc.yaml`)
   - Provides 20Gi of persistent storage for backups
   - Backups survive pod restarts and deletions

2. **CronJob** (`mongodb-backup-cronjob.yaml`)
   - Runs scheduled backups using `mongodump`
   - Compresses backups to save space
   - Implements retention policy (default: 7 days)
   - Stores backups with timestamp in filename

### Deployment

**Automatic Deployment**: The backup resources are automatically deployed when using Skaffold, as they are included in the `./kubernetes-manifests/*.yaml` wildcard pattern in `skaffold.yaml`. Kubernetes will handle the dependency order automatically (PVC is created before CronJob).

**Manual Deployment** (if needed): If deploying manually without Skaffold, deploy in this order:

```bash
# 1. Create backup storage (must be created first)
kubectl apply -f src/backend/kubernetes-manifests/mongodb-backup-pvc.yaml

# 2. Deploy backup CronJob (depends on PVC)
kubectl apply -f src/backend/kubernetes-manifests/mongodb-backup-cronjob.yaml
```

**Note**: The CronJob depends on the PVC (`mongodb-backup-storage`). If the PVC fails to create (e.g., no storage class available in your cluster), the CronJob will also fail. Check PVC status with `kubectl get pvc mongodb-backup-storage`.

### Configuration

Environment variables in the CronJob:
- `BACKUP_SCHEDULE`: Cron schedule (default: `0 2 * * *` - daily at 2 AM)
- `BACKUP_RETENTION_DAYS`: Days to retain backups (default: `7`)
- `MONGODB_HOST`: MongoDB service name (default: `nodejs-guestbook-mongodb`)
- `MONGODB_DB_NAME`: Database name (default: `guestbook`)

### Manual Backup

Trigger a manual backup:

```bash
kubectl create job --from=cronjob/mongodb-backup manual-backup-$(date +%s)
```

### View Backup Logs

```bash
# View recent backup logs
kubectl logs -l app=nodejs-guestbook,component=backup --tail=50

# View logs from a specific backup job
kubectl logs job/mongodb-backup-<timestamp>
```

### List Backups

Backups are stored in the PVC. To access them:

```bash
# Create a temporary pod to access backup storage
kubectl run backup-access --rm -it --image=busybox --restart=Never -- sh -c "ls -lh /backups"

# Or exec into the backup pod if one is running
kubectl exec -it <backup-pod-name> -- ls -lh /backups
```

### Restore from Backup

To restore from a backup:

```bash
# Copy backup file to a pod with mongorestore
kubectl cp <backup-pod-name>:/backups/mongodb-backup-<timestamp>.archive.gz /tmp/backup.archive.gz

# Restore using mongorestore
kubectl run mongorestore --rm -it --image=mongo:4 --restart=Never -- \
  mongorestore --host=nodejs-guestbook-mongodb:27017 \
  --db=guestbook --archive=/tmp/backup.archive.gz --gzip
```

## Verification

Run the verification script to check MongoDB persistence:

```bash
./scripts/verify-mongodb-persistence.sh
```

