#!/bin/bash

# Multi-Claude 3.0 Database Setup Script
# This script sets up the PostgreSQL database for the Multi-Claude system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DB_NAME=${DB_NAME:-"multi_claude_system"}
DB_USER=${DB_USER:-"postgres"}
DB_PASSWORD=${DB_PASSWORD:-"postgres"}
DB_HOST=${DB_HOST:-"localhost"}
DB_PORT=${DB_PORT:-"5432"}

# Functions
print_header() {
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

check_command() {
    if command -v $1 &> /dev/null; then
        print_success "$1 is installed"
        return 0
    else
        print_error "$1 is not installed"
        return 1
    fi
}

# Main script
print_header "Multi-Claude 3.0 Database Setup"

echo ""
print_info "Checking prerequisites..."

# Check for PostgreSQL or Docker
HAS_PSQL=false
HAS_DOCKER=false

if check_command psql; then
    HAS_PSQL=true
fi

if check_command docker; then
    HAS_DOCKER=true
fi

if [ "$HAS_PSQL" = false ] && [ "$HAS_DOCKER" = false ]; then
    print_error "Neither PostgreSQL (psql) nor Docker found!"
    echo ""
    echo "Please install one of the following:"
    echo "  1. PostgreSQL: https://www.postgresql.org/download/"
    echo "  2. Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

echo ""
print_info "Select setup method:"
echo "  1. Docker (recommended)"
echo "  2. Local PostgreSQL"
echo ""

read -p "Enter choice (1 or 2): " SETUP_METHOD

case $SETUP_METHOD in
    1)
        if [ "$HAS_DOCKER" = false ]; then
            print_error "Docker is not installed!"
            exit 1
        fi

        print_header "Setting up with Docker"

        # Check if docker-compose.yml exists
        if [ ! -f "docker-compose.yml" ]; then
            print_error "docker-compose.yml not found!"
            exit 1
        fi

        # Start containers
        print_info "Starting PostgreSQL container..."
        docker-compose up -d postgres

        # Wait for PostgreSQL to be ready
        print_info "Waiting for PostgreSQL to be ready..."
        sleep 5

        # Check if container is running
        if [ "$(docker ps -q -f name=multi-claude-postgres)" ]; then
            print_success "PostgreSQL container is running"
        else
            print_error "Failed to start PostgreSQL container"
            exit 1
        fi

        # Verify database
        print_info "Verifying database setup..."
        docker exec -i multi-claude-postgres psql -U postgres -d multi_claude_system -c "\dt" > /dev/null 2>&1

        if [ $? -eq 0 ]; then
            print_success "Database schema created successfully!"
        else
            print_error "Failed to create database schema"
            exit 1
        fi

        echo ""
        print_success "Docker setup complete!"
        echo ""
        print_info "Connection details:"
        echo "  Host: localhost"
        echo "  Port: 5432"
        echo "  Database: multi_claude_system"
        echo "  User: postgres"
        echo "  Password: postgres"
        echo ""
        print_info "To access pgAdmin (database UI):"
        echo "  1. Start pgAdmin: docker-compose up -d pgadmin"
        echo "  2. Open: http://localhost:5050"
        echo "  3. Login: admin@multiclaudesystem.local / admin"
        echo ""
        print_info "Useful commands:"
        echo "  - View logs: docker-compose logs -f postgres"
        echo "  - Stop database: docker-compose down"
        echo "  - Restart database: docker-compose restart postgres"
        echo "  - Connect to database: docker exec -it multi-claude-postgres psql -U postgres -d multi_claude_system"
        ;;

    2)
        if [ "$HAS_PSQL" = false ]; then
            print_error "PostgreSQL is not installed!"
            exit 1
        fi

        print_header "Setting up with Local PostgreSQL"

        # Check if PostgreSQL is running
        print_info "Checking PostgreSQL connection..."
        if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw template1; then
            print_success "PostgreSQL is running"
        else
            print_error "Cannot connect to PostgreSQL"
            echo "Please ensure PostgreSQL is running and credentials are correct"
            exit 1
        fi

        # Create database
        print_info "Creating database: $DB_NAME"
        psql -h $DB_HOST -p $DB_PORT -U $DB_USER -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
        psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "CREATE DATABASE $DB_NAME"

        if [ $? -eq 0 ]; then
            print_success "Database created: $DB_NAME"
        else
            print_error "Failed to create database"
            exit 1
        fi

        # Apply schema
        print_info "Applying database schema..."
        if [ -f "schema.sql" ]; then
            PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f schema.sql > /dev/null 2>&1
            if [ $? -eq 0 ]; then
                print_success "Schema applied successfully"
            else
                print_error "Failed to apply schema"
                exit 1
            fi
        else
            print_error "schema.sql not found!"
            exit 1
        fi

        # Verify installation
        print_info "Verifying installation..."
        TABLE_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'" 2>/dev/null)

        if [ "$TABLE_COUNT" -gt 0 ]; then
            print_success "Found $TABLE_COUNT tables"
        else
            print_error "No tables found - schema may not have been applied correctly"
            exit 1
        fi

        echo ""
        print_success "Local PostgreSQL setup complete!"
        echo ""
        print_info "Connection details:"
        echo "  Host: $DB_HOST"
        echo "  Port: $DB_PORT"
        echo "  Database: $DB_NAME"
        echo "  User: $DB_USER"
        echo ""
        print_info "Useful commands:"
        echo "  - Connect: psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
        echo "  - List tables: psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c '\dt'"
        echo "  - View schema: psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c '\d+ table_name'"
        ;;

    *)
        print_error "Invalid choice!"
        exit 1
        ;;
esac

# Create .env file
print_info "Creating .env file..."
cat > ../.env << EOF
# Database Configuration
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# Connection URL
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME
EOF

print_success ".env file created"

echo ""
print_header "Setup Complete!"
echo ""
print_success "Your Multi-Claude 3.0 database is ready to use!"
echo ""
print_info "Next steps:"
echo "  1. Review the schema: cat database/schema.sql"
echo "  2. Check sample queries: cat database/sample_queries.sql"
echo "  3. Read the documentation: cat database/README.md"
echo "  4. Start developing your Multi-Claude agents!"
echo ""
