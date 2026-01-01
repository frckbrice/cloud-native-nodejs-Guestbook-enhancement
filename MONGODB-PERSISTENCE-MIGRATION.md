# MongoDB Persistence Migration Guide

## Problem

If MongoDB is deployed using a **Deployment** (instead of StatefulSet), data will be lost every time the pod restarts. This explains why:
- User data disappears after Kubernetes rebuilds
- Only old messages (2-3 hours ago) remain
- New messages are cleared
- Login fails because users no longer exist

## Solution

Migrate MongoDB from **Deployment** to **StatefulSet** with persistent storage.

## Quick Fix

Run the verification script to check current status:
```bash
./verify-mongodb-persistence.sh
```

## Manual Migration Steps

### 1. Check Current Status

```bash
# Check if Deployment exists (BAD - ephemeral storage)
kubectl get deployment nodejs-guestbook-mongodb

# Check if StatefulSet exists (GOOD - persistent storage)
kubectl get statefulset nodejs-guestbook-mongodb

# Check PVCs
kubectl get pvc -l app=nodejs-guestbook,tier=db
```

### 2. If Deployment Exists, Migrate to StatefulSet

**⚠️ WARNING: This will cause a brief downtime. Backup data first if needed.**

```bash
# Step 1: Delete the old Deployment
kubectl delete deployment nodejs-guestbook-mongodb

# Step 2: Apply StatefulSet with persistent storage
kubectl apply -f src/backend/kubernetes-manifests/mongo.statefulset.yaml

# Step 3: Ensure service is configured correctly
kubectl apply -f src/backend/kubernetes-manifests/mongo.service.yaml

# Step 4: Wait for StatefulSet to be ready
kubectl wait --for=condition=ready pod -l app=nodejs-guestbook,tier=db --timeout=300s

# Step 5: Verify PVCs are bound
kubectl get pvc -l app=nodejs-guestbook,tier=db
```

### 3. Verify Persistence

```bash
# Check StatefulSet status
kubectl get statefulset nodejs-guestbook-mongodb

# Check pod status
kubectl get pods -l app=nodejs-guestbook,tier=db

# Check PVC status (should show "Bound")
kubectl get pvc -l app=nodejs-guestbook,tier=db
```

## What Changed

### Before (Deployment - Ephemeral Storage)
- ❌ Data lost on pod restart
- ❌ No persistent volumes
- ❌ Users and messages disappear

### After (StatefulSet - Persistent Storage)
- ✅ Data persists across restarts
- ✅ 10Gi persistent volume per pod
- ✅ Users and messages preserved

## StatefulSet Benefits

1. **Persistent Storage**: Uses `volumeClaimTemplates` to create PVCs automatically
2. **Stable Network Identity**: Predictable DNS names
3. **Ordered Deployment**: Ensures database is ready before apps connect
4. **Data Persistence**: Data survives pod restarts and deployments

## Troubleshooting

### PVC Not Binding

If PVCs show "Pending":
```bash
# Check storage class
kubectl get storageclass

# Check PVC events
kubectl describe pvc -l app=nodejs-guestbook,tier=db
```

### StatefulSet Not Starting

```bash
# Check pod logs
kubectl logs -l app=nodejs-guestbook,tier=db

# Check pod events
kubectl describe pod -l app=nodejs-guestbook,tier=db
```

### Data Still Missing After Migration

If you migrated from Deployment to StatefulSet, the old data is lost. The StatefulSet creates a new empty database. You'll need to:
1. Re-register users
2. Re-create messages

**Future data will persist** once StatefulSet is running.

## Prevention

Always use StatefulSet for MongoDB in Kubernetes. The old `mongo.deployment.yaml` should not be used in production.

## Files

- ✅ **Use**: `src/backend/kubernetes-manifests/mongo.statefulset.yaml`
- ✅ **Use**: `src/backend/kubernetes-manifests/mongo.service.yaml`
- ❌ **Don't use**: `src/backend/kubernetes-manifests/mongo.deployment.yaml` (ephemeral storage)

