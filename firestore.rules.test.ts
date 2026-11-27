import { after, before, beforeEach, describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  setLogLevel,
} from 'firebase/firestore';

const PROJECT_ID = 'virintern-daa89';
const ADMIN_UID = 'fEzJGHdgeASWWwE86wkUqhJ2Vs92';
const ADMIN_ALT_UID = 'admin-allowlist-uid-2';
const INTERN_A_UID = 'intern-user-a-001';
const INTERN_B_UID = 'intern-user-b-002';
const SPOOFER_UID = 'spoofer-unverified-003';
const NOW_ISO = '2026-11-24T10:00:00.000Z';

let testEnv: RulesTestEnvironment;

function unauthDb() {
  return testEnv.unauthenticatedContext().firestore();
}

function internADb() {
  return testEnv
    .authenticatedContext(INTERN_A_UID, {
      email: 'intern.a@example.com',
      email_verified: true,
      firebase: { sign_in_provider: 'password' },
    })
    .firestore();
}

function internBDb() {
  return testEnv
    .authenticatedContext(INTERN_B_UID, {
      email: 'intern.b@example.com',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    })
    .firestore();
}

function spooferDb() {
  return testEnv
    .authenticatedContext(SPOOFER_UID, {
      email: 'preethamirl@gmail.com',
      email_verified: false,
      firebase: { sign_in_provider: 'password' },
    })
    .firestore();
}

function anonymousDb() {
  return testEnv
    .authenticatedContext('anon-user-999', {
      firebase: { sign_in_provider: 'anonymous' },
    })
    .firestore();
}

function adminDb() {
  return testEnv
    .authenticatedContext(ADMIN_UID, {
      email: 'preethamirl@gmail.com',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    })
    .firestore();
}

function allowlistAdminDb() {
  return testEnv
    .authenticatedContext(ADMIN_ALT_UID, {
      email: 'ops.admin@virintern.org',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    })
    .firestore();
}

