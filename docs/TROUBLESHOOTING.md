# Viewing Service Logs

This guide explains how to view logs from the frontend and backend services to debug issues like registration failures.

## Quick Reference for Kubernetes

**Most Common Commands:**

```bash
# View backend logs (follow in real-time)
kubectl logs -l app=nodejs-guestbook,tier=backend -f

# View frontend logs (follow in real-time)
kubectl logs -l app=nodejs-guestbook,tier=frontend -f

# View last 100 lines of backend logs
kubectl logs -l app=nodejs-guestbook,tier=backend --tail=100

# View last 100 lines of frontend logs
kubectl logs -l app=nodejs-guestbook,tier=frontend --tail=100

# Check pod status first
kubectl get pods -l app=nodejs-guestbook
```

## Kubernetes Environment

If running in Kubernetes, use kubectl to view logs:

### View Backend Logs (Registration Debugging)

```bash
# Method 1: Using labels (recommended - works even if pod restarts)
kubectl logs -l app=nodejs-guestbook,tier=backend -f

# Method 2: Get pod name first, then view logs
kubectl get pods -l app=nodejs-guestbook,tier=backend
kubectl logs <pod-name> -f

# View last 200 lines (useful for seeing recent registration attempts)
kubectl logs -l app=nodejs-guestbook,tier=backend --tail=200

# View logs from previous container (if pod restarted)
kubectl logs <pod-name> --previous
```

### View Frontend Logs

```bash
# Follow frontend logs in real-time
kubectl logs -l app=nodejs-guestbook,tier=frontend -f

# View last 100 lines
kubectl logs -l app=nodejs-guestbook,tier=frontend --tail=100

# Get specific pod and view logs
kubectl get pods -l app=nodejs-guestbook,tier=frontend
kubectl logs <pod-name> -f
```

### View All Component Logs

```bash
# Backend (where registration happens)
kubectl logs -l app=nodejs-guestbook,tier=backend --tail=100

# Frontend (where registration form is submitted)
kubectl logs -l app=nodejs-guestbook,tier=frontend --tail=100

# MongoDB (database operations)
kubectl logs -l app=nodejs-guestbook,tier=db --tail=100
```

### Check Pod Status First

Before viewing logs, check if pods are running:

```bash
# List all pods
kubectl get pods -l app=nodejs-guestbook

# Get detailed pod information
kubectl get pods -l app=nodejs-guestbook -o wide

# Describe a specific pod (shows events, conditions, etc.)
kubectl describe pod <pod-name>
```

## What to Look For When Debugging Registration

When debugging registration failures, check both **frontend** and **backend** logs:

### In Backend Logs (Most Important):
1. **Request Received**: `"POST /auth/register request received"` - confirms request reached backend
2. **Validation Errors**: Look for `"Password validation failed"` or `"ValidationError"`
3. **User Existence Check**: `"Checking if user already exists"`
4. **User Creation**: `"Creating new user"` or `"Failed to create user"`
5. **Token Generation**: `"Generating authentication token"` or `"Failed to generate token"`
6. **Database Errors**: Look for `"MongoError"`, `"MongoServerError"`, or `"DatabaseError"`

### In Frontend Logs:
1. **Request Sent**: `"POST /register request received"`
2. **Error Response**: `"Registration failed"` with full error details including status code and response data

### Example Error Log from Backend


### Example Error Log from Frontend
```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "ERROR",
  "message": "Registration failed",
  "error": "Request failed with status code 400",
  "status": 400,
  "data": {
    "message": "Password validation failed",
    "details": ["Password must contain at least one uppercase letter"]
  }
}
```

## Tips for Debugging in Kubernetes

1. **Always check both frontend and backend logs** - errors can occur in either service
2. **Use `-f` flag to follow logs in real-time** - Open two terminals, one for frontend, one for backend
3. **Check pod status first** - Make sure pods are running: `kubectl get pods -l app=nodejs-guestbook`
4. **Look for ERROR level logs first** - These contain the most important information
5. **Filter logs with grep** - `kubectl logs -l app=nodejs-guestbook,tier=backend | grep "register"`
6. **Check previous logs if pod restarted** - `kubectl logs <pod-name> --previous`
7. **View pod events** - `kubectl describe pod <pod-name>` shows events and conditions

## Step-by-Step Debugging Process

1. **Check pod status:**
   ```bash
   kubectl get pods -l app=nodejs-guestbook
   ```

2. **Open two terminal windows:**
   - Terminal 1: `kubectl logs -l app=nodejs-guestbook,tier=backend -f`
   - Terminal 2: `kubectl logs -l app=nodejs-guestbook,tier=frontend -f`


## Common Issues and Log Patterns

- **"Cannot connect to server"** or **ECONNREFUSED**: Backend service not running or not reachable
- **"Password validation failed"**: Password doesn't meet requirements (8+ chars, uppercase, lowercase, number)
- **"User already exists"**: Username or email is already registered (check MongoDB or try different credentials)
- **"Token generation failed"**: Internal error, check backend logs for stack trace
- **"Database service unavailable"**: MongoDB connection issue - check MongoDB pod status
- **"Request failed" with ValidationError**: Check the `details` field in the error log for specific validation errors

## Local Development (Running Services Directly)

When running services locally (not in Kubernetes), logs appear in the terminal/console where each service is running.

### Viewing Logs

1. **Frontend Service Logs**: Check the terminal where you started the frontend service
2. **Backend Service Logs**: Check the terminal where you started the backend service

### Enabling More Detailed Logs

Set environment variables before starting services:

```bash
# Enable INFO level logs (shows more details)
export ENABLE_INFO_LOGS=true
export LOG_LEVEL=INFO

# Or for even more details
export LOG_LEVEL=DEBUG
export NODE_ENV=development
```

