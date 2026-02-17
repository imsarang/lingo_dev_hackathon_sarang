// Load environment variables FIRST before any other imports
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables - works for both ts-node and compiled code
const envPath = process.env.NODE_ENV === 'production' 
  ? path.resolve(__dirname, '../.env')
  : path.resolve(process.cwd(), '.env')

dotenv.config({ path: envPath })

// Verify required environment variables
const requiredEnvVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName])

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '))
  process.exit(1)
}

// Check embedding provider
const provider = process.env.EMBEDDING_PROVIDER || 'huggingface'
if (provider === 'huggingface') {
  const hfToken = process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN
  if (!hfToken) {
    console.error('❌ HUGGINGFACE_API_KEY or HF_TOKEN required for Hugging Face provider')
    console.error('Get free key: https://huggingface.co/settings/tokens')
    process.exit(1)
  }
}

console.log('✓ Environment variables loaded')
