# EC2 Environment Variables Setup Guide

## Where to Set Environment Variables on EC2

### Option 1: Using .env file (Recommended)

1. **SSH into your EC2 instance:**
   ```bash
   ssh -i your-key.pem ec2-user@your-ec2-ip
   ```

2. **Navigate to the backend directory:**
   ```bash
   cd ~/lingo-dev/backend
   ```

3. **Create .env file:**
   ```bash
   cp .env.example .env
   nano .env  # or use vim, vi, or your preferred editor
   ```

4. **Fill in all the required values in the .env file**

5. **The docker-compose.production.yml will automatically read from .env file**

### Option 2: Export in Shell (Temporary)

If you want to set them temporarily in your shell session:

```bash
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
# ... etc
```

Then run docker-compose:
```bash
docker-compose -f docker-compose.production.yml up -d
```

**Note:** This is temporary and will be lost when you close the terminal.

### Option 3: System-wide Environment Variables

Add to `/etc/environment` (requires sudo):

```bash
sudo nano /etc/environment
```

Add your variables:
```
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
...
```

Then reload:
```bash
source /etc/environment
```

## File Location on EC2

The `.env` file should be located at:
```
~/lingo-dev/backend/.env
```

Or if you cloned the repo to a different location:
```
/path/to/your/repo/backend/.env
```

## How Docker Compose Reads Environment Variables

The `docker-compose.production.yml` file uses:
- `env_file: - .env` - Reads all variables from .env file
- `${VARIABLE_NAME}` - Substitutes values from environment or .env file
- `${VARIABLE_NAME:-default}` - Uses default value if variable not set

## Required Environment Variables

See `.env.example` for the complete list. Minimum required:

1. **DOCKERHUB_USERNAME** - Your Docker Hub username
2. **AWS_ACCESS_KEY_ID** - AWS access key
3. **AWS_SECRET_ACCESS_KEY** - AWS secret key
4. **HUGGINGFACE_API_KEY** - HuggingFace API key
5. **LINGO_DOT_DEV_API_KEY** - Lingo.dev API key
6. **NEXTAUTH_SECRET** - NextAuth secret
7. **GOOGLE_CLIENT_ID** - Google OAuth client ID
8. **GOOGLE_CLIENT_SECRET** - Google OAuth client secret
9. **DATABASE_URL** - PostgreSQL connection string (if using PostgreSQL)
10. **CORS_ORIGIN** - Your Vercel frontend URL

## Security Best Practices

1. **Never commit .env file to git** (it should be in .gitignore)
2. **Use strong, unique values** for all secrets
3. **Restrict file permissions:**
   ```bash
   chmod 600 .env  # Only owner can read/write
   ```
4. **Use AWS Secrets Manager or Parameter Store** for production (optional but recommended)

## Verifying Environment Variables

After setting up, verify they're being read:

```bash
# Check if docker-compose can see the variables
docker-compose -f docker-compose.production.yml config

# Check inside running container
docker exec lingo-backend env | grep AWS_ACCESS_KEY_ID
```

## Updating Environment Variables

1. Edit `.env` file
2. Restart the backend service:
   ```bash
   docker-compose -f docker-compose.production.yml restart backend
   ```

Or rebuild and restart:
```bash
docker-compose -f docker-compose.production.yml up -d --force-recreate backend
```
