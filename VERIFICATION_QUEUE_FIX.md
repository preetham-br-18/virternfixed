# VirIntern Verification Queue Fix

## What changed

1. **Firestore is now the source of truth for submissions.** The admin queue and student submission history read directly from the Firestore `submissions` collection instead of relying on the Express in-memory / `.data` JSON store. This avoids losing queue records across Vercel serverless instances.
2. **Queue errors are visible.** Firestore permission and listener failures are logged and surfaced in the Admin Portal instead of silently appearing as an empty queue.
3. **Manual review writes directly to Firestore.** Approval, revision, rejection, evaluation, internship progress, leaderboard, and audit records continue through the existing Firestore write path and security rules.
4. **The working Student Roster code was not changed.**
5. **Removed the YouTube OAuth client secret from browser configuration.** The previous value was present in frontend source, so it must be rotated in Google Cloud Console before production use.

## Required deployment steps

### 1. Deploy Firestore rules

In Firebase Console, open project `virintern-daa89` → Firestore Database → Rules. Publish the `firestore.rules` file included in this project ZIP. Do not change Realtime Database rules as part of this fix.

### 2. Check the admin account

The Firestore rules permit the configured admin UID, or the configured admin email addresses only when the Firebase email is verified. Sign in with the authorized admin account and verify its email address if using email/password authentication.

### 3. Deploy the updated frontend

Push the extracted project to the connected Git repository or upload it through your existing deployment workflow, then redeploy on Vercel. No new Vercel environment variable is required for the queue changes.

### 4. Test the complete flow

1. Sign in as a test student.
2. Submit a task with a short test response or repository link.
3. In Firebase Console → Firestore Database → Data, confirm a document appears in `submissions`.
4. Sign in as the authorized admin and open Admin Portal → Verification Queue.
5. Confirm the submission appears, then test approval or revision.
6. Confirm the submission status and evaluation are updated in Firestore.

## If the queue still does not load

The Admin Portal now displays the Firestore error. If it says `permission-denied`, verify that the correct rules were published to project `virintern-daa89` and that the signed-in admin UID/email satisfies the admin condition. If it reports a different error, use the exact message to diagnose the next issue.

## Security action required

A YouTube OAuth client secret was included in the earlier frontend source. Removing it from this ZIP does not invalidate the already exposed secret. Rotate/revoke that secret in Google Cloud Console. Never place an OAuth client secret in a `VITE_` environment variable or any browser-bundled file.

## Validation

The modified TypeScript/TSX files passed TypeScript transpilation syntax checks. A full dependency-based Vite build and Firestore emulator test could not be run in this environment because dependency installation timed out. Run `npm install`, `npm run build`, and `npm run test:rules` in your development environment before production deployment.
