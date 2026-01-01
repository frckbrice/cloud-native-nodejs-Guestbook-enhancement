# Kubernetes Architecture & Configuration Guide

This document explains the key Kubernetes concepts and configurations used in the Guestbook application.

---

## 1. Service Discovery Using Kubernetes DNS

### How It Works

Kubernetes provides built-in DNS service discovery through **CoreDNS** (or kube-dns). When you create a Service in Kubernetes, it automatically gets a DNS name that other pods can use to communicate with it.

### DNS Naming Convention

The DNS name for a service follows this pattern:
```
<service-name>.<namespace>.svc.cluster.local
```

For services in the same namespace, you can use just the `<service-name>`.

### Current Configuration

In this Guestbook application, services discover each other using Kubernetes DNS:

#### Backend → MongoDB
**File**: `src/backend/kubernetes-manifests/guestbook-backend.deployment.yaml`

```yaml
env:
- name: GUESTBOOK_DB_ADDR
  value: "nodejs-guestbook-mongodb:27017"
```

The backend connects to MongoDB using the service name `nodejs-guestbook-mongodb`, which resolves to the MongoDB service's ClusterIP. The port `27017` is the standard MongoDB port.

**How it resolves**:
- Service name: `nodejs-guestbook-mongodb` (from `mongo.service.yaml`)
- Kubernetes DNS resolves this to the service's ClusterIP
- The backend pod can reach MongoDB at `nodejs-guestbook-mongodb:27017`

#### Frontend → Backend
**File**: `src/frontend/kubernetes-manifests/guestbook-frontend.deployment.yaml`

```yaml
env:
- name: GUESTBOOK_API_ADDR
  value: nodejs-guestbook-backend:8080
```

The frontend connects to the backend using the service name `nodejs-guestbook-backend`, which resolves to the backend service's ClusterIP.

**How it resolves**:
- Service name: `nodejs-guestbook-backend` (from `guestbook-backend.service.yaml`)
- Kubernetes DNS resolves this to the service's ClusterIP
- The frontend pod can reach the backend at `nodejs-guestbook-backend:8080`

### DNS Resolution Flow

```
┌─────────────────────────────────────────────────────────┐
│  Frontend Pod                                           │
│  Makes HTTP request to:                                 │
│  http://nodejs-guestbook-backend:8080/messages          │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ DNS Query: nodejs-guestbook-backend
                   ▼
┌─────────────────────────────────────────────────────────┐
│  Kubernetes DNS (CoreDNS)                               │
│  Resolves to: ClusterIP of backend service              │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ Routes to Service
                   ▼
┌─────────────────────────────────────────────────────────┐
│  Backend Service (ClusterIP)                            │
│  Load balances to backend pods                          │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ HTTP Request
                   ▼
┌─────────────────────────────────────────────────────────┐
│  Backend Pod                                            │
│  Processes request, queries MongoDB                     │
│  nodejs-guestbook-mongodb:27017                         │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ DNS Query: nodejs-guestbook-mongodb
                   ▼
┌─────────────────────────────────────────────────────────┐
│  Kubernetes DNS (CoreDNS)                               │
│  Resolves to: ClusterIP of MongoDB service              │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ MongoDB Connection
                   ▼
┌─────────────────────────────────────────────────────────┐
│  MongoDB Service (ClusterIP)                            │
│  Routes to MongoDB pod                                  │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│  MongoDB Pod                                            │
└─────────────────────────────────────────────────────────┘
```

### Benefits of Kubernetes DNS

1. **No Hard-coded IPs**: Services can be recreated with different IPs, but DNS names remain stable
2. **Automatic Load Balancing**: DNS resolution points to the Service, which load balances across multiple pods
3. **Namespace Isolation**: Services in different namespaces can have the same name
4. **Simple Configuration**: Just use the service name as the hostname

---

## 2. Health Checks

### Current Status

**No health checks are currently configured** in the Guestbook application. This means Kubernetes cannot automatically detect if pods are healthy or ready to receive traffic.

