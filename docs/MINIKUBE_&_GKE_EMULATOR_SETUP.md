# Deploying Guestbook with GKE Emulator (Local Kubernetes)

This guide will help you deploy the Guestbook application locally using a GKE emulator (local Kubernetes cluster) with Cloud Code.

## Prerequisites

- **Cloud Code Extension**: Installed in VS Code
- **Docker**: Installed and running (you have Docker v28.3.2)
- **kubectl**: Installed (you have v1.32.2)
- **Local Kubernetes Cluster**: Minikube or Docker Desktop Kubernetes

## Option 1: Using Minikube (Recommended)

### Step 1: Install Minikube

If you don't have Minikube installed, install it:

**macOS (using Homebrew):**
```bash
brew install minikube
```

**Or download directly:**
```bash
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-darwin-amd64
sudo install minikube-darwin-amd64 /usr/local/bin/minikube
```

### Step 2: Start Minikube Cluster

```bash
# Start minikube with Docker driver
minikube start --driver=docker

# Verify cluster is running
minikube status

# Set minikube as the current kubectl context
kubectl config use-context minikube
```

### Step 3: Configure Docker to Use Minikube's Docker Environment

```bash
# This allows Docker to build images that minikube can use
eval $(minikube docker-env)
```

**Note**: You'll need to run `eval $(minikube docker-env)` in each new terminal session, or add it to your shell profile.

## Option 2: Using Docker Desktop Kubernetes

### Step 1: Enable Kubernetes in Docker Desktop

1. Open Docker Desktop
2. Go to **Settings** → **Kubernetes**
3. Check **Enable Kubernetes**
4. Click **Apply & Restart**

### Step 2: Verify Kubernetes Context

```bash
# Check available contexts
kubectl config get-contexts

# Switch to docker-desktop context if needed
kubectl config use-context docker-desktop
```

## Deploying with Cloud Code

### Step 1: Set Up Cluster in Cloud Code

1. **Open the Kubernetes Explorer**:
   - Click on the **Cloud Code** icon in the left sidebar
   - Navigate to the **Kubernetes** section

2. **Add Local Cluster**:
   - Click the **+** button in the Clusters explorer
   - If using Minikube: Select **Minikube** from the list
   - If using Docker Desktop: The cluster should appear automatically as `docker-desktop`
   - Select your local cluster and it will be set as the active context

### Step 2: Verify Cluster Connection

In VS Code terminal, verify:
```bash
kubectl get nodes
```

You should see your local cluster node(s).

### Step 3: Deploy the Application

1. **Using Cloud Code UI**:
   - Click on the **Cloud Code** status bar at the bottom of VS Code
   - Select **"Run on Kubernetes"**
   - Confirm the cluster context (should be your local cluster)
   - Cloud Code will build the Docker images and deploy to your local cluster

2. **Using Debug/Run Configuration**:
   - Press `F5` or go to **Run and Debug** (Ctrl+Shift+D / Cmd+Shift+D)
   - Select **"Run on Kubernetes"** from the dropdown
   - Click the play button

### Step 4: Monitor Deployment

- Watch the build progress in the **OUTPUT** window (select "Cloud Code" from the dropdown)
- Once deployed, you'll see **Port Forward URLs** in the Development Sessions explorer
- Click the **Open Window** icon next to the frontend service URL to view your app

### Step 5: Access the Application

The frontend service will be available at:
- **Local URL**: `http://localhost:4503` (as configured in frontend skaffold.yaml)
- Or use the port-forward URL shown in Cloud Code

## Troubleshooting

### Issue: Images not found in cluster

**Solution**: Ensure Docker is using the correct environment:
```bash
# For Minikube
eval $(minikube docker-env)
docker images  # Verify images are being built
```

### Issue: Cannot connect to cluster

**Solution**: Verify cluster is running:
```bash
# For Minikube
minikube status
minikube start  # If not running

# For Docker Desktop
# Check Docker Desktop → Kubernetes is enabled and running
```

### Issue: Port forwarding not working

**Solution**: Check if ports are already in use:
```bash
lsof -i :4503  # Check if port 4503 is available
```

### View Logs

```bash
# View all pods
kubectl get pods

# View logs for a specific pod
kubectl logs <pod-name>

# View logs for frontend
kubectl logs -l app=nodejs-guestbook,tier=frontend

# View logs for backend
kubectl logs -l app=nodejs-guestbook,tier=backend
```

## Stopping the Application

1. Click the **stop icon** in the Debug Toolbar
2. Or press `Shift+F5` to stop the debug session

**Note**: With `cleanUp: true` in launch.json, stopping will clean up all deployed resources.

## Clean Up

### Stop Minikube (if using)
```bash
minikube stop
minikube delete  # To completely remove the cluster
```

### Remove Docker Images (optional)
```bash
docker rmi nodejs-guestbook-frontend nodejs-guestbook-backend
```

## Next Steps

- Try [debugging your app](https://cloud.google.com/code/docs/vscode/debug) using Cloud Code
- Learn how to [edit YAML files](https://cloud.google.com/code/docs/vscode/yaml-editing) to deploy your Kubernetes app
- Explore the [Kubernetes Engine Explorer](https://cloud.google.com/code/docs/vscode/k8s-overview)

## Configuration Files

The project is already configured with:
- `.vscode/launch.json` - Cloud Code run configurations
- `skaffold.yaml` - Root Skaffold configuration with modules
- `src/frontend/skaffold.yaml` - Frontend module configuration
- `src/backend/skaffold.yaml` - Backend module configuration

All configurations use local Docker builds, which is perfect for local development.

