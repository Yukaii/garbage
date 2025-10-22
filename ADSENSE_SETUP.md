# AdSense Setup Guide

This project supports Google AdSense integration through environment variables.

## Local Development

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your AdSense credentials in `.env`:
   ```env
   VITE_ADSENSE_CLIENT_ID=ca-pub-1234567890123456
   VITE_ADSENSE_SLOT_ID=1234567890
   ```

3. Run the development server:
   ```bash
   bun run dev
   ```

## GitHub Actions / CI/CD Setup

To enable AdSense in your production builds, add the following secrets to your GitHub repository:

### Adding Secrets to GitHub

1. Go to your repository on GitHub
2. Click on **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the following secrets:

   - **Name:** `VITE_ADSENSE_CLIENT_ID`
     - **Value:** Your AdSense client ID (e.g., `ca-pub-1234567890123456`)

   - **Name:** `VITE_ADSENSE_SLOT_ID`
     - **Value:** Your AdSense slot ID (e.g., `1234567890`)

### Example GitHub Actions Workflow

Update your build workflow to include these environment variables:

```yaml
name: Build and Deploy

on:
  push:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Build
        env:
          VITE_ADSENSE_CLIENT_ID: ${{ secrets.VITE_ADSENSE_CLIENT_ID }}
          VITE_ADSENSE_SLOT_ID: ${{ secrets.VITE_ADSENSE_SLOT_ID }}
        run: bun run build

      - name: Deploy
        # Your deployment steps here
        run: echo "Deploy to your hosting provider"
```

## How It Works

1. **HTML Script Tag** (`index.html`):
   - The AdSense script tag uses `%%VITE_ADSENSE_CLIENT_ID%%` as a placeholder
   - During build, Vite's custom plugin replaces this with the actual client ID

2. **React Component** (`App.tsx`):
   - Uses `import.meta.env.VITE_ADSENSE_CLIENT_ID` and `import.meta.env.VITE_ADSENSE_SLOT_ID`
   - Only renders ads if both values are present
   - Falls back gracefully if environment variables are not set

3. **Vite Configuration** (`vite.config.ts`):
   - Custom plugin `htmlEnvPlugin` handles HTML placeholder replacement
   - Environment variables are automatically available in React components

## Disabling Ads

To disable ads completely:
- Don't set the environment variables
- The app will work normally without displaying any ad sections

## Getting AdSense Credentials

1. Sign up for [Google AdSense](https://www.google.com/adsense)
2. Create an ad unit
3. Copy your Publisher ID (starts with `ca-pub-`)
4. Copy your Ad Slot ID (numeric)

## Testing

To test if ads are working:

```bash
# Set environment variables
export VITE_ADSENSE_CLIENT_ID=ca-pub-1234567890123456
export VITE_ADSENSE_SLOT_ID=1234567890

# Build the project
bun run build

# Preview the build
bun run preview
```

Then check the built HTML file in `dist/index.html` to verify the client ID is correctly replaced.
