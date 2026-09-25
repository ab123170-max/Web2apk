# Web2APK AI

Web2APK AI is a web service that aims to turn existing web applications into Android APKs without requiring the user to rebuild the app UI.

## MVP flow
1. Connect GitHub
2. Select a repository
3. AI analyzes the project
4. Configure app name and package ID
5. Build Android APK with a cloud workflow
6. Download the APK

## Architecture
- Frontend: React + Vite
- AI: Gemini API (server-side only)
- Source: GitHub API/OAuth
- Android wrapper: Capacitor
- Build: GitHub Actions + Gradle
- Deployment target: Vercel-compatible frontend/API

The current commit contains the product UI foundation. GitHub OAuth, secure server API routes, AI inspection, isolated build generation, and artifact delivery are intentionally the next implementation stages.

## Security
Never put GitHub OAuth client secrets, GitHub access tokens, or Gemini API keys in Vite/browser code.
