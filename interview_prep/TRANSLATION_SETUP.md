# Translation Integration with Lingo.dev

Your project is set up to use **lingo.dev** for automated translations with **Ollama** running locally!

## Current Setup

- **Provider**: Ollama (running on `localhost:11434`)
- **Model**: llama3.2
- **Source Language**: English (`en`)
- **Target Languages**: Spanish (`es`), French (`fr`), Hindi (`hi`), German (`de`)

## ⚠️ Important: CI/CD Limitation

**GitHub Actions cannot access your local Ollama instance!**

The CI/CD workflow (`.github/workflows/translate.yml`) is configured but **will skip translations** when using Ollama provider because:
- GitHub Actions runs on GitHub's cloud servers
- They cannot access `localhost:11434` on your machine
- The workflow will detect Ollama and skip automatically

## Solutions

### Option 1: Local Translation Only (Recommended for Ollama)

Run translations manually on your local machine:

```bash
# Make sure Ollama is running
ollama serve

# In another terminal, run translation
cd /home/strawhat/Documents/hackathon/lingo_dev
npx lingo.dev@latest translate
```

### Option 2: Self-Hosted GitHub Actions Runner

If you want CI/CD to work with Ollama:

1. **Set up a self-hosted runner** on your machine:
   ```bash
   # Follow: https://docs.github.com/en/actions/hosting-your-own-runners
   ```

2. **Use the self-hosted workflow**:
   - Copy `.github/workflows/translate-self-hosted.yml.example`
   - Rename to `translate-self-hosted.yml`
   - The workflow will run on your machine and can access Ollama

### Option 3: Hybrid Approach

Use different providers for different environments:

- **Local Development**: Ollama (free, private)
- **CI/CD**: OpenAI or another cloud provider

To do this, you'd need to:
1. Create `i18n.local.json` with Ollama config
2. Create `i18n.ci.json` with OpenAI config
3. Use different configs in different environments

## Workflow

1. **Add new translations** to `frontend/locales/en.json`:
   ```json
   {
     "common": {
       "newKey": "New translation text"
     }
   }
   ```

2. **Run translation locally**:
   ```bash
   # Ensure Ollama is running
   ollama serve
   
   # Run translation
   npx lingo.dev@latest translate
   ```

3. **Commit the translated files** to your repository

## Files

- `i18n.json` - Lingo.dev configuration (Ollama provider)
- `frontend/locales/en.json` - Source language (English)
- `frontend/locales/es.json` - Spanish translations
- `frontend/locales/fr.json` - French translations
- `frontend/locales/hi.json` - Hindi translations
- `frontend/locales/de.json` - German translations

## Notes

- Always edit `en.json` as the source of truth
- Translations are generated using Ollama (llama3.2 model)
- Review translations before committing
- The frontend uses `next-intl` to load these translations at runtime
- CI/CD will skip translations when Ollama provider is detected