### Types of Health Checks

Kubernetes supports two types of health checks:

#### 1. **Liveness Probe**
- Determines if a container is **alive** and running
- If the probe fails, Kubernetes **restarts** the container
- Use when: The application might hang or deadlock but the process is still running

#### 2. **Readiness Probe**
- Determines if a container is **ready** to accept traffic
- If the probe fails, Kubernetes **removes** the pod from service endpoints
- Use when: The application needs time to start up or is temporarily unavailable

### How to Add Health Checks

#### For Backend Service

Add health check endpoints and probes:

**1. Add a health check endpoint** (in `src/backend/app.js`):

```javascript
// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Readiness check (includes DB connection)
app.get('/ready', async (req, res) => {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState === 1) {
      res.status(200).json({ status: 'ready' });
    } else {
      res.status(503).json({ status: 'not ready' });
    }
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});
```

**2. Add probes to deployment** (`src/backend/kubernetes-manifests/guestbook-backend.deployment.yaml`):

```yaml
containers:
- name: backend
  image: nodejs-guestbook-backend
  ports:
  - name: http-server
    containerPort: 8080
  env:
  - name: PORT
    value: "8080"
  - name: GUESTBOOK_DB_ADDR
    value: "nodejs-guestbook-mongodb:27017"
  livenessProbe:
    httpGet:
      path: /health
      port: http-server
    initialDelaySeconds: 30  # Wait 30s before first check
    periodSeconds: 10         # Check every 10s
    timeoutSeconds: 5         # Timeout after 5s
    failureThreshold: 3       # Restart after 3 failures
  readinessProbe:
    httpGet:
      path: /ready
      port: http-server
    initialDelaySeconds: 10  # Wait 10s before first check
    periodSeconds: 5         # Check every 5s
    timeoutSeconds: 3         # Timeout after 3s
    failureThreshold: 3      # Mark not ready after 3 failures
```

#### For Frontend Service

**1. Add health check endpoint** (in `src/frontend/app.js`):

```javascript
// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Readiness check (includes backend connectivity)
router.get('/ready', async (req, res) => {
  try {
    // Check if backend is reachable
    await axios.get(`http://${GUESTBOOK_API_ADDR}/health`, { timeout: 2000 });
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});
```

**2. Add probes to deployment** (`src/frontend/kubernetes-manifests/guestbook-frontend.deployment.yaml`):

```yaml
containers:
- name: frontend
  image: nodejs-guestbook-frontend
  ports:
  - name: http-server
    containerPort: 8080
  env:
  - name: PORT
    value: "8080"
  - name: GUESTBOOK_API_ADDR
    value: nodejs-guestbook-backend:8080
  livenessProbe:
    httpGet:
      path: /health
      port: http-server
    initialDelaySeconds: 30
    periodSeconds: 10
    timeoutSeconds: 5
    failureThreshold: 3
  readinessProbe:
    httpGet:
      path: /ready
      port: http-server
    initialDelaySeconds: 10
    periodSeconds: 5
    timeoutSeconds: 3
    failureThreshold: 3
```

#### For MongoDB

MongoDB supports health checks via the `mongo` command:

```yaml
containers:
- name: mongo
  image: mongo:4
  ports:
  - containerPort: 27017
  livenessProbe:
    exec:
      command:
      - /bin/sh
      - -c
      - "mongo --eval 'db.adminCommand(\"ping\")'"
    initialDelaySeconds: 30
    periodSeconds: 10
    timeoutSeconds: 5
    failureThreshold: 3
  readinessProbe:
    exec:
      command:
      - /bin/sh
      - -c
      - "mongo --eval 'db.adminCommand(\"ping\")'"
    initialDelaySeconds: 5
    periodSeconds: 5
    timeoutSeconds: 3
    failureThreshold: 3