describe('VirIntern Production Firestore Security Rules', () => {
  before(async () => {
    setLogLevel('error');
    const rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules,
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });

  after(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'adminUsers', ADMIN_ALT_UID), {
        uid: ADMIN_ALT_UID,
        email: 'ops.admin@virintern.org',
        name: 'Ops Admin',
        active: true,
        grantedBy: ADMIN_UID,
        createdAt: NOW_ISO,
      });

      await setDoc(doc(db, 'domains', 'web-dev'), {
        id: 'web-dev',
        name: 'Full-Stack Web Development',
        slug: 'web-dev',
        isActive: true,
        durationDays: 30,
        createdAt: NOW_ISO,
      });

      await setDoc(doc(db, 'users', INTERN_A_UID), {
        uid: INTERN_A_UID,
        name: 'Intern Alpha',
        email: 'intern.a@example.com',
        role: 'student',
        internshipStatus: 'active',
        progress: 20,
        createdAt: NOW_ISO,
        updatedAt: NOW_ISO,
      });

      await setDoc(doc(db, 'users', INTERN_B_UID), {
        uid: INTERN_B_UID,
        name: 'Intern Beta',
        email: 'intern.b@example.com',
        role: 'student',
        internshipStatus: 'active',
        progress: 0,
        createdAt: NOW_ISO,
        updatedAt: NOW_ISO,
      });

      await setDoc(doc(db, 'internships', INTERN_A_UID), {
        id: `${INTERN_A_UID}_web-dev`,
        userId: INTERN_A_UID,
        domainId: 'web-dev',
        domainName: 'Full-Stack Web Development',
        startDate: NOW_ISO,
        endDate: '2026-12-24T10:00:00.000Z',
        status: 'active',
        progress: 20,
        currentTask: 2,
        completedTasks: [1],
        task1VerificationCompleted: true,
        createdAt: NOW_ISO,
        updatedAt: NOW_ISO,
      });

      await setDoc(doc(db, 'submissions', 'sub_approved_1'), {
        id: 'sub_approved_1',
        userId: INTERN_A_UID,
        taskNumber: 1,
        domainId: 'web-dev',
        status: 'approved',
        isManuallyVerified: true,
        rubricScore: 92,
        adminFeedback: 'Verified milestone 1',
        reviewedBy: ADMIN_UID,
        reviewedAt: NOW_ISO,
        submittedAt: NOW_ISO,
      });

      await setDoc(doc(db, 'submissions', 'sub_pending_2'), {
        id: 'sub_pending_2',
        userId: INTERN_A_UID,
        taskNumber: 2,
        domainId: 'web-dev',
        status: 'submitted',
        isManuallyVerified: false,
        githubUrl: 'https://github.com/intern-a/task-2',
        submittedAt: NOW_ISO,
      });

      await setDoc(doc(db, 'leaderboard', INTERN_A_UID), {
        userId: INTERN_A_UID,
        userName: 'Intern Alpha',
        domainId: 'web-dev',
        totalPoints: 138,
        tasksCompleted: 1,
        averageScore: 92,
        rank: 1,
        updatedAt: NOW_ISO,
      });

      await setDoc(doc(db, 'auditLogs', 'audit_init_1'), {
        id: 'audit_init_1',
        adminId: ADMIN_UID,
        action: 'SYSTEM_INIT',
        targetType: 'SUBMISSION',
        targetId: 'sub_approved_1',
        timestamp: NOW_ISO,
      });
    });
  });

  // =========================================================================
  // 1. UNAUTHENTICATED & ANONYMOUS ACCESS LOCKDOWN
  // =========================================================================
  it('denies all unauthenticated reads and writes across protected collections', async () => {
    const db = unauthDb();
    await assertFails(getDoc(doc(db, 'domains', 'web-dev')));
    await assertFails(getDocs(collection(db, 'domains')));
    await assertFails(getDocs(collection(db, 'leaderboard')));
    await assertFails(getDoc(doc(db, 'users', INTERN_A_UID)));
    await assertFails(getDoc(doc(db, 'submissions', 'sub_pending_2')));
    await assertFails(getDoc(doc(db, 'certificates', 'cert_1')));
    await assertFails(getDoc(doc(db, 'auditLogs', 'audit_init_1')));

    await assertFails(
      setDoc(doc(db, 'submissions', 'sub_unauth_hack'), {
        id: 'sub_unauth_hack',
        userId: INTERN_A_UID,
        taskNumber: 2,
        status: 'submitted',
        submittedAt: NOW_ISO,
      })
    );
  });

  it('denies anonymous Firebase auth sessions', async () => {
    const db = anonymousDb();
    await assertFails(getDoc(doc(db, 'domains', 'web-dev')));
    await assertFails(getDocs(collection(db, 'leaderboard')));
  });

  // =========================================================================
  // 2. ADMIN AUTHORIZATION & SPOOFING PROTECTION
  // =========================================================================
  it('blocks unverified email spoofing even when email matches admin email', async () => {
    const db = spooferDb();
    await assertFails(getDocs(collection(db, 'users')));
    await assertFails(getDocs(collection(db, 'submissions')));
    await assertFails(getDocs(collection(db, 'auditLogs')));
    await assertFails(
      updateDoc(doc(db, 'submissions', 'sub_pending_2'), {
        status: 'approved',
        rubricScore: 100,
        isManuallyVerified: true,
      })
    );
  });

  it('blocks interns from escalating users.role or self-adding to adminUsers', async () => {
    const db = internADb();
    await assertFails(
      updateDoc(doc(db, 'users', INTERN_A_UID), {
        role: 'admin',
      })
    );
    await assertFails(
      updateDoc(doc(db, 'users', INTERN_A_UID), {
        isSuspended: true,
      })
    );
    await assertFails(
      setDoc(doc(db, 'adminUsers', INTERN_A_UID), {
        uid: INTERN_A_UID,
        email: 'intern.a@example.com',
        active: true,
      })
    );
    await assertFails(getDocs(collection(db, 'adminUsers')));
  });

  it('allows verified /adminUsers/{uid} allowlist admin and primary admin UID full review access', async () => {
    for (const db of [adminDb(), allowlistAdminDb()]) {
      await assertSucceeds(getDocs(collection(db, 'users')));
      await assertSucceeds(getDocs(collection(db, 'submissions')));
      await assertSucceeds(getDocs(collection(db, 'auditLogs')));
    }
  });

  // =========================================================================
  // 3. SUBMISSIONS, EVALUATIONS & INTERNSHIPS INTEGRITY
  // =========================================================================
  it('allows intern to create and update their own pending submission without review fields', async () => {
    const db = internADb();
    await assertSucceeds(
      setDoc(doc(db, 'submissions', 'sub_new_task_3'), {
        id: 'sub_new_task_3',
        userId: INTERN_A_UID,
        taskNumber: 3,
        domainId: 'web-dev',
        status: 'submitted',
        isManuallyVerified: false,
        githubUrl: 'https://github.com/intern-a/task-3',
        submittedAt: NOW_ISO,
      })
    );

    await assertSucceeds(
      updateDoc(doc(db, 'submissions', 'sub_pending_2'), {
        githubUrl: 'https://github.com/intern-a/task-2-revised',
        submittedAt: NOW_ISO,
      })
    );
  });

  it('denies intern from setting marks, approval status, review metadata, or editing approved work', async () => {
    const db = internADb();

    // Self-approval / marks on create
    await assertFails(
      setDoc(doc(db, 'submissions', 'sub_forged_1'), {
        id: 'sub_forged_1',
        userId: INTERN_A_UID,
        taskNumber: 3,
        status: 'approved',
        isManuallyVerified: true,
        rubricScore: 99,
        submittedAt: NOW_ISO,
      })
    );

    // Adding rubricScore on pending submission update
    await assertFails(
      updateDoc(doc(db, 'submissions', 'sub_pending_2'), {
        rubricScore: 100,
        adminFeedback: 'Self approved',
      })
    );

    // Injecting ghost/unknown field
    await assertFails(
      updateDoc(doc(db, 'submissions', 'sub_pending_2'), {
        shadowBypass: true,
      })
    );

    // Modifying already-approved submission
    await assertFails(
      updateDoc(doc(db, 'submissions', 'sub_approved_1'), {
        githubUrl: 'https://github.com/intern-a/tampered',
      })
    );

    // Cross-tenant access to Intern A submission from Intern B
    const bDb = internBDb();
    await assertFails(getDoc(doc(bDb, 'submissions', 'sub_pending_2')));
    await assertFails(
      updateDoc(doc(bDb, 'submissions', 'sub_pending_2'), {
        notes: 'Hijack attempt',
      })
    );
  });

  it('prevents interns from altering internship progress or writing evaluations/leaderboard/tasks', async () => {
    const db = internADb();

    await assertFails(
      updateDoc(doc(db, 'internships', INTERN_A_UID), {
        progress: 100,
        completedTasks: [1, 2, 3, 4, 5],
        certificateEligible: true,
        status: 'completed',
      })
    );

    await assertFails(
      setDoc(doc(db, 'evaluations', 'eval_fake_1'), {
        evaluationId: 'eval_fake_1',
        submissionId: 'sub_pending_2',
        userId: INTERN_A_UID,
        taskId: 'task-2',
        totalScore: 100,
        status: 'passed',
        evaluatedAt: NOW_ISO,
      })
    );

    await assertFails(
      setDoc(doc(db, 'leaderboard', INTERN_A_UID), {
        userId: INTERN_A_UID,
        userName: 'Intern Alpha',
        totalPoints: 9999,
        tasksCompleted: 5,
        averageScore: 100,
        rank: 1,
        updatedAt: NOW_ISO,
      })
    );

    await assertFails(
      setDoc(doc(db, 'domains', 'hacked-domain'), {
        id: 'hacked-domain',
        name: 'Hacked',
        slug: 'hacked',
        isActive: true,
      })
    );
  });

  it('allows authorized admin to approve submission, assign marks, update progress, and write audit log', async () => {
    const db = adminDb();

    await assertSucceeds(
      updateDoc(doc(db, 'submissions', 'sub_pending_2'), {
        status: 'approved',
        rubricScore: 95,
        adminFeedback: 'Excellent architecture',
        reviewedBy: ADMIN_UID,
        reviewedAt: NOW_ISO,
        isManuallyVerified: true,
        evaluationId: 'eval_sub_pending_2',
      })
    );

    await assertSucceeds(
      setDoc(doc(db, 'evaluations', 'eval_sub_pending_2'), {
        evaluationId: 'eval_sub_pending_2',
        submissionId: 'sub_pending_2',
        userId: INTERN_A_UID,
        taskId: 'task-2',
        totalScore: 95,
        status: 'passed',
        evaluatorType: 'ADMIN_OVERRIDE',
        earnedPoints: 143,
        evaluatedAt: NOW_ISO,
      })
    );

    await assertSucceeds(
      updateDoc(doc(db, 'internships', INTERN_A_UID), {
        progress: 40,
        currentTask: 3,
        completedTasks: [1, 2],
        updatedAt: NOW_ISO,
      })
    );

    await assertSucceeds(
      setDoc(doc(db, 'leaderboard', INTERN_A_UID), {
        userId: INTERN_A_UID,
        userName: 'Intern Alpha',
        domainId: 'web-dev',
        totalPoints: 281,
        tasksCompleted: 2,
        averageScore: 94,
        rank: 1,
        updatedAt: NOW_ISO,
      })
    );

    await assertSucceeds(
      setDoc(doc(db, 'auditLogs', 'audit_verify_2'), {
        id: 'audit_verify_2',
        adminId: ADMIN_UID,
        action: 'ADMIN_MANUAL_VERIFICATION',
        targetType: 'SUBMISSION',
        targetId: 'sub_pending_2',
        newScore: 95,
        timestamp: NOW_ISO,
      })
    );
  });

  // =========================================================================
  // 4. CERTIFICATES, NOTIFICATIONS & IMMUTABLE AUDIT LOGS
  // =========================================================================
  it('blocks premature self-issued certificates and allows 100%-completed graduates or admins', async () => {
    const db = internADb();

    // Denied while progress is 20%
    await assertFails(
      setDoc(doc(db, 'certificates', 'cert_premature_1'), {
        certificateId: 'cert_premature_1',
        userId: INTERN_A_UID,
        studentName: 'Intern Alpha',
        internshipDomain: 'Full-Stack Web Development',
        type: 'Completion',
        status: 'valid',
      })
    );

    // Admin advances internship to 100%
    await assertSucceeds(
      updateDoc(doc(adminDb(), 'internships', INTERN_A_UID), {
        progress: 100,
        status: 'completed',
        completedTasks: [1, 2, 3, 4, 5],
        certificateEligible: true,
        updatedAt: NOW_ISO,
      })
    );

    // Allowed after verified 100% completion
    await assertSucceeds(
      setDoc(doc(db, 'certificates', 'cert_valid_1'), {
        certificateId: 'cert_valid_1',
        userId: INTERN_A_UID,
        studentName: 'Intern Alpha',
        internshipDomain: 'Full-Stack Web Development',
        type: 'Completion',
        status: 'valid',
      })
    );
  });

  it('scopes notifications to owner and keeps auditLogs strictly append-only/immutable', async () => {
    const aDb = internADb();
    const bDb = internBDb();

    await assertSucceeds(
      setDoc(doc(aDb, 'notifications', 'notif_a_1'), {
        id: 'notif_a_1',
        userId: INTERN_A_UID,
        title: 'Task Update',
        message: 'Check dashboard',
        type: 'task_unlocked',
        isRead: false,
        createdAt: NOW_ISO,
      })
    );

    await assertSucceeds(updateDoc(doc(aDb, 'notifications', 'notif_a_1'), { isRead: true }));
    await assertFails(updateDoc(doc(aDb, 'notifications', 'notif_a_1'), { message: 'Tampered' }));
    await assertFails(getDoc(doc(bDb, 'notifications', 'notif_a_1')));

    // Audit log immutability even for Admin
    await assertFails(updateDoc(doc(adminDb(), 'auditLogs', 'audit_init_1'), { action: 'ALTERED' }));
    await assertFails(deleteDoc(doc(adminDb(), 'auditLogs', 'audit_init_1')));
  });
});
