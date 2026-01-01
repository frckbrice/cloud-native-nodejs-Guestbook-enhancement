# Guestbook Application - Production-Ready Kubernetes Deployment

A full-stack guestbook application demonstrating production-ready Kubernetes deployment patterns, persistent storage, and modern DevOps practices. Built with Node.js, Express, MongoDB, and deployed on Kubernetes with comprehensive observability and security features.

## Overview

This project showcases a complete three-tier application architecture deployed on Kubernetes:
- **Frontend**: Node.js/Express web server with Pug templates
- **Backend**: RESTful API with JWT authentication, WebSocket support, and image upload handling
- **Database**: MongoDB with persistent storage using StatefulSets

### Key Features

- **User Authentication**: JWT-based authentication with bcrypt password hashing
- **Image Uploads**: Support for JPEG, PNG, GIF, WebP with validation and size limits
- **Real-time Updates**: WebSocket integration using Socket.IO
- **Persistent Storage**: StatefulSets with PVCs for database and file storage
- **Production Infrastructure**: Health checks, Ingress, Network Policies, monitoring
- **Mobile-Responsive**: Modern, responsive UI design

## Technology Stack

**Backend**: Node.js, Express, MongoDB, Mongoose, JWT, Socket.IO, Multer  
**Frontend**: Node.js, Express, Pug, Axios, Socket.IO Client  
**Infrastructure**: Kubernetes, Docker, Skaffold, MongoDB StatefulSet  
**DevOps**: GitHub Actions, Health Checks, Metrics, Logging

## Architecture

**Three-Tier Architecture with Persistent Storage**

- **Frontend**: Stateless web UI (Deployment) exposed via Ingress
- **Backend**: Stateful API service (StatefulSet) with persistent image storage (5Gi PVC)
- **MongoDB**: Stateful database (StatefulSet) with persistent data storage (10Gi PVC)

**Key Design Decisions**:
- StatefulSets for stateful components (database and file storage)
- PersistentVolumeClaims for data persistence across pod restarts
- Network Policies for security and traffic control
- Health checks (liveness/readiness probes) for reliability

For comprehensive deployment and architecture details, see [PROJECT_K8_DEPLOYMENT_GUIDE.md](./docs/PROJECT_K8_DEPLOYMENT_GUIDE.md).

## Quick Start

### Prerequisites
- Kubernetes cluster (Minikube, GKE, EKS, or Docker Desktop)
- kubectl configured
- Docker installed

### Deploy to Kubernetes

```bash
# Deploy MongoDB StatefulSet
kubectl apply -f src/backend/kubernetes-manifests/mongo.statefulset.yaml
kubectl apply -f src/backend/kubernetes-manifests/mongo.service.yaml

# Deploy Backend StatefulSet
kubectl apply -f src/backend/kubernetes-manifests/guestbook-backend.statefulset.yaml
kubectl apply -f src/backend/kubernetes-manifests/guestbook-backend.service.yaml

# Deploy Frontend
kubectl apply -f src/frontend/kubernetes-manifests/

# Verify deployment
kubectl get all -l app=nodejs-guestbook
```

### Using Cloud Code (VS Code/IntelliJ)

1. Open project in VS Code or IntelliJ with Cloud Code extension
2. Click "Run on Kubernetes" from the debug panel
3. Select your cluster (minikube for local development)
4. Access the application via the provided URL

For detailed deployment instructions, see [PROJECT_K8_DEPLOYMENT_GUIDE.md](./docs/PROJECT_K8_DEPLOYMENT_GUIDE.md) and [MINIKUBE_&_GKE_EMULATOR_SETUP.md](./docs/MINIKUBE_&_GKE_EMULATOR_SETUP.md).

## Documentation

- **[Kubernetes Deployment Guide](./docs/PROJECT_K8_DEPLOYMENT_GUIDE.md)**: Comprehensive guide to deploying and managing the Kubernetes cluster, including StatefulSet configuration and persistent storage
- **[Project Overview](./docs/PROJECT_OVERVIEW.md)**: Detailed project architecture, objectives, and technical decisions
- **[Kubernetes Architecture](./docs/PROJECT_K8_ARCHITECTURE.md)**: Deep dive into Kubernetes concepts, service discovery, health checks, and networking
- **[Minikube & GKE Emulator Setup](./docs/MINIKUBE_&_GKE_EMULATOR_SETUP.md)**: Setup instructions for local development environments
- **[Troubleshooting](./docs/TROUBLESHOOTING.md)**: Common issues and solutions

## Key Highlights

**Production-Ready Features**: Persistent storage with StatefulSets and PVCs, health monitoring with liveness and readiness probes, security via Network Policies and JWT authentication, observability with metrics endpoints and comprehensive logging, and scalability designed for horizontal scaling.

**Technical Achievements**: Migration from ephemeral to persistent storage for both MongoDB and Backend, implementation of StatefulSets for stateful applications, automatic PVC creation via volumeClaimTemplates, and establishment of production-grade deployment patterns.

## Additional Resources

For details on using this sample as a template in Cloud Code, see the documentation for [Cloud Code for VS Code](https://cloud.google.com/code/docs/vscode/quickstart-local-dev) or [Cloud Code for IntelliJ](https://cloud.google.com/code/docs/intellij/quickstart-k8s).

## License

This project is based on the Google Cloud Kubernetes Guestbook sample and has been enhanced with production-ready features. But there is still work to do.