```

### Probe Types

Kubernetes supports three probe types:

1. **HTTP GET**: Checks HTTP endpoint (most common for web services)
2. **TCP Socket**: Checks if port is open
3. **Exec**: Runs a command and checks exit code (useful for databases)

### Benefits of Health Checks

- **Automatic Recovery**: Unhealthy pods are restarted automatically
- **Zero-Downtime Deployments**: Readiness probes ensure new pods are ready before receiving traffic
- **Better User Experience**: Traffic is only routed to healthy pods
- **Dependency Management**: Pods wait for dependencies to be ready

---

## 3. Data Persistence

### Current Status

 **Data is NOT persisted** in the current MongoDB deployment. The warning comment in `mongo.deployment.yaml` explicitly states:

```yaml
################################################################################
# WARNING: This MongoDB deployment is not suitable for production as the data is
# not persistently stored and will go away every time the Pod restarts.
################################################################################
```

### Why Data is Lost

The MongoDB pod uses **ephemeral storage** (emptyDir or container filesystem). When the pod is deleted or restarted:
- All data stored in MongoDB is lost
- The pod starts with a fresh, empty database

### How to Set Up Data Persistence

There are two main approaches:

#### Option 1: PersistentVolumeClaim (PVC) with Deployment (Simpler)

This approach uses a PersistentVolumeClaim to store MongoDB data:

**1. Create a PersistentVolumeClaim** (`src/backend/kubernetes-manifests/mongo.pvc.yaml`):

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mongodb-pvc
  labels:
    app: nodejs-guestbook
    tier: db
spec:
  accessModes:
    - ReadWriteOnce  # Single pod can mount as read-write
  resources:
    requests:
      storage: 10Gi  # Request 10GB of storage
  # Optional: specify storage class for cloud providers
  # storageClassName: standard
```

**2. Update MongoDB Deployment** (`src/backend/kubernetes-manifests/mongo.deployment.yaml`):

```yaml
kind: Deployment
apiVersion: apps/v1
metadata:
  name: nodejs-guestbook-mongodb
  labels:
    app: nodejs-guestbook
    tier: db
spec:
  replicas: 1
  selector:
    matchLabels:
      app: nodejs-guestbook
      tier: db
  template:
    metadata:
      labels:
        app: nodejs-guestbook
        tier: db
    spec:
      containers:
      - name: mongo
        image: mongo:4
        ports:
        - containerPort: 27017
        volumeMounts:
        - name: mongodb-storage
          mountPath: /data/db  # MongoDB's default data directory
        # Optional: Add health checks
        livenessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - "mongo --eval 'db.adminCommand(\"ping\")'"
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - "mongo --eval 'db.adminCommand(\"ping\")'"
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: mongodb-storage
        persistentVolumeClaim:
          claimName: mongodb-pvc
```

**3. Apply the PVC before the deployment**:

```bash
kubectl apply -f src/backend/kubernetes-manifests/mongo.pvc.yaml
kubectl apply -f src/backend/kubernetes-manifests/mongo.deployment.yaml
```

#### Option 2: StatefulSet (Production-Ready)

For production, use a **StatefulSet** instead of Deployment. StatefulSets provide:
- Stable network identities
- Ordered deployment and scaling
- Stable persistent storage per pod
- Better suited for stateful applications like databases

**1. Create a StatefulSet** (`src/backend/kubernetes-manifests/mongo.statefulset.yaml`):

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: nodejs-guestbook-mongodb
  labels:
    app: nodejs-guestbook
    tier: db
spec:
  serviceName: nodejs-guestbook-mongodb
  replicas: 1
  selector:
    matchLabels:
      app: nodejs-guestbook
      tier: db
  template:
    metadata:
      labels:
        app: nodejs-guestbook
        tier: db
    spec:
      containers:
      - name: mongo
        image: mongo:4
        ports:
        - containerPort: 27017
          name: mongodb
        volumeMounts:
        - name: mongodb-data
          mountPath: /data/db
        livenessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - "mongo --eval 'db.adminCommand(\"ping\")'"
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - "mongo --eval 'db.adminCommand(\"ping\")'"
          initialDelaySeconds: 5
          periodSeconds: 5
  volumeClaimTemplates:
  - metadata:
      name: mongodb-data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 10Gi
