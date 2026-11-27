# VirIntern Firestore Security Specification (Phase 0 TDD Contract)

**Firebase Project ID:** `virintern-daa89`  
**Rules Engine:** Cloud Firestore Rules v2 (`rules_version = '2'`)  
**Admin Identity Source of Truth:** Verified `/adminUsers/{uid}` (`active == true`), Firebase UID `'fEzJGHdgeASWWwE86wkUqhJ2Vs92'`, or verified token email (`request.auth.token.email_verified == true && request.auth.token.email.lower() in ['preethamirl@gmail.com', 'preethu1845@gmail.com']`) — **never** the user-editable `users/{uid}.role` field.

---

## 1. Core Security & Data Invariants

1. **Default Deny:** Unmatched paths (`/{document=**}`) deny all reads and writes (`allow read, write: if false;`).
2. **Zero Open Public Reads/Writes:** No collection uses `allow read: if true;` or `allow write: if true;`.
   - Unauthenticated landing/verification pages use Express `/api/*` endpoints (`/api/domains`, `/api/projects`, `/api/packages`, `/api/package-benefits`, `/api/leaderboard`, `/api/certificates/:certificateId`, `/api/settings`).
   - All direct Firestore reads require authenticated non-anonymous Firebase Auth (`isAuthenticated()`).
3. **Verified Admin RBAC (`isAdmin()`):**
   - Authoritative allowlist at `/adminUsers/{request.auth.uid}` where `active == true`, plus bootstrap verified identity checks (`request.auth.uid == 'fEzJGHdgeASWWwE86wkUqhJ2Vs92'`, or `email_verified == true` matching `'preethamirl@gmail.com'` / `'preethu1845@gmail.com'`).
   - Unverified email tokens (`email_verified == false`) are NEVER treated as admins even if `email` matches.
4. **Student Session Compatibility:** Students can sign in with Google (`email_verified == true`) or Email/Password (`AuthContext.tsx`). Requiring `isAuthenticated()` (`request.auth != null && request.auth.token.firebase.sign_in_provider != 'anonymous'`) secures every write/read without breaking existing student logins.
5. **Submission & Verification Integrity:**
   - Interns may only create/update submissions owned by `request.auth.uid`.
   - Interns CANNOT set or modify `rubricScore`, `adminFeedback`, `rubricFeedback`, `decisionReason`, `reviewedBy`, `reviewedAt`, `verifiedByAdminName`, `verifiedByAdminId`, `evaluationId`, `isSuspicious`, `suspiciousReason`, or `isManuallyVerified: true`.
   - Interns CANNOT create/update submissions directly into `'approved'`, `'passed'`, `'evaluated'`, `'under_review'`, or `'rejected'`.
   - Terminal lock: once a submission is `'approved'` or `'passed'`, the intern cannot mutate or overwrite it; only `isAdmin()` may modify or override it.
6. **Internships, Evaluations, Leaderboard, Tasks & Audit Logs:**
   - Only `isAdmin()` may write to `evaluations`, `leaderboard`, `domains`, `projects`, `tasks`, `packages`, `packageBenefits`, `settings`, `resources`, `interviewQuestions`, and `adminUsers`.
   - Only `isAdmin()` may advance `internships` fields (`progress`, `currentTask`, `completedTasks`, `task1VerificationCompleted`, `capstoneApproved`, `certificateEligible`, `status == 'completed'`). Interns may only create/reset at `0%` (`progress == 0`, `currentTask == 1`, `completedTasks == []`) or update metadata (`updatedAt`, `capstoneSubmitted`, `capstoneId`) without inflating progress.
   - `auditLogs`: readable and creatable strictly by `isAdmin()`; `update` and `delete` are permanently forbidden (`if false`).
7. **Certificates Protection:**
   - No unauthenticated Firestore reads (`certificates` requires `isAuthenticated()` for `get`, and `isAdmin()` or owner `resource.data.userId == request.auth.uid` for `list`).
   - Certificate creation by a non-admin requires BOTH `userId == request.auth.uid` AND verified `100%` internship completion (`get(/databases/$(database)/documents/internships/$(request.auth.uid)).data.progress == 100`).
8. **Strict Schema & Size Validation:**
   - Every document ID checks `isValidId(id)` (`size() >= 1 && size() <= 128 && matches('^[a-zA-Z0-9_\\-]+$')`).
   - Every `create` and `update` enforces `hasOnly(...)` permitted fields (no ghost/shadow field injection), `hasAll(...)` required fields, strict primitive types, enum membership, and bounded string/list sizes.

---

## 2. Adversarial Test Matrix ("Dirty Dozen" + Valid Roles)

| # | Actor | Operation / Attack Vector | Expected Outcome |
|---|---|---|---|
| 1 | Unauthenticated user | Read `domains`, `leaderboard`, `certificates`, `users`, `submissions`, `auditLogs` | **DENY** (`PERMISSION_DENIED`) |
| 2 | Unauthenticated user | Create/update any document (`submissions`, `users`, `notifications`, `referrals`) | **DENY** (`PERMISSION_DENIED`) |
| 3 | Intern A (`student`) | Update `users/{internA}` setting `role: 'admin'` or `isSuspended: true` or `progress: 100` | **DENY** (`PERMISSION_DENIED`) |
| 4 | Intern A (`student`) | Create `submissions/{id}` with `rubricScore: 100`, `isManuallyVerified: true`, or `status: 'approved'` | **DENY** (`PERMISSION_DENIED`) |
| 5 | Intern A (`student`) | Update existing `approved` submission or inject `adminFeedback` / `reviewedBy` / unknown ghost field | **DENY** (`PERMISSION_DENIED`) |
| 6 | Intern A (`student`) | Read/update/delete Intern B's `submissions`, `users`, `internships`, `notifications`, or `certificates` | **DENY** (`PERMISSION_DENIED`) |
| 7 | Intern A (`student`) | Update `internships/{internA}` to `progress: 100`, `completedTasks: [1,2,3,4,5]`, `certificateEligible: true` | **DENY** (`PERMISSION_DENIED`) |
| 8 | Intern A (`student`) | Write to `evaluations`, `leaderboard`, `tasks`, `domains`, `adminUsers`, `settings`, or `auditLogs` | **DENY** (`PERMISSION_DENIED`) |
| 9 | Intern A (`student`) | Self-issue `certificates/{certId}` when `internships/{internA}.progress < 100` | **DENY** (`PERMISSION_DENIED`) |
| 10 | Spoofer (`email_verified: false`, `email: 'preethamirl@gmail.com'`) | Attempt admin read/write on `users`, `submissions`, `leaderboard`, `auditLogs` | **DENY** (`PERMISSION_DENIED`) |
| 11 | Any user (including Admin) | Update or delete an existing `auditLogs/{logId}` entry | **DENY** (`PERMISSION_DENIED`) |
| 12 | Intern A (`student`) | ID poisoning (>128 chars or `/` / `..` chars) or shadow field injection | **DENY** (`PERMISSION_DENIED`) |
| 13 | Intern A (`student`) | Valid sign-up `users/{internA}`, `e_agreements/{internA}`, start `internships/{internA}` at 0%, create/update pending `submissions/{subId}`, mark own notification `isRead: true` | **ALLOW** |
| 14 | Verified Admin (`adminUsers/{uid}` or UID `fEzJGHdgeASWWwE86wkUqhJ2Vs92` or verified admin email) | List all users/submissions, approve submission & assign `rubricScore`, update `internships` progress, create `evaluations` & `leaderboard`, append `auditLogs`, manage `tasks`/`domains`/`adminUsers` | **ALLOW** |
