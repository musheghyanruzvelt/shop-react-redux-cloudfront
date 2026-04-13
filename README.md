# My Store App

## Deployment URLs

- **CloudFront URL**: https://d2j914rf2e73ud.cloudfront.net
- **S3 Bucket URL**:
  http://deploywebappstack-deploymentfrontendbucket67ceb713-qccfc084zife.s3.amazonaws.com

> Note: S3 direct access returns 403. The site is served exclusively via
> CloudFront.

## Task 2.1 — Manual Deployment

1. Created S3 bucket via AWS Console and configured static website hosting
2. Built the app (`npm run build`) and manually uploaded `dist/` contents to S3
3. Verified app was accessible via S3 website endpoint
4. Created CloudFront distribution pointing to S3 bucket
5. Updated S3 bucket policy to allow CloudFront access only (OAC)
6. Verified app was accessible via CloudFront URL
7. Made visible changes, re-uploaded to S3, and created CloudFront invalidation
   manually

## Task 2.2 — Automated Deployment (AWS CDK)

### Scripts

- `npm run deploy` — Build + upload to S3 + deploy CloudFront (automated)
- `npm run cdk:deploy` — Deploy CDK stack only
- `npm run cdk:destroy` — Tear down all AWS resources

### Infrastructure

- S3 bucket with blocked public access
- CloudFront distribution with OAC (Origin Access Control)
- SPA routing via 403/404 error responses → index.html
- Automated cache invalidation via `BucketDeployment`

## Available Scripts

### Development

- `npm start` — Run locally
- `npm run build` — Build for production
