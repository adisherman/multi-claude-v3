# CI/CD Pipeline Guide

This document describes the continuous integration and deployment pipeline for the Multi-Claude 3.0 system.

## Overview

The CI/CD pipeline is implemented using GitHub Actions and consists of four main workflows:

1. **CI Pipeline** - Automated testing and building
2. **Docker Build** - Container image building and publishing
3. **Code Quality** - Security scanning and code analysis
4. **Deploy** - Automated deployment to staging/production

## Workflows

### 1. CI Pipeline (`ci.yml`)

**Trigger**: Push to `main`/`develop` branches, Pull Requests

**Jobs**:
- **Backend CI**
  - Lint code with ESLint
  - Type check with TypeScript
  - Build backend
  - Run tests with PostgreSQL database
  - Upload build artifacts

- **Dashboard CI**
  - Lint code with ESLint
  - Type check with TypeScript
  - Build dashboard with Vite
  - Upload build artifacts

- **Database CI**
  - Validate PostgreSQL schema
  - Apply migrations
  - Verify tables and seed data

- **Integration Tests**
  - Start backend with PostgreSQL
  - Test health endpoints
  - Test event submission
  - Test metrics endpoints

- **Security Scan**
  - Run npm audit on dependencies
  - Scan for secrets with TruffleHog

- **Status Check**
  - Aggregate all job results
  - Fail if any critical job fails

**Required Secrets**: None (uses PostgreSQL service container)

**Artifacts**:
- `backend-dist` - Compiled backend code (7 days retention)
- `dashboard-dist` - Built dashboard static files (7 days retention)

### 2. Docker Build (`docker-build.yml`)

**Trigger**:
- Push to `main` branch
- Git tags matching `v*.*.*`
- Pull requests (build only, no push)
- Manual workflow dispatch

**Jobs**:
- **Build Backend**
  - Multi-platform build (linux/amd64, linux/arm64)
  - Push to GitHub Container Registry
  - Tag with branch, SHA, semantic version, and `latest`
  - Generate build provenance attestation

- **Build Dashboard**
  - Multi-platform build (linux/amd64, linux/arm64)
  - Push to GitHub Container Registry
  - Tag with branch, SHA, semantic version, and `latest`
  - Generate build provenance attestation

- **Test Docker Compose** (PR only)
  - Start all services with docker-compose
  - Wait for health checks
  - Test backend and dashboard accessibility
  - View logs on failure

- **Scan Images**
  - Run Trivy security scanner
  - Upload results to GitHub Security tab

- **Update README**
  - Create deployment info file
  - Commit image tags and build timestamp

**Required Secrets**:
- `GITHUB_TOKEN` (automatically provided)

**Published Images**:
- `ghcr.io/adisherman/multi-claude-v3/backend:latest`
- `ghcr.io/adisherman/multi-claude-v3/dashboard:latest`

**Image Tags**:
- `latest` - Most recent build from main branch
- `main` - Latest build from main branch
- `v1.0.0` - Semantic version tags
- `v1.0` - Major.minor version
- `v1` - Major version
- `main-abc123` - Branch with SHA prefix

### 3. Code Quality (`code-quality.yml`)

**Trigger**:
- Push to `main`/`develop` branches
- Pull requests
- Weekly schedule (Mondays at 00:00 UTC)

**Jobs**:
- **CodeQL Analysis**
  - Scan JavaScript and TypeScript code
  - Detect security vulnerabilities
  - Upload results to GitHub Security

- **Dependency Review** (PR only)
  - Review dependency changes
  - Fail on moderate+ severity vulnerabilities

- **Lint Commits** (PR only)
  - Validate commit message format
  - Enforce conventional commits

- **Check Dependencies**
  - List outdated dependencies
  - Report available updates

- **License Check**
  - Verify dependency licenses
  - Generate license summary

- **Code Coverage**
  - Run tests with coverage
  - Upload to Codecov

- **Performance Check**
  - Measure bundle size
  - Comment on PRs with size info

- **Documentation Check**
  - Verify README exists
  - Check markdown links
  - Validate documentation structure

- **Quality Gate**
  - Aggregate all quality checks
  - Fail if critical issues found

**Required Secrets**: None

**Schedule**: Weekly security scans

### 4. Deploy (`deploy.yml`)

**Trigger**:
- Release published
- Manual workflow dispatch

**Inputs** (manual trigger):
- `environment` - staging or production
- `version` - Docker image tag to deploy

**Jobs**:
- **Deploy Staging**
  - Deploy latest or specified version
  - Run smoke tests
  - Notify on completion

- **Deploy Production**
  - Create deployment backup
  - Deploy specified version
  - Run comprehensive health checks
  - Run smoke tests
  - Notify on completion

- **Rollback** (on failure)
  - Restore from backup
  - Deploy previous version
  - Verify rollback

- **Post-Deployment**
  - Update monitoring dashboards
  - Run database migrations
  - Clear application caches
  - Create deployment record

**Required Secrets**:
- SSH credentials (for server access)
- Database credentials (for migrations)

**Environments**:
- `staging` - https://staging.multi-claude.example.com
- `production` - https://multi-claude.example.com

## Setup Instructions

### 1. Enable GitHub Actions

GitHub Actions are automatically enabled for the repository.

### 2. Configure Secrets

Go to **Settings → Secrets and variables → Actions** and add:

**For Docker Registry**:
- `GITHUB_TOKEN` - Automatically provided, no action needed

**For Deployment** (when ready):
- `DEPLOY_SSH_KEY` - SSH private key for server access
- `DEPLOY_HOST` - Server hostname
- `DEPLOY_USER` - SSH username
- `DB_PASSWORD` - Production database password

