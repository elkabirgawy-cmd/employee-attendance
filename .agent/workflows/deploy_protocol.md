---
description: Mandatory Auto-Deployment Protocol for Cloudflare Pages
---

# Auto-Deployment Protocol

**Trigger**: AFTER ANY UI, CSS, or Logic change.

## 1. Git Sync
```bash
git add .
git commit -m "update: applied requested changes"
git push origin main
```

## 2. Production Build
```bash
npm run build
```

## 3. Direct Deployment (Fastest)
```bash
npx wrangler pages deploy dist --project-name gps-attendance
```

## 4. Verification & Response
- **Verify**: Ensure the command exits with "Deployment complete!"
- **Response Format**:
  > ✅ Deployment success confirmation
  > 🔗 Production URL: https://gps-attendance.pages.dev