```

**Note**: The service for StatefulSet should be a headless service (ClusterIP: None):

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nodejs-guestbook-mongodb
  labels:
    app: nodejs-guestbook
    tier: db
spec:
  clusterIP: None  # Headless service for StatefulSet
  ports:
  - port: 27017
    targetPort: 27017
    name: mongodb
  selector:
    app: nodejs-guestbook
    tier: db
```

### Storage Classes

For cloud providers (GKE, EKS, AKS), you can specify storage classes:

- **GKE**: `standard`, `premium-rwo`, `pd-ssd`
- **EKS**: `gp2`, `gp3`, `io1`
- **Minikube**: Uses `standard` storage class (hostPath)

### Verifying Persistence

After setting up persistence:

1. **Create some data** in the guestbook
2. **Delete the MongoDB pod**:
   ```bash
   kubectl delete pod -l app=nodejs-guestbook,tier=db
   ```
3. **Wait for pod to restart** (Kubernetes will create a new one)
4. **Verify data still exists** - your messages should still be there!

### Backup Considerations

Even with persistent storage, you should implement backups:

- **Regular snapshots** of PersistentVolumes
- **MongoDB dump/restore** using `mongodump` and `mongorestore`
- **Automated backup jobs** using Kubernetes CronJobs

---

## 4. Service Communication: Internal vs External

### Service Types in Kubernetes

Kubernetes supports several service types that determine how services are exposed:

| Type             | Use Case                                | Accessible From                        |
|------------------|-----------------------------------------|----------------------------------------|
| **ClusterIP**    | Internal communication only             | Within cluster only                    |
| **NodePort**     | External access via node IP             | Cluster + External (via node IP)       |
| **LoadBalancer** | External access via cloud load balancer | Cluster + External (via load balancer) |
| **ExternalName** | Maps to external DNS name               | External service                       |

### Current Configuration

#### Frontend Service (External Access)

**File**: `src/frontend/kubernetes-manifests/guestbook-frontend.service.yaml`

```yaml
spec:
  type: LoadBalancer  # External access
  selector:
    app: nodejs-guestbook
    tier: frontend
  ports:
  - port: 80
    targetPort: http-server
```

**Characteristics**:
- **Externally accessible**: Users can access the application from the internet
- **Cloud Load Balancer**: On cloud providers (GKE, EKS, AKS), creates a cloud load balancer
- **Local Development**: On Minikube, use `minikube service nodejs-guestbook-frontend` to get the URL
- **Cost**: Cloud load balancers have associated costs

**Access Pattern**:
```
Internet → LoadBalancer IP → Frontend Service → Frontend Pods
```

#### Backend Service (Internal Only)

**File**: `src/backend/kubernetes-manifests/guestbook-backend.service.yaml`

```yaml
spec:
  type: ClusterIP  # Internal only
  selector:
    app: nodejs-guestbook
    tier: backend
  ports:
  - port: 8080
    targetPort: http-server
```

**Characteristics**:
- **Internal only**: Only accessible from within the Kubernetes cluster
- **Secure**: Not exposed to the internet
- **DNS accessible**: Can be reached via `nodejs-guestbook-backend:8080` from any pod
- **No external access**: Cannot be accessed directly from outside the cluster

**Access Pattern**:
```
Frontend Pod → Backend Service (ClusterIP) → Backend Pods
```

#### MongoDB Service (Internal Only)

**File**: `src/backend/kubernetes-manifests/mongo.service.yaml`

```yaml
spec:
  # No type specified = defaults to ClusterIP
  ports:
  - port: 27017
    targetPort: 27017
  selector:
    app: nodejs-guestbook
    tier: db
```

**Characteristics**:
- **Internal only**: Only accessible from within the cluster
- **Secure**: Database should never be exposed externally
- **DNS accessible**: Can be reached via `nodejs-guestbook-mongodb:27017` from backend pods
- **Best practice**: Databases should always be ClusterIP