### 3. Configure Environments

Go to **Settings → Environments** and create:

**Staging Environment**:
- Name: `staging`
- URL: Your staging URL
- Protection rules: Optional

**Production Environment**:
- Name: `production`
- URL: Your production URL
- Protection rules:
  - ✅ Required reviewers (at least 1)
  - ✅ Wait timer (optional)

### 4. Enable Docker Image Publishing

The workflows automatically push to GitHub Container Registry (ghcr.io).

To pull images:
```bash
# Login to ghcr.io
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Pull images
docker pull ghcr.io/adisherman/multi-claude-v3/backend:latest
docker pull ghcr.io/adisherman/multi-claude-v3/dashboard:latest
```

### 5. Branch Protection Rules

Recommended branch protection for `main`:

- ✅ Require pull request reviews (1+)
- ✅ Require status checks to pass:
  - Backend CI
  - Dashboard CI
  - Database CI
  - Integration Tests
  - CodeQL Analysis
- ✅ Require branches to be up to date
- ✅ Require conversation resolution
- ✅ Do not allow bypassing

## Usage

### Running CI on Pull Requests

CI automatically runs on all PRs. Check the **Checks** tab to see results.

### Building Docker Images

**Automatic**: Push to `main` branch
```bash
git push origin main
```

**Manual**: Trigger workflow
```bash
gh workflow run docker-build.yml
```

**Release**: Create a git tag
```bash
git tag v1.0.0
git push origin v1.0.0
```

### Deploying

**Deploy to Staging**:
```bash
gh workflow run deploy.yml -f environment=staging -f version=latest
```

**Deploy to Production**:
```bash
gh workflow run deploy.yml -f environment=production -f version=v1.0.0
```

**Deploy from UI**:
1. Go to **Actions** tab
2. Select **Deploy** workflow
3. Click **Run workflow**
4. Choose environment and version
5. Click **Run workflow**

## Monitoring

### GitHub Actions Dashboard

View all workflow runs: https://github.com/adisherman/multi-claude-v3/actions

### Workflow Status

Check badges on README for current status:
- [![CI](https://github.com/adisherman/multi-claude-v3/actions/workflows/ci.yml/badge.svg)](https://github.com/adisherman/multi-claude-v3/actions/workflows/ci.yml)
- [![Docker](https://github.com/adisherman/multi-claude-v3/actions/workflows/docker-build.yml/badge.svg)](https://github.com/adisherman/multi-claude-v3/actions/workflows/docker-build.yml)

### Security Alerts

- **Code Scanning**: https://github.com/adisherman/multi-claude-v3/security/code-scanning
- **Dependabot**: https://github.com/adisherman/multi-claude-v3/security/dependabot

## Troubleshooting

### CI Failing

**Backend build fails**:
1. Check TypeScript errors: `npm run build`
2. Check linting: `npm run lint`
3. Verify database connection in tests

**Dashboard build fails**:
1. Check TypeScript errors: `npm run build`
2. Check for missing dependencies
3. Verify Vite configuration

**Integration tests fail**:
1. Check backend logs in workflow
2. Verify database schema is current
3. Check PostgreSQL service health

### Docker Build Failing

**Build errors**:
1. Test build locally: `docker build -t test ./backend`
2. Check Dockerfile syntax
3. Verify all files are accessible (not in .dockerignore)

**Push failures**:
1. Verify GITHUB_TOKEN permissions
2. Check package visibility (should be public or organization accessible)

**Multi-platform build issues**:
1. Test single platform first
2. Check buildx setup
3. Verify emulation support

### Deployment Failing

**SSH connection issues**:
1. Verify DEPLOY_SSH_KEY secret
2. Check server firewall rules
3. Verify SSH key permissions

**Health check failures**:
1. Check service logs on server
2. Verify database connectivity
3. Check environment variables

**Rollback needed**:
1. Trigger rollback workflow manually
2. Or deploy previous version:
   ```bash
   gh workflow run deploy.yml -f environment=production -f version=v1.0.0
   ```

## Best Practices

### Commits

- Use conventional commit format: `feat:`, `fix:`, `docs:`, etc.
- Keep commits focused and atomic
- Write descriptive commit messages

### Pull Requests

- Keep PRs small and focused
- Write clear PR descriptions
- Link related issues
- Wait for all checks to pass
- Get review approval before merging

### Versioning

- Follow semantic versioning (MAJOR.MINOR.PATCH)
- Create git tags for releases
- Update CHANGELOG.md
- Use pre-release tags for beta versions (v1.0.0-beta.1)

### Security

- Never commit secrets or credentials
- Review Dependabot alerts regularly
- Update dependencies monthly
- Monitor CodeQL scan results

### Deployment

- Always deploy to staging first
- Run smoke tests after deployment
- Monitor error rates post-deployment
- Keep rollback plan ready
- Document all production changes

## Performance Optimization

### Caching

Workflows use caching to speed up builds:
- npm dependencies cached by package-lock.json
- Docker layers cached with GitHub Actions cache
- Build artifacts reused across jobs

### Parallelization

Jobs run in parallel when possible:
- Backend and Dashboard CI run concurrently
- Multi-platform Docker builds use buildx
- Multiple quality checks run in parallel

### Resource Limits

GitHub Actions free tier limits:
- 2000 minutes/month for private repos
- Unlimited for public repos
- 500MB artifact storage

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Conventional Commits](https://www.conventionalcommits.org/)

## Support

For CI/CD issues:
1. Check workflow logs
2. Review this documentation
3. Open an issue with workflow run link
4. Contact DevOps team

---

**Last Updated**: 2025-12-16
**Maintained By**: DevOps Team
