# Deployment Checklist

## Pre-Deployment
- [ ] All environment variables configured
- [ ] Database migrations tested
- [ ] API keys valid (Helius, Jupiter)
- [ ] Backend health endpoint responding
- [ ] Frontend connects to backend

## Backend (Railway)
- [ ] Push to GitHub
- [ ] Railway auto-deploys
- [ ] Check build logs for errors
- [ ] Verify migrations ran: `npx prisma migrate deploy`
- [ ] Test `/health` endpoint
- [ ] Configure Helius webhooks

## Frontend (Expo)
- [ ] Update EXPO_PUBLIC_API_URL to Railway URL
- [ ] Test on physical device
- [ ] Build APK: `npm run build:android:beta`
- [ ] Test wallet creation
- [ ] Test send/swap/copy trading

## Post-Deployment
- [ ] Monitor Railway logs
- [ ] Test all critical flows
- [ ] Verify webhook receiving trader activity
- [ ] Check background tasks running
