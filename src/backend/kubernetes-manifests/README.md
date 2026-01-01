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
- `guestbook-backend.deployment.yaml` - Backend application deployment
- `guestbook-backend.service.yaml` - Backend service

### Database
- `mongo.statefulset.yaml` - MongoDB StatefulSet (✅ USE THIS)
- `mongo.service.yaml` - MongoDB headless service
- `mongo.deployment.yaml.deprecated` - Old ephemeral deployment (❌ DO NOT USE)
- `mongo.pvc.yaml` - Optional manual PVC (StatefulSet creates PVCs automatically)

### Network
- `network-policy.yaml` - Network policies for security

## Skaffold Configuration

The `skaffold.yaml` explicitly lists which manifests to deploy, ensuring only StatefulSet is used:

```yaml
manifests:
  - ./kubernetes-manifests/guestbook-backend.deployment.yaml
  - ./kubernetes-manifests/guestbook-backend.service.yaml
  - ./kubernetes-manifests/mongo.statefulset.yaml  #  Only StatefulSet
  - ./kubernetes-manifests/mongo.service.yaml
  - ./kubernetes-manifests/network-policy.yaml
```

## Verification

Run the verification script to check MongoDB persistence:

```bash
./scripts/verify-mongodb-persistence.sh
```

