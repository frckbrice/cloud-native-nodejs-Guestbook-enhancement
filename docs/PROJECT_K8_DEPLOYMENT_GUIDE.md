# Kubernetes Deployment Guide

This comprehensive guide covers everything you need to know to deploy and run the Guestbook application on Kubernetes, including persistent storage configuration, StatefulSets, and production-ready practices.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Persistent Storage Configuration](#persistent-storage-configuration)
3. [StatefulSets vs Deployments](#statefulsets-vs-deployments)
4. [Deployment Steps](#deployment-steps)
5. [Migration Guide](#migration-guide)
6. [Verification and Troubleshooting](#verification-and-troubleshooting)
7. [Production Considerations](#production-considerations)

---

## Architecture Overview

The Guestbook application uses a **three-tier architecture** with persistent storage for both database and file uploads:

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Service                         │
│  - Node.js/Express (Pug templates)                          │
│  - Exposed via Ingress                                      │
│  - Communicates with Backend via REST API                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTP/REST
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                    Backend Service                           │
│  - Node.js/Express API                                       │
│  - JWT Authentication                                        │
│  - WebSocket (Socket.IO)                                     │
│  - Image upload handling                                     │
│  - StatefulSet with Persistent Storage (uploads)             │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ MongoDB Connection
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                    MongoDB Database                          │
│  - MongoDB 4 (check its EOL)                                 │
│  - StatefulSet with Persistent Storage (database)            │
│  - Internal service (ClusterIP)                              │
└──────────────────────────────────────────────────────────────┘
```

### Key Components

| Component    | Type        | Storage           | Purpose                 |
|--------------|-------------|-------------------|-------------------------|
| **Frontend** | Deployment  | Ephemeral         | Web UI, user interface  |
| **Backend**  | StatefulSet | Persistent (5Gi)  | API server, image files |
| **MongoDB**  | StatefulSet | Persistent (10Gi) | Database, metadata      |

---

## Persistent Storage Configuration

### Why Persistent Storage?

**Problem**: Without persistent storage, data is lost when pods restart:
- ❌ MongoDB data (messages, users) lost on pod restart
- ❌ Uploaded image files lost on pod restart
- ❌ Users see 404 errors for images after deployments

**Solution**: Use StatefulSets with PersistentVolumeClaims (PVCs) to persist data across pod restarts.

### Storage Architecture

#### 1. MongoDB StatefulSet (`mongo.statefulset.yaml`)

**Purpose**: Store database data (messages, users, metadata)

**Configuration**:
- **Volume**: `/data/db` → `mongodb-data` PVC
- **Storage**: 10Gi (configurable)
- **Access Mode**: ReadWriteOnce
- **Storage Class**: Uses cluster default (e.g., `standard` on GKE, `hostpath` on Minikube)

**What it stores**:
- MongoDB database files
- Collections (messages, users)
- Indexes
- Metadata

**What it does NOT store**:
- Image files (these are stored in the backend)

#### 2. Backend StatefulSet (`guestbook-backend.statefulset.yaml`)

**Purpose**: Store uploaded image files

**Configuration**:
- **Volume**: `/app/uploads` → `uploads-storage` PVC
- **Storage**: 5Gi (configurable)
- **Access Mode**: ReadWriteOnce
- **Storage Class**: Uses cluster default

**What it stores**:
- Uploaded image files (PNG, JPG, GIF, WebP)
- Files referenced by MongoDB `imageUrl` fields

**What it does NOT store**:
- Database data (this is in MongoDB)

### How They Work Together

```
User uploads image
    ↓
Backend receives file → Saves to /app/uploads/photo.jpg
    ↓
Backend saves to MongoDB → { "imageUrl": "/uploads/photo.jpg" }
    ↓
MongoDB StatefulSet persists the metadata
Backend StatefulSet persists the actual file
    ↓
On pod restart:
  - MongoDB still has: "imageUrl": "/uploads/photo.jpg"
  - Backend still has: /app/uploads/photo.jpg
  - Image displays correctly!
```

---

## StatefulSets vs Deployments

### When to Use StatefulSet

**Use StatefulSet for**:
-  Databases (MongoDB, PostgreSQL, MySQL)
-  Applications that store files (image uploads, file storage)
-  Applications requiring stable network identity
-  Applications needing ordered deployment/scaling

**Use Deployment for**:
-  Stateless web applications (frontend, API servers without file storage)
-  Applications that don't need persistent storage
-  Applications that can scale horizontally without ordering

### Key Differences

| Feature              | Deployment           | StatefulSet                     |
|----------------------|----------------------|---------------------------------|
| **Storage**          | Ephemeral (emptyDir) | Persistent (PVC)                |
| **Network Identity** | Random pod names     | Stable pod names (pod-0, pod-1) |
| **Scaling**          | Parallel             | Ordered (0→1→2)                 |
| **PVC Management**   | Manual               | Automatic (volumeClaimTemplates)|
| **Use Case**         | Stateless apps       | Stateful apps                   |

### Current Configuration

| Component | Resource Type   | Reason                        |
|-----------|-----------------|-------------------------------|
| Frontend  | Deployment      | Stateless, no persistent data |
| Backend   | **StatefulSet** | Stores uploaded image files   |
| MongoDB   | **StatefulSet** | Database requires persistence |

---

## Deployment Steps

### Prerequisites

1. **Kubernetes cluster** (Minikube, GKE, EKS, AKS, or Docker Desktop)
2. **kubectl** configured to access your cluster
3. **Docker** for building images
4. **Skaffold** (optional, for development workflow)

### Step 1: Verify Cluster Access

```bash
# Check cluster connection
kubectl cluster-info

# Verify nodes are ready
kubectl get nodes

# Check storage classes (for PVC creation)
kubectl get storageclass
```

### Step 2: Deploy MongoDB StatefulSet

```bash
# Apply MongoDB StatefulSet
kubectl apply -f src/backend/kubernetes-manifests/mongo.statefulset.yaml

# Apply MongoDB Service
kubectl apply -f src/backend/kubernetes-manifests/mongo.service.yaml

# Wait for MongoDB to be ready
kubectl wait --for=condition=ready pod -l app=nodejs-guestbook,tier=db --timeout=300s

# Verify PVC was created
kubectl get pvc -l app=nodejs-guestbook,tier=db
```

**Expected Output**:
```
NAME                    STATUS   VOLUME   CAPACITY   ACCESS MODES   STORAGECLASS   AGE
mongodb-data-...        Bound    pvc-...  10Gi       RWO            standard       1m
```

### Step 3: Deploy Backend StatefulSet

```bash
# Apply Backend StatefulSet
kubectl apply -f src/backend/kubernetes-manifests/guestbook-backend.statefulset.yaml

# Apply Backend Service
kubectl apply -f src/backend/kubernetes-manifests/guestbook-backend.service.yaml

# Wait for Backend to be ready
kubectl wait --for=condition=ready pod -l app=nodejs-guestbook,tier=backend --timeout=300s

# Verify PVC was created
kubectl get pvc -l app=nodejs-guestbook,tier=backend
```

**Expected Output**:
```
NAME                    STATUS   VOLUME   CAPACITY   ACCESS MODES   STORAGECLASS   AGE
uploads-storage-...     Bound    pvc-...  5Gi        RWO            standard       1m
```

### Step 4: Deploy Frontend

```bash
# Apply Frontend Deployment
kubectl apply -f src/frontend/kubernetes-manifests/guestbook-frontend.deployment.yaml

# Apply Frontend Service
kubectl apply -f src/frontend/kubernetes-manifests/guestbook-frontend.service.yaml

# Apply Ingress (if using)
kubectl apply -f src/frontend/kubernetes-manifests/guestbook-frontend.ingress.yaml

# Wait for Frontend to be ready
kubectl wait --for=condition=available deployment/nodejs-guestbook-frontend --timeout=300s
```

### Step 5: Verify Deployment

```bash
# Check all resources
kubectl get all -l app=nodejs-guestbook

# Check StatefulSets
kubectl get statefulset

# Check PVCs
kubectl get pvc

# Check pods
kubectl get pods -l app=nodejs-guestbook

# Check services
kubectl get svc -l app=nodejs-guestbook
```

### Step 6: Access the Application

**Local Development (Minikube)**:
```bash
# Get frontend URL
minikube service nodejs-guestbook-frontend --url

# Or use port forwarding
kubectl port-forward svc/nodejs-guestbook-frontend 4503:80
# Access at http://localhost:4503
```

**Cloud (GKE/EKS/AKS)**:
```bash
# Get Ingress IP
kubectl get ingress

# Access via Ingress IP or domain
```

---

## Migration Guide

### Migrating from Deployment to StatefulSet

If you're currently using Deployments with `emptyDir` (described in backend manifest deployment), follow these steps to migrate to StatefulSets with persistent storage.

#### MongoDB Migration

** WARNING**: This will cause brief downtime. Backup data first if needed.

```bash
# Step 1: Check current deployment
kubectl get deployment nodejs-guestbook-mongodb

# Step 2: Delete old Deployment (if exists)
kubectl delete deployment nodejs-guestbook-mongodb

# Step 3: Apply StatefulSet
kubectl apply -f src/backend/kubernetes-manifests/mongo.statefulset.yaml

# Step 4: Verify StatefulSet is ready
kubectl wait --for=condition=ready pod -l app=nodejs-guestbook,tier=db --timeout=300s

# Step 5: Verify PVC
kubectl get pvc -l app=nodejs-guestbook,tier=db
```

**Note**: Old data will be lost. New data will persist after migration.

#### Backend Migration

** WARNING**: This will cause brief downtime. Any existing uploads will be lost.

```bash
# Step 1: Check current deployment
kubectl get deployment nodejs-guestbook-backend

# Step 2: Delete old Deployment
kubectl delete deployment nodejs-guestbook-backend

# Step 3: Apply StatefulSet
kubectl apply -f src/backend/kubernetes-manifests/guestbook-backend.statefulset.yaml

# Step 4: Verify StatefulSet is ready
kubectl wait --for=condition=ready pod -l app=nodejs-guestbook,tier=backend --timeout=300s

# Step 5: Verify PVC
kubectl get pvc -l app=nodejs-guestbook,tier=backend
```

**Note**: The service will automatically route to the new StatefulSet pod (same labels).

---

## Verification and Troubleshooting

### Verify Persistence

#### Test MongoDB Persistence

```bash
# 1. Create a test message via the UI
# 2. Delete the MongoDB pod
kubectl delete pod -l app=nodejs-guestbook,tier=db

# 3. Wait for pod to restart
kubectl wait --for=condition=ready pod -l app=nodejs-guestbook,tier=db --timeout=300s

# 4. Check if data still exists (should see your test message)
```

#### Test Backend Upload Persistence

```bash
# 1. Upload an image via the UI
# 2. Delete the backend pod
kubectl delete pod -l app=nodejs-guestbook,tier=backend

# 3. Wait for pod to restart
kubectl wait --for=condition=ready pod -l app=nodejs-guestbook,tier=backend --timeout=300s

# 4. Check if image still displays (should work)
```

### Common Issues

#### Issue: PVC Not Binding

**Symptoms**: PVC shows "Pending" status

**Solutions**:
```bash
# Check storage class
kubectl get storageclass

# Check PVC events
kubectl describe pvc <pvc-name>

# For Minikube, ensure storage provisioner is running
minikube addons enable default-storageclass
```

#### Issue: StatefulSet Pod Not Starting

**Symptoms**: Pod stuck in "Pending" or "Init" state

**Solutions**:
```bash
# Check pod events
kubectl describe pod <pod-name>

# Check init container logs
kubectl logs <pod-name> -c init-db-ready

# Check main container logs
kubectl logs <pod-name>
```

#### Issue: Images Return 404 After Pod Restart

**Symptoms**: Images display as broken after backend pod restart

**Cause**: Backend is using Deployment with `emptyDir` instead of StatefulSet

**Solution**: Migrate to StatefulSet (see recommendations above)

#### Issue: Data Lost After Pod Restart

**Symptoms**: Messages/users disappear after MongoDB pod restart

**Cause**: MongoDB is using Deployment with `emptyDir` instead of StatefulSet

**Solution**: Migrate to StatefulSet (see recommendations above)

### Diagnostic Commands

```bash
# Check all resources
kubectl get all -l app=nodejs-guestbook

# Check StatefulSets
kubectl get statefulset

# Check PVCs and their status
kubectl get pvc

# Check pod status
kubectl get pods -l app=nodejs-guestbook -o wide

# View pod logs
kubectl logs -l app=nodejs-guestbook,tier=backend --tail=50

# Check events
kubectl get events --sort-by='.lastTimestamp' | tail -20

# Describe resource for detailed info
kubectl describe statefulset nodejs-guestbook-backend
kubectl describe pvc <pvc-name>
```

---

## Production Considerations

### Storage Classes

Different cloud providers use different storage classes:

| Provider     | Storage Class | Type     | Performance             |
|--------------|---------------|----------|-------------------------|
| **GKE**      | `standard`    | HDD      | Standard                |
| **GKE**      | `premium-rwo` | SSD      | High                    |
| **EKS**      | `gp2`         | SSD      | General Purpose         |
| **EKS**      | `gp3`         | SSD      | General Purpose (newer) |
| **Minikube** | `standard`    | hostPath | Local                   |

To specify a storage class, update the `volumeClaimTemplates`:

```yaml
volumeClaimTemplates:
- metadata:
    name: uploads-storage
  spec:
    accessModes: [ "ReadWriteOnce" ]
    storageClassName: premium-rwo  # Specify storage class
    resources:
      requests:
        storage: 5Gi
```

### Backup Strategy

Even with persistent storage, implement backups:

1. **MongoDB Backups**:
   ```bash
   # Create backup
   kubectl exec -it <mongodb-pod> -- mongodump --out=/data/db/backup
   
   # Restore backup
   kubectl exec -it <mongodb-pod> -- mongorestore /data/db/backup
   ```

2. **PVC Snapshots** (if supported by your cluster):
   ```bash
   # Create snapshot
   kubectl create volumesnapshot <snapshot-name> --source=<pvc-name>
   ```

3. **Automated Backups**:
   - Use Kubernetes CronJobs for scheduled backups
   - Store backups in cloud storage (GCS, S3, Azure Blob)

### Resource Limits

Add resource limits to StatefulSets for production:

```yaml
containers:
- name: backend
  resources:
    requests:
      memory: "256Mi"
      cpu: "250m"
    limits:
      memory: "512Mi"
      cpu: "500m"
```

### High Availability

For production, consider:

1. **Multiple Replicas**: Increase `replicas` in StatefulSet (requires ReadWriteMany storage or shared storage)
2. **Pod Disruption Budgets**: Ensure minimum pods available during updates
3. **Health Checks**: Already configured (liveness and readiness probes)
4. **Monitoring**: Set up Prometheus/Grafana for metrics

### Security

1. **Network Policies**: Already configured (`network-policy.yaml`)
2. **Secrets Management**: Use Kubernetes Secrets for sensitive data
3. **RBAC**: Configure proper role-based access control
4. **Image Security**: Scan images for vulnerabilities

---

## File Reference

### Kubernetes Manifests

| File                                 | Purpose                         | Status     |
|--------------------------------------|---------------------------------|------------|
| `mongo.statefulset.yaml`             | MongoDB with persistent storage |  in  Use   |
| `mongo.service.yaml`                 | MongoDB headless service        |  in  Use   |
| `guestbook-backend.statefulset.yaml` | Backend with persistent uploads |  in  Use   |
| `guestbook-backend.service.yaml`     | Backend service                 |  in  Use   |
| `guestbook-frontend.deployment.yaml` | Frontend deployment             |  in  Use   |
| `guestbook-frontend.service.yaml`    | Frontend service                |  in  Use   |
| `guestbook-frontend.ingress.yaml`    | Ingress for external access     |  in  Use   |
| `network-policy.yaml`                | Network security policies       |  in  Use   |
| `mongo.deployment.yaml.deprecated`   | Old ephemeral MongoDB           | not in use |
| `guestbook-backend.deployment.yaml`  | Old ephemeral backend           | not in use |

### Important Notes

1. **Always use StatefulSets** for MongoDB and Backend (they need persistent storage)
2. **Deployment is fine** for Frontend (stateless)
3. **PVCs are created automatically** by StatefulSet `volumeClaimTemplates`
4. **Service labels must match** StatefulSet/Deployment labels for routing

---

## Quick Reference

### Essential Commands

```bash
# Deploy everything
kubectl apply -f src/backend/kubernetes-manifests/
kubectl apply -f src/frontend/kubernetes-manifests/

# Check status
kubectl get all -l app=nodejs-guestbook

# View logs
kubectl logs -l app=nodejs-guestbook,tier=backend
kubectl logs -l app=nodejs-guestbook,tier=db

# Delete everything
kubectl delete -f src/backend/kubernetes-manifests/
kubectl delete -f src/frontend/kubernetes-manifests/
```

### Verification Checklist

- [ ] MongoDB StatefulSet is running
- [ ] Backend StatefulSet is running
- [ ] Frontend Deployment is running
- [ ] All PVCs are "Bound"
- [ ] All pods are "Running" and "Ready"
- [ ] Services are accessible
- [ ] Data persists after pod restart
- [ ] Images persist after pod restart

---

## Additional Resources

- [Kubernetes StatefulSets Documentation](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)
- [Persistent Volumes Guide](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)
- [Storage Classes](https://kubernetes.io/docs/concepts/storage/storage-classes/)
- [Project Overview](./PROJECT_OVERVIEW.md)