**Access Pattern**:
```
Backend Pod → MongoDB Service (ClusterIP) → MongoDB Pod
```

### Service Communication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL ACCESS                          │
│                                                             │
│  Internet/Users                                             │
│       │                                                     │
│       │ HTTP/HTTPS                                          │
│       ▼                                                     │
│  ┌─────────────────────────────────────┐                    │
│  │  Frontend Service (LoadBalancer)    │                    │
│  │  External IP: <cloud-lb-ip>         │                    │
│  └──────────────┬──────────────────────┘                    │
│                 │                                           │
│                 │ ClusterIP (internal)                      │
│                 ▼                                           │
│  ┌─────────────────────────────────────┐                    │
│  │  Frontend Pod                       │                    │
│  └─────────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ HTTP Request
                          │ nodejs-guestbook-backend:8080
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    INTERNAL ACCESS                          │
│                                                             │
│  ┌─────────────────────────────────────┐                    │
│  │  Backend Service (ClusterIP)        │                    │
│  │  Internal IP: 10.x.x.x              │                    │
│  └──────────────┬──────────────────────┘                    │
│                 │                                           │
│                 │ ClusterIP (internal)                      │
│                 ▼                                           │
│  ┌─────────────────────────────────────┐                    │
│  │  Backend Pod                        │                    │
│  └─────────────────────────────────────┘                    │
│                 │                                           │
│                 │ MongoDB Connection                        │
│                 │ nodejs-guestbook-mongodb:27017            │
│                 ▼                                           │
│  ┌─────────────────────────────────────┐                    │
│  │  MongoDB Service (ClusterIP)        │                    │
│  │  Internal IP: 10.x.x.x              │                    │
│  └──────────────┬──────────────────────┘                    │
│                 │                                           │
│                 │ ClusterIP (internal)                      │
│                 ▼                                           │
│  ┌─────────────────────────────────────┐                    │
│  │  MongoDB Pod                        │                    │
│  └─────────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

### Security Best Practices

1. **Principle of Least Privilege**:
   - Frontend: LoadBalancer (needs external access)
   - Backend: ClusterIP (internal only, no external access needed)
   - Database: ClusterIP (internal only, never expose databases)

2. **Network Policies** (Optional but recommended: implemented in this project)
   - Restrict which pods can communicate with each other
   - Example: Only frontend pods can talk to backend pods
   - Example: Only backend pods can talk to MongoDB pods

3. **Ingress Controller** (Alternative to LoadBalancer: implemented in this project)
   - Use Ingress + Ingress Controller instead of LoadBalancer
   - Provides SSL/TLS termination
   - Path-based and host-based routing
   - More cost-effective (one load balancer for multiple services)

### Alternative: Using Ingress for External Access

Instead of LoadBalancer, you can use Ingress:

**1. Change Frontend Service to ClusterIP**:
```yaml
spec:
  type: ClusterIP  # Changed from LoadBalancer
```

**2. Create an Ingress resource**:
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: guestbook-ingress
spec:
  rules:
  - host: guestbook.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: nodejs-guestbook-frontend
            port:
              number: 80
```

**Benefits**:
- Single load balancer for multiple services
- SSL/TLS termination
- Path-based routing
- Lower cost

---

## Summary

| Aspect                | Current State          | what is done                      |
|-----------------------|------------------------|--------------------------------- -|
| **Service Discovery** |  Using Kubernetes DNS  | Keep as-is                        |
| **Health Checks**     |  Not configured        | Add liveness and readiness probes |
| **Data Persistence**  |  No persistence        | Add PVC or use StatefulSet        |
| **Service Exposure**  |  Properly configured   | Consider Ingress for production   |

---

## Next Steps to be cover:

1. **Add health checks** to all deployments
2. **Set up persistent storage** for MongoDB
3. **Consider using Ingress** instead of LoadBalancer for production
4. **Add Network Policies** for enhanced security
5. **Implement backup strategy** for MongoDB data

