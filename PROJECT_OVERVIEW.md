# Guestbook Project - Overview & Objectives

## What Does This Project Do?

The **Guestbook** is a simple, full-stack web application that allows users to post messages and view a collection of guestbook entries. It's a classic "Hello World" style application for learning Kubernetes and cloud-native development.

### Core Functionality

1. **Post Messages**: Users can submit messages with their name through a web form
2. **View Messages**: All posted messages are displayed in reverse chronological order (newest first)
3. **Persistent Storage**: Messages are stored in a MongoDB database and persist across application restarts

### User Experience Flow

1. User visits the web application
2. User fills out a form with:
   - Their name
   - A message
3. User submits the form
4. The message is saved to the database
5. The page refreshes showing all messages, including the new one

---

## Technical Architecture

### Three-Tier Architecture

```
┌─────────────────┐
│   Frontend      │  Node.js/Express web server
│   (Port 8080)   │  - Renders HTML pages (Pug templates)
│                 │  - Handles user interactions
└────────┬────────┘
         │ HTTP/REST API calls
         ▼
┌─────────────────┐
│   Backend       │  Node.js/Express API server
│   (Port 8080)   │  - RESTful API endpoints
│                 │  - Business logic
└────────┬────────┘
         │ MongoDB queries
         ▼
┌─────────────────┐
│   MongoDB       │  Database server
│   (Port 27017)  │  - Stores messages persistently
└─────────────────┘
```

### Components

#### 1. **Frontend Service** (`src/frontend/`)
- **Technology**: Node.js, Express, Pug templating engine, Bootstrap CSS
- **Responsibilities**:
  - Serves the web UI
  - Handles form submissions
  - Communicates with backend API via HTTP
  - Renders message list with timestamps

#### 2. **Backend Service** (`src/backend/`)
- **Technology**: Node.js, Express, Mongoose (MongoDB ODM)
- **Responsibilities**:
  - RESTful API endpoints:
    - `GET /messages` - Retrieve all messages
    - `POST /messages` - Create a new message
  - Data validation
  - Database operations

#### 3. **MongoDB Database** (`src/backend/kubernetes-manifests/mongo.*.yaml`)
- **Technology**: MongoDB 4
- **Responsibilities**:
  - Persistent storage of messages
  - Message schema: `{ name, body, timestamp }`

### Kubernetes Deployment

- **Frontend Deployment**: Exposed via Service (LoadBalancer/NodePort)
- **Backend Deployment**: Internal service, accessible only within cluster
- **MongoDB Deployment**: Internal service, accessible only within cluster
- **Service Communication**: Services communicate using Kubernetes DNS names

---

## Project Objectives

### Primary Objectives

#### 1. **Educational/Demonstration Purpose**
   - **Learn Kubernetes**: Understand how to deploy multi-service applications on Kubernetes
   - **Learn Cloud Code**: Experience Google Cloud Code IDE extension for Kubernetes development
   - **Learn Skaffold**: Understand Skaffold modules and iterative development workflows
   - **Learn Microservices**: Understand service-to-service communication in a microservices architecture

#### 2. **Development Workflow Demonstration**
   - **Local Development**: Develop and test Kubernetes applications locally using Minikube or GKE emulator
   - **Iterative Development**: Use Skaffold's watch mode for hot-reloading during development
   - **Module-based Development**: Work with Skaffold modules to develop services independently
   - **Debugging**: Learn to debug Kubernetes applications using Cloud Code

#### 3. **Kubernetes Best Practices**
   - **Service Discovery**: Learn how services discover each other using Kubernetes DNS
   - **Environment Variables**: Use environment variables for configuration
   - **Health Checks**: Understand pod lifecycle and dependencies
   - **Resource Management**: Learn deployment, service, and pod concepts

#### 4. **Cloud-Native Development**
   - **Containerization**: Build and deploy containerized applications
   - **Orchestration**: Use Kubernetes for container orchestration
   - **Scalability**: Understand how to scale services independently
   - **Separation of Concerns**: Frontend, backend, and database as separate services

### Secondary Objectives

#### 5. **CI/CD Foundation**
   - **Build Automation**: Use Skaffold for automated builds
   - **Deployment Automation**: Automate deployment to Kubernetes clusters
   - **Cloud Build Integration**: Optional integration with Google Cloud Build

#### 6. **Production Readiness Concepts**
   - **Configuration Management**: Environment-based configuration
   - **Service Communication**: Internal vs external service exposure
   - **Data Persistence**: Database deployment patterns (though this example uses non-persistent storage)

---

## Use Cases & Scenarios

### Learning Scenarios

1. **Kubernetes Beginner**
   - First exposure to deploying multi-container applications
   - Understanding pods, services, and deployments
   - Learning kubectl commands

2. **Cloud Code User**
   - Learning Cloud Code IDE extension features
   - Understanding Skaffold integration
   - Local development workflow

3. **Microservices Learner**
   - Understanding service boundaries
   - Learning inter-service communication
   - Understanding data flow in distributed systems

### Development Scenarios

1. **Local Development**
   - Develop and test changes locally before deploying to production
   - Debug issues in a local Kubernetes environment
   - Iterate quickly on code changes

2. **Module Development**
   - Develop frontend independently from backend
   - Test individual services in isolation
   - Understand service dependencies

---

## Technical Stack Summary

| Component | Technology |
|-----------|-----------|
| **Frontend** | Node.js, Express, Pug, Bootstrap |
| **Backend** | Node.js, Express, Mongoose |
| **Database** | MongoDB 4 |
| **Containerization** | Docker |
| **Orchestration** | Kubernetes |
| **Build Tool** | Skaffold |
| **IDE Integration** | Google Cloud Code |

---

## Key Features Demonstrated

✅ **Multi-service Kubernetes application**  
✅ **Service-to-service communication**  
✅ **Database integration**  
✅ **RESTful API design**  
✅ **Web UI with form handling**  
✅ **Skaffold modules for modular development**  
✅ **Local development with Minikube/GKE emulator**  
✅ **Cloud Code IDE integration**  
✅ **Hot-reload development workflow**  
✅ **Environment-based configuration**  

---

## Limitations & Notes

⚠️ **Not Production-Ready**:
- MongoDB uses non-persistent storage (data lost on pod restart)
- No authentication or authorization
- No input sanitization for XSS protection
- No rate limiting
- Single replica deployments (no high availability)

💡 **This is a learning/demonstration project**, not intended for production use without significant enhancements.

---

## Learning Outcomes

After working with this project, you should understand:

1. How to structure a multi-service Kubernetes application
2. How services communicate in Kubernetes
3. How to use Skaffold for iterative development
4. How to use Cloud Code for Kubernetes development
5. Basic Kubernetes concepts (pods, services, deployments)
6. Local Kubernetes development workflows
7. Container image building and deployment

---

## Next Steps for Enhancement

If you want to extend this project, consider:

- Adding user authentication
- Implementing persistent MongoDB storage (StatefulSet)
- Adding message editing/deletion
- Implementing pagination for large message lists
- Adding image uploads
- Creating a mobile-responsive design
- Adding real-time updates (WebSockets)
- Implementing caching layers
- Adding monitoring and logging
- Setting up CI/CD pipelines

## NEWs

we consider adding also: 

- **Add health checks** to all deployments
- **Set up persistent storage** for MongoDB
- **Consider using Ingress** instead of LoadBalancer for production
- **Add Network Policies** for enhanced security
- **Implement backup strategy** for MongoDB data
