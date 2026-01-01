#!/bin/bash

# Kubernetes Log Viewer Script
# This script provides easy access to view logs from Kubernetes deployments
# Usage: ./view-logs.sh [component] [options]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Function to get pod name
get_pod_name() {
    local app_label=$1
    local tier_label=$2
    kubectl get pods -l app=$app_label,tier=$tier_label -o jsonpath='{.items[0].metadata.name}' 2>/dev/null
}

# Function to view logs
view_logs() {
    local component=$1
    local follow=${2:-false}
    local tail=${3:-100}
    
    case $component in
        backend|back)
            print_info "Fetching backend pod..."
            POD_NAME=$(get_pod_name "nodejs-guestbook" "backend")
            if [ -z "$POD_NAME" ]; then
                print_error "Backend pod not found. Is the deployment running?"
                return 1
            fi
            print_success "Found pod: $POD_NAME"
            if [ "$follow" = true ]; then
                print_info "Following logs (Ctrl+C to stop)..."
                kubectl logs -f "$POD_NAME" --tail=$tail
            else
                kubectl logs "$POD_NAME" --tail=$tail
            fi
            ;;
        frontend|front)
            print_info "Fetching frontend pod..."
            POD_NAME=$(get_pod_name "nodejs-guestbook" "frontend")
            if [ -z "$POD_NAME" ]; then
                print_error "Frontend pod not found. Is the deployment running?"
                return 1
            fi
            print_success "Found pod: $POD_NAME"
            if [ "$follow" = true ]; then
                print_info "Following logs (Ctrl+C to stop)..."
                kubectl logs -f "$POD_NAME" --tail=$tail
            else
                kubectl logs "$POD_NAME" --tail=$tail
            fi
            ;;
        mongo|mongodb|db)
            print_info "Fetching MongoDB pod..."
            POD_NAME=$(get_pod_name "nodejs-guestbook" "db")
            if [ -z "$POD_NAME" ]; then
                print_error "MongoDB pod not found. Is the deployment running?"
                return 1
            fi
            print_success "Found pod: $POD_NAME"
            if [ "$follow" = true ]; then
                print_info "Following logs (Ctrl+C to stop)..."
                kubectl logs -f "$POD_NAME" --tail=$tail
            else
                kubectl logs "$POD_NAME" --tail=$tail
            fi
            ;;
        init|init-container)
            print_info "Fetching backend pod for init container logs..."
            POD_NAME=$(get_pod_name "nodejs-guestbook" "backend")
            if [ -z "$POD_NAME" ]; then
                print_error "Backend pod not found. Is the deployment running?"
                return 1
            fi
            print_success "Found pod: $POD_NAME"
            if [ "$follow" = true ]; then
                print_info "Following init container logs (Ctrl+C to stop)..."
                kubectl logs -f "$POD_NAME" -c init-db-ready --tail=$tail
            else
                kubectl logs "$POD_NAME" -c init-db-ready --tail=$tail
            fi
            ;;
        all)
            print_info "Viewing logs for all components..."
            echo ""
            print_warning "=== BACKEND LOGS ==="
            view_logs backend false $tail
            echo ""
            print_warning "=== FRONTEND LOGS ==="
            view_logs frontend false $tail
            echo ""
            print_warning "=== MONGODB LOGS ==="
            view_logs mongo false $tail
            ;;
        *)
            print_error "Unknown component: $component"
            show_usage
            return 1
            ;;
    esac
}

# Function to show pod status
show_status() {
    print_info "Current pod status:"
    echo ""
    kubectl get pods -l app=nodejs-guestbook -o wide
    echo ""
    print_info "Deployment status:"
    echo ""
    kubectl get deployments -l app=nodejs-guestbook
    echo ""
    print_info "Service status:"
    echo ""
    kubectl get services -l app=nodejs-guestbook
}

# Function to describe pod (useful for debugging)
describe_pod() {
    local component=$1
    
    case $component in
        backend|back)
            POD_NAME=$(get_pod_name "nodejs-guestbook" "backend")
            ;;
        frontend|front)
            POD_NAME=$(get_pod_name "nodejs-guestbook" "frontend")
            ;;
        mongo|mongodb|db)
            POD_NAME=$(get_pod_name "nodejs-guestbook" "db")
            ;;
        *)
            print_error "Unknown component: $component"
            return 1
            ;;
    esac
    
    if [ -z "$POD_NAME" ]; then
        print_error "Pod not found for component: $component"
        return 1
    fi
    
    print_info "Describing pod: $POD_NAME"
    kubectl describe pod "$POD_NAME"
}

# Function to show events
show_events() {
    print_info "Recent Kubernetes events:"
    kubectl get events --sort-by='.lastTimestamp' | tail -20
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [command] [component] [options]"
    echo ""
    echo "Commands:"
    echo "  logs [component]     View logs for a component"
    echo "  follow [component]   Follow logs in real-time"
    echo "  status               Show pod and deployment status"
    echo "  describe [component] Describe a pod (useful for debugging)"
    echo "  events               Show recent Kubernetes events"
    echo ""
    echo "Components:"
    echo "  backend, back        Backend service"
    echo "  frontend, front      Frontend service"
    echo "  mongo, mongodb, db   MongoDB database"
    echo "  init, init-container Init container logs"
    echo "  all                  All components"
    echo ""
    echo "Options:"
    echo "  --tail=N            Show last N lines (default: 100)"
    echo ""
    echo "Examples:"
    echo "  $0 logs backend              # View last 100 lines of backend logs"
    echo "  $0 follow backend           # Follow backend logs in real-time"
    echo "  $0 logs backend --tail=50   # View last 50 lines"
    echo "  $0 status                   # Show all pod statuses"
    echo "  $0 describe backend         # Describe backend pod"
    echo "  $0 events                   # Show recent events"
}

# Main script logic
COMMAND=${1:-logs}
COMPONENT=${2:-backend}
FOLLOW=false
TAIL=100

# Parse arguments
case $COMMAND in
    logs)
        # Parse --tail option
        for arg in "$@"; do
            if [[ $arg == --tail=* ]]; then
                TAIL=${arg#--tail=}
            fi
        done
        view_logs "$COMPONENT" false "$TAIL"
        ;;
    follow|f)
        COMPONENT=${2:-backend}
        # Parse --tail option
        for arg in "$@"; do
            if [[ $arg == --tail=* ]]; then
                TAIL=${arg#--tail=}
            fi
        done
        view_logs "$COMPONENT" true "$TAIL"
        ;;
    status|s)
        show_status
        ;;
    describe|d)
        if [ -z "$2" ]; then
            print_error "Please specify a component"
            show_usage
            exit 1
        fi
        describe_pod "$2"
        ;;
    events|e)
        show_events
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        # If first argument is a component name, assume logs command
        if [[ "$COMMAND" == "backend" ]] || [[ "$COMMAND" == "back" ]] || \
           [[ "$COMMAND" == "frontend" ]] || [[ "$COMMAND" == "front" ]] || \
           [[ "$COMMAND" == "mongo" ]] || [[ "$COMMAND" == "mongodb" ]] || \
           [[ "$COMMAND" == "db" ]] || [[ "$COMMAND" == "init" ]] || \
           [[ "$COMMAND" == "init-container" ]] || [[ "$COMMAND" == "all" ]]; then
            view_logs "$COMMAND" false "$TAIL"
        else
            print_error "Unknown command: $COMMAND"
            show_usage
            exit 1
        fi
        ;;
esac

