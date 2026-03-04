# EC2 Deployment Guide

## GitHub Actions Workflow

The workflow automatically:
1. **Builds** the Docker image when code is pushed to `main` branch
2. **Pushes** the image to Docker Hub
3. **Deploys** to EC2 by SSH'ing into the server and running docker-compose

## Setup Steps

### 1. GitHub Secrets Configuration

Add these secrets in your GitHub repository settings (Settings → Secrets and variables → Actions):

```
DOCKERHUB_USERNAME=your-dockerhub-username
DOCKERHUB_TOKEN=your-dockerhub-access-token
EC2_HOST=your-ec2-ip-or-domain
EC2_USER=ec2-user  # or ubuntu, depending on your AMI
EC2_SSH_KEY=your-private-ssh-key-content
```

**To get Docker Hub token:**
- Go to Docker Hub → Account Settings → Security
- Create a new access token

**To get EC2 SSH key:**
- Copy the content of your `.pem` file (the private key used to SSH into EC2)
- Paste it as `EC2_SSH_KEY` secret

### 2. EC2 Server Setup

SSH into your EC2 instance and run:

```bash
# Install Docker
sudo yum update -y
sudo yum install docker -y
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Clone repository (if not already done)
cd ~
git clone https://github.com/your-username/lingo_dev.git
cd lingo-dev/backend

# Create .env file
cp .env.example .env
nano .env  # Fill in your environment variables

# Login to Docker Hub
docker login -u $DOCKERHUB_USERNAME -p $DOCKERHUB_TOKEN
```

### 3. First Deployment

On EC2, run:

```bash
cd ~/lingo-dev/backend
docker-compose -f docker-compose.production.yml pull
docker-compose -f docker-compose.production.yml up -d
```

### 4. Automatic Deployment

After setup, every push to `main` branch will:
1. Build and push Docker image to Docker Hub
2. SSH into EC2
3. Pull latest image
4. Restart services with docker-compose

## Manual Deployment

If you need to deploy manually:

```bash
# SSH into EC2
ssh -i your-key.pem ec2-user@your-ec2-ip

# Navigate to backend directory
cd ~/lingo-dev/backend

# Pull latest code (if using git)
git pull origin main

# Pull latest Docker image
docker-compose -f docker-compose.production.yml pull

# Restart services
docker-compose -f docker-compose.production.yml up -d

# Check status
docker-compose -f docker-compose.production.yml ps
docker-compose -f docker-compose.production.yml logs -f backend
```

## Troubleshooting

### Check logs
```bash
docker-compose -f docker-compose.production.yml logs -f
```

### Restart services
```bash
docker-compose -f docker-compose.production.yml restart
```

### Rebuild containers
```bash
docker-compose -f docker-compose.production.yml up -d --build
```

### Check Docker Hub image
```bash
docker pull your-username/lingo-dev-backend:latest
```
