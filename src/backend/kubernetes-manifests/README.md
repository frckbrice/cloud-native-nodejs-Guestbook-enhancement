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

The `skaffold.yaml` uses wildcards to deploy all manifests. Ensure you're using StatefulSets:

```yaml
manifests:
  - ./kubernetes-manifests/*.yaml  # Deploys all YAML files
```

**Note**: Make sure `guestbook-backend.deployment.yaml` is not in the directory, or update Skaffold to explicitly list only StatefulSets.

## Verification

Run the verification script to check MongoDB persistence:

```bash
./scripts/verify-mongodb-persistence.sh
```

