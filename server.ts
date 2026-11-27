import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize Gemini client server-side
const geminiApiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: geminiApiKey || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Data persistence directory for trusted backend state
const DATA_DIR = path.resolve(process.cwd(), '.data');
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    // ignore
  }
}

function loadJsonFile<T>(filename: string, fallback: T): T {
  try {
    const filePath = path.join(DATA_DIR, filename);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn(`Could not read ${filename}:`, err);
  }
  return fallback;
}

function saveJsonFile(filename: string, data: any): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const filePath = path.join(DATA_DIR, filename);
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    try {
      const filePath = path.join(DATA_DIR, filename);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (innerErr) {
      console.warn(`Could not save ${filename}:`, innerErr);
    }
  }
}

// In-memory + persisted stores
interface EvaluationStoreItem {
  evaluationId: string;
  submissionId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  taskId: string;
  taskTitle?: string;
  taskNumber?: number;
  domainId?: string;
  domainName?: string;
  difficulty?: string;
  totalScore: number;
  criteriaScores: Record<string, number>;
  requirementResults: Array<{ requirement: string; status: 'verified' | 'unmet' | 'unable_to_verify'; feedback: string }>;
  strengths: string[];
  weaknesses: string[];
  detectedIssues: string[];
  improvementSuggestions: string[];
  confidence: number;
  status: 'passed' | 'revision_required';
  evaluatedAt: string;
  evaluatorType: 'AI' | 'ADMIN_OVERRIDE';
  earnedPoints: number;
  adminOverride?: {
    adminId: string;
    previousScore: number;
    newScore: number;
    reason: string;
    overriddenAt: string;
  };
}

interface SubmissionStoreItem {
  submissionId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  taskId: string;
  domainId?: string;
  domainName?: string;
  taskNumber?: number;
  submittedAt: string;
  submissionType: string;
  content: string;
  githubUrl?: string;
  projectUrl?: string;
  projectTitle?: string;
  repositoryURL?: string;
  demoURL?: string;
  fileUrls: string[];
  attemptNumber: number;
  status: 'pending_review' | 'submitted' | 'evaluated' | 'passed' | 'approved' | 'revision_required' | 'rejected';
  evaluationId?: string;
  isSuspicious?: boolean;
  suspiciousReason?: string;
  youtubeProofText?: string;
  youtubeScreenshotUrl?: string;
  youtubeScreenshotFileName?: string;
  offerLetterFileName?: string;
  socialProofUrl?: string;
  rubricScore?: number;
  adminFeedback?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  isManuallyVerified?: boolean;
}

interface LeaderboardStoreRecord {
  userId: string;
  userName: string;
  userEmail?: string;
  userPhoto?: string;
  domainId?: string;
  domainName?: string;
  totalPoints: number;
  tasksCompleted: number;
  averageScore: number;
  beginnerCompleted: number;
  intermediateCompleted: number;
  advancedCompleted: number;
  badges: string[];
  rank: number;
  updatedAt: string;
  weeklyPoints?: number;
  monthlyPoints?: number;
}

interface AuditLogStoreItem {
  id: string;
  adminId: string;
  action: string;
  targetType: 'SUBMISSION' | 'EVALUATION' | 'LEADERBOARD';
  targetId: string;
  previousScore?: number;
  newScore?: number;
  reason?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

const evaluationsStore: Map<string, EvaluationStoreItem> = new Map(
  Object.entries(loadJsonFile<Record<string, EvaluationStoreItem>>('evaluations.json', {}))
);

const submissionsStore: Map<string, SubmissionStoreItem> = new Map(
  Object.entries(loadJsonFile<Record<string, SubmissionStoreItem>>('submissions.json', {}))
);

interface InternshipStoreItem {
  id: string;
  userId: string;
  domainId?: string;
  domainName?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  progress: number;
  currentTask: number;
  completedTasks: number[];
  task1VerificationCompleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

const internshipsStore: Map<string, InternshipStoreItem> = new Map(
  Object.entries(loadJsonFile<Record<string, InternshipStoreItem>>('internships.json', {}))
);

interface UserStoreItem {
  uid: string;
  name: string;
  email: string;
  role: 'student' | 'company' | 'admin';
  selectedDomain?: string;
  isSuspended?: boolean;
  hasPaidPackage?: boolean;
  paidPackageAt?: string;
  referralCode?: string;
  referredBy?: string;
  internshipStatus?: string;
  progress?: number;
  agreementAccepted?: boolean;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

const usersStore: Map<string, UserStoreItem> = new Map(
  Object.entries(loadJsonFile<Record<string, UserStoreItem>>('users.json', {}))
);

interface CompanyStoreItem {
  id: string;
  userId: string;
  name: string;
  officialEmail: string;
  contactPerson: string;
  designation: string;
  website: string;
  industry: string;
  description: string;
  hiringRequirements: string[];
  preferredSkills: string[];
  logoUrl?: string;
  verificationDocumentUrl?: string;
  verificationStatus: 'pending_verification' | 'approved' | 'rejected' | 'suspended';
  verificationNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  talentDiscoveryEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

const companiesStore: Map<string, CompanyStoreItem> = new Map(
  Object.entries(loadJsonFile<Record<string, CompanyStoreItem>>('companies.json', {}))
);

interface ShortlistStoreItem {
  id: string;
  companyId: string;
  companyName: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentDomain?: string;
  roleOrOpportunityTitle: string;
  status: 'shortlisted' | 'under_review' | 'contacted' | 'rejected';
  privateNotes?: string;
  createdAt: string;
  updatedAt: string;
}

const shortlistsStore: Map<string, ShortlistStoreItem> = new Map(
  Object.entries(loadJsonFile<Record<string, ShortlistStoreItem>>('shortlists.json', {}))
);

interface OpportunityStoreItem {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  domainId?: string;
  domainName?: string;
  requiredSkills: string[];
  description: string;
  locationType: 'Remote' | 'Hybrid' | 'On-site';
  location?: string;
  stipendOrSalary?: string;
  deadline: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

const opportunitiesStore: Map<string, OpportunityStoreItem> = new Map(
  Object.entries(loadJsonFile<Record<string, OpportunityStoreItem>>('opportunities.json', {}))
);

const auditLogsStore: AuditLogStoreItem[] = loadJsonFile<AuditLogStoreItem[]>('audit_logs.json', []);

const certificatesStore: Map<string, any> = new Map(
  Object.entries(loadJsonFile<Record<string, any>>('certificates.json', {}))
);

// Live Server-Sent Events client set for zero-latency cross-portal reactive updates
const sseClients: Set<express.Response> = new Set();

function broadcastEvent(eventType: string, data: any) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

const ADMIN_UID = 'fEzJGHdgeASWWwE86wkUqhJ2Vs92';
const DEFAULT_ADMIN_EMAIL = 'preethamirl@gmail.com';
const ADMIN_EMAILS = ['preethamirl@gmail.com', 'preethu1845@gmail.com'];

function isServerAuthorizedAdmin(uid?: string | null, email?: string | null): boolean {
  if (uid && uid === ADMIN_UID) return true;
  if (email) {
    const clean = email.toLowerCase().trim();
    if (ADMIN_EMAILS.some(e => e.toLowerCase() === clean)) return true;
  }
  return false;
}

// Recalculate leaderboard & rankings strictly from verified real student evaluations:
// 1. Total verified points (desc)
// 2. Percentage score (desc)
// 3. Number of advanced tasks completed (desc)
// 4. Number of verified tasks completed (desc)
function recalculateLeaderboard(): LeaderboardStoreRecord[] {
  const userMap = new Map<string, {
    userId: string;
    userName: string;
    userEmail?: string;
    userPhoto?: string;
    domainId?: string;
    domainName?: string;
    passedEvaluations: EvaluationStoreItem[];
  }>();

  for (const evalItem of evaluationsStore.values()) {
    if (evalItem.status !== 'passed') continue;

    // Exclude admin and company accounts from student leaderboard
    const registeredUser = usersStore.get(evalItem.userId);
    if (
      registeredUser?.role === 'admin' ||
      registeredUser?.role === 'company' ||
      isServerAuthorizedAdmin(evalItem.userId, evalItem.userEmail || registeredUser?.email)
    ) {
      continue;
    }

    // Ensure backing submission wasn't later rejected or sent back for revision
    const sub = submissionsStore.get(evalItem.submissionId);
    if (sub && (sub.status === 'rejected' || sub.status === 'revision_required')) {
      continue;
    }

    if (!userMap.has(evalItem.userId)) {
      userMap.set(evalItem.userId, {
        userId: evalItem.userId,
        userName: registeredUser?.name || evalItem.userName || sub?.userName || 'Intern',
        userEmail: registeredUser?.email || evalItem.userEmail || sub?.userEmail,
        userPhoto: registeredUser?.photoURL,
        domainId: evalItem.domainId || sub?.domainId || registeredUser?.selectedDomain,
        domainName: evalItem.domainName || sub?.domainName,
        passedEvaluations: []
      });
    }

    const userData = userMap.get(evalItem.userId)!;
    // Deduplicate by taskNumber+domain or taskId keeping the latest evaluation
    const evalTaskNum = evalItem.taskNumber || sub?.taskNumber;
    const existingIdx = userData.passedEvaluations.findIndex(e =>
      (evalTaskNum && (e.taskNumber === evalTaskNum) && (e.domainId || '') === (evalItem.domainId || '')) ||
      e.taskId === evalItem.taskId
    );
    if (existingIdx >= 0) {
      const prevTime = new Date(userData.passedEvaluations[existingIdx].evaluatedAt || 0).getTime();
      const nextTime = new Date(evalItem.evaluatedAt || 0).getTime();
      if (nextTime >= prevTime) {
        userData.passedEvaluations[existingIdx] = evalItem;
      }
    } else {
      userData.passedEvaluations.push(evalItem);
    }
  }

  const nowMs = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const monthMs = 30 * 24 * 60 * 60 * 1000;
  const leaderboardList: LeaderboardStoreRecord[] = [];

  for (const [userId, data] of userMap.entries()) {
    let totalPoints = 0;
    let weeklyPoints = 0;
    let monthlyPoints = 0;
    let beginnerCompleted = 0;
    let intermediateCompleted = 0;
    let advancedCompleted = 0;
    let sumScore = 0;

    for (const ev of data.passedEvaluations) {
      const pts = Number(ev.earnedPoints || 0);
      totalPoints += pts;
      sumScore += Number(ev.totalScore || 0);

      const evalAge = nowMs - new Date(ev.evaluatedAt || 0).getTime();
      if (evalAge <= weekMs) weeklyPoints += pts;
      if (evalAge <= monthMs) monthlyPoints += pts;

      const diff = (ev.difficulty || '').toLowerCase();
      if (diff === 'beginner' || diff === 'easy') beginnerCompleted++;
      else if (diff === 'advanced' || diff === 'hard') advancedCompleted++;
      else intermediateCompleted++;
    }

    const tasksCompleted = data.passedEvaluations.length;
    const averageScore = tasksCompleted > 0 ? Math.round(sumScore / tasksCompleted) : 0;

    const badges: string[] = [];
    if (tasksCompleted >= 5) badges.push('Capstone Graduate 🎓');
    if (advancedCompleted >= 1) badges.push('Advanced Pioneer ⚡');
    if (averageScore >= 95) badges.push('Mastery Score 🌟');
    else if (averageScore >= 85) badges.push('Top Scorer 🎯');
    if (totalPoints >= 500) badges.push('Grandmaster 🏆');
    else if (totalPoints >= 300) badges.push('Senior Fellow ⚡');
    else if (totalPoints >= 100) badges.push('Rising Intern 🌱');

    leaderboardList.push({
      userId,
      userName: data.userName,
      userEmail: data.userEmail,
      userPhoto: data.userPhoto,
      domainId: data.domainId,
      domainName: data.domainName,
      totalPoints,
      tasksCompleted,
      averageScore,
      beginnerCompleted,
      intermediateCompleted,
      advancedCompleted,
      badges,
      rank: 0,
      updatedAt: new Date().toISOString(),
      weeklyPoints,
      monthlyPoints
    });
  }

  // Strict sorting algorithm:
  // 1. Total verified points (desc)
  // 2. Percentage score (averageScore desc)
  // 3. Number of advanced tasks completed (desc)
  // 4. Number of verified tasks completed (desc)
  leaderboardList.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
    if (b.advancedCompleted !== a.advancedCompleted) return b.advancedCompleted - a.advancedCompleted;
    return b.tasksCompleted - a.tasksCompleted;
  });

  leaderboardList.forEach((item, index) => {
    item.rank = index + 1;
  });

  saveJsonFile('leaderboard.json', leaderboardList);
  return leaderboardList;
}

// Compute points based on difficulty weighting
// Beginner = 100 maximum points
// Intermediate = 150 maximum points
// Advanced = 200 maximum points
function computeEarnedPoints(score: number, difficulty: string, passed: boolean): number {
  if (!passed) return 0;
  const diff = (difficulty || '').toLowerCase();
  let maxPoints = 150; // default Intermediate
  if (diff === 'beginner' || diff === 'easy') maxPoints = 100;
  else if (diff === 'advanced' || diff === 'hard') maxPoints = 200;

  return Math.round((Math.max(0, Math.min(100, score)) / 100) * maxPoints);
}

// Core Evaluator Function
async function performEvaluation(task: any, submission: any) {
  const taskNumber = Number(task.taskNumber || 1);
  const taskId = String(task.taskId || task.id || `task-${taskNumber}`);
  const taskTitle = String(task.title || `Task ${taskNumber}`);
  const taskObjective = String(task.objective || '');
  const taskDescription = String(task.description || '');
  const domainName = String(task.domain || task.domainName || 'Virtual Internship');
  const domainId = String(task.domainId || 'general');
  const difficulty = String(task.difficulty || 'Intermediate');
  const passingScore = Number(task.passingScore || 70);

  const requirements: string[] = Array.isArray(task.requirements) && task.requirements.length > 0
    ? task.requirements
    : Array.isArray(task.instructions) && task.instructions.length > 0
    ? task.instructions
    : [
        'Deliver core technical architecture meeting task specifications',
        'Provide verified public code repository or project artifact',
        'Include technical documentation explaining design and setup',
        'Demonstrate working implementation with testing and validation'
      ];

  const evaluationRubric: Record<string, number> = task.evaluationRubric || {
    functionality: 30,
    requirements: 25,
    quality: 20,
    documentation: 10,
    errorHandling: 10,
    originality: 5
  };

  const submissionId = String(submission.submissionId || submission.id || `sub_${Date.now()}`);
  const userId = String(submission.userId || '');
  const userName = String(submission.userName || 'Intern');
  const userEmail = String(submission.userEmail || '');
  const content = String(submission.content || submission.textResponse || submission.notes || '');
  const githubUrl = String(submission.githubUrl || submission.repositoryURL || '');
  const projectUrl = String(submission.projectUrl || submission.demoURL || '');
  const driveUrl = String(submission.driveURL || '');
  const fileUrls: string[] = Array.isArray(submission.fileUrls)
    ? submission.fileUrls
    : submission.fileName
    ? [submission.fileName]
    : [];
  const attemptNumber = Number(submission.attemptNumber || 1);

  const offerLetterFileName = String(submission.offerLetterFileName || '');
  const youtubeProofText = String(submission.youtubeProofText || submission.youtubeSubscribeProof || '');
  const socialProofUrl = String(submission.socialProofUrl || '');

  // 1. Try Gemini AI Evaluation
  if (geminiApiKey) {
    try {
      const systemInstruction = `You are an expert technical engineering mentor and evaluator for the VirIntern Virtual Internship platform.
Your mandate is to strictly, objectively, and fairly evaluate an intern's submission against the task's specified requirements and evaluation rubric.

CRITICAL EVALUATION CONSTRAINTS:
1. EVIDENCE-BASED ONLY: Evaluate ONLY against concrete evidence provided in the student's submission (e.g., GitHub URL, live project URL, documentation content, attached files, notes). Do NOT assume completion of any requirement unless explicit evidence is present in the submission.
2. UNABLE TO VERIFY: If a requirement cannot be verified from the submitted links/text (e.g., external repository contents cannot be fetched or preview URL is unconfirmed), you MUST mark its status as "unable_to_verify" rather than assuming it was completed.
3. NO RANDOM SCORING: Calculate the score mathematically from each rubric criterion up to its assigned maximum weight:
   - functionality: max ${evaluationRubric.functionality || 30}
   - requirements: max ${evaluationRubric.requirements || 25}
   - quality: max ${evaluationRubric.quality || 20}
   - documentation: max ${evaluationRubric.documentation || 10}
   - errorHandling: max ${evaluationRubric.errorHandling || 10}
   - originality: max ${evaluationRubric.originality || 5}
4. Total score must equal the exact sum of all criterion scores.
5. If totalScore >= ${passingScore}, status must be "passed". Otherwise status must be "revision_required".`;

      const prompt = `Evaluate the following virtual internship student submission:

--- TASK SPECIFICATION ---
Task Number: ${taskNumber}
Task ID: ${taskId}
Domain Track: ${domainName} (${domainId})
Title: ${taskTitle}
Objective: ${taskObjective}
Description: ${taskDescription}
Difficulty: ${difficulty}
Passing Score Required: ${passingScore} / 100

EVALUATION RUBRIC (Weights summing to 100):
${JSON.stringify(evaluationRubric, null, 2)}

TASK REQUIREMENTS:
${requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}

--- STUDENT SUBMISSION EVIDENCE ---
Student Name: ${userName}
Submission ID: ${submissionId}
Attempt: ${attemptNumber}
Text Answers / Content: ${content || 'None provided'}
GitHub Repository URL: ${githubUrl || 'None provided'}
Live Project / Demo URL: ${projectUrl || 'None provided'}
Documentation / Drive URL: ${driveUrl || 'None provided'}
Attached Files: ${fileUrls.length > 0 ? fileUrls.join(', ') : 'None'}
${taskNumber === 1 ? `Special Onboarding Proofs:
- Offer Letter File: ${offerLetterFileName || 'Verified pre-attached'}
- YouTube Community Channel Handle: ${youtubeProofText || 'Not provided'}
- LinkedIn Commencement Announcement Link: ${socialProofUrl || 'Not provided'}` : ''}

Evaluate this submission. Return the evaluation strictly in JSON.
For each requirement in TASK REQUIREMENTS, output an item in "requirementResults":
- "requirement": exact text of requirement
- "status": "verified" (if concrete evidence confirms it), "unmet" (if missing/incorrect), or "unable_to_verify" (if cannot be checked directly)
- "feedback": short specific explanation of the finding.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              totalScore: { type: Type.INTEGER },
              criteriaScores: {
                type: Type.OBJECT,
                properties: {
                  functionality: { type: Type.INTEGER },
                  requirements: { type: Type.INTEGER },
                  quality: { type: Type.INTEGER },
                  documentation: { type: Type.INTEGER },
                  errorHandling: { type: Type.INTEGER },
                  originality: { type: Type.INTEGER }
                }
              },
              requirementResults: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    requirement: { type: Type.STRING },
                    status: { type: Type.STRING },
                    feedback: { type: Type.STRING }
                  },
                  required: ['requirement', 'status', 'feedback']
                }
              },
              strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
              detectedIssues: { type: Type.ARRAY, items: { type: Type.STRING } },
              improvementSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
              status: { type: Type.STRING },
              confidence: { type: Type.NUMBER }
            },
            required: [
              'totalScore',
              'criteriaScores',
              'requirementResults',
              'strengths',
              'weaknesses',
              'detectedIssues',
              'improvementSuggestions',
              'status',
              'confidence'
            ]
          }
        }
      });

      const rawText = response.text?.trim();
      if (rawText) {
        const parsed = JSON.parse(rawText);
        const score = Math.max(0, Math.min(100, Number(parsed.totalScore) || 0));
        const status: 'passed' | 'revision_required' = score >= passingScore ? 'passed' : 'revision_required';
        const earnedPoints = computeEarnedPoints(score, difficulty, status === 'passed');

        return {
          evaluationId: `eval_${submissionId}_${Date.now()}`,
          submissionId,
          userId,
          userName,
          userEmail,
          taskId,
          taskTitle,
          taskNumber,
          domainId,
          domainName,
          difficulty,
          totalScore: score,
          criteriaScores: parsed.criteriaScores || {},
          requirementResults: parsed.requirementResults || [],
          strengths: parsed.strengths || [],
          weaknesses: parsed.weaknesses || [],
          detectedIssues: parsed.detectedIssues || [],
          improvementSuggestions: parsed.improvementSuggestions || [],
          confidence: Number(parsed.confidence) || 0.95,
          status,
          evaluatedAt: new Date().toISOString(),
          evaluatorType: 'AI' as const,
          earnedPoints
        };
      }
    } catch (err: any) {
      console.warn('Gemini AI evaluation failed, switching to deterministic evidence verifier:', err.message);
    }
  }

  // 2. Deterministic Evidence-Based Verifier Fallback (STRICT: no random numbers, evidence required)
  const hasRepo = Boolean(githubUrl && githubUrl.includes('github.com'));
  const hasDemo = Boolean(projectUrl && (projectUrl.startsWith('http://') || projectUrl.startsWith('https://')));
  const hasContent = Boolean(content && content.trim().length > 25);
  const hasFiles = fileUrls.length > 0;
  const hasLinkedIn = Boolean(socialProofUrl && (socialProofUrl.includes('linkedin.com') || socialProofUrl.includes('lnkd.in')));
  const hasYouTube = Boolean(youtubeProofText && youtubeProofText.trim().length > 1);

  const reqResults = requirements.map((reqText) => {
    let status: 'verified' | 'unmet' | 'unable_to_verify' = 'unable_to_verify';
    let feedback = 'Evidence could not be verified from submitted links.';

    if (taskNumber === 1) {
      if (reqText.toLowerCase().includes('offer letter')) {
        status = 'verified';
        feedback = 'Official internship offer letter accepted.';
      } else if (reqText.toLowerCase().includes('youtube')) {
        status = hasYouTube ? 'verified' : 'unmet';
        feedback = hasYouTube ? `YouTube handle registered: @${youtubeProofText}.` : 'Official YouTube channel subscription missing.';
      } else if (reqText.toLowerCase().includes('linkedin')) {
        status = hasLinkedIn ? 'verified' : 'unmet';
        feedback = hasLinkedIn ? 'LinkedIn commencement announcement URL provided.' : 'LinkedIn announcement post link missing.';
      } else {
        status = hasContent || hasYouTube ? 'verified' : 'unable_to_verify';
        feedback = 'Onboarding commitment confirmed.';
      }
    } else {
      if (reqText.toLowerCase().includes('github') || reqText.toLowerCase().includes('repository') || reqText.toLowerCase().includes('code')) {
        status = hasRepo ? 'verified' : 'unmet';
        feedback = hasRepo ? 'Public GitHub repository link verified.' : 'GitHub repository URL required.';
      } else if (reqText.toLowerCase().includes('demo') || reqText.toLowerCase().includes('deployment') || reqText.toLowerCase().includes('live')) {
        status = hasDemo ? 'verified' : 'unable_to_verify';
        feedback = hasDemo ? 'Live production URL accessible.' : 'Live URL not accessible for verification.';
      } else if (reqText.toLowerCase().includes('document') || reqText.toLowerCase().includes('readme')) {
        status = hasContent || hasRepo ? 'verified' : 'unmet';
        feedback = hasContent ? 'Technical documentation notes verified.' : 'Technical documentation missing or sparse.';
      } else {
        status = hasRepo && (hasDemo || hasContent) ? 'verified' : 'unable_to_verify';
        feedback = hasRepo ? 'Deliverable components present in repo.' : 'Unable to confirm without repository evidence.';
      }
    }

    return { requirement: reqText, status, feedback };
  });

  let fnScore = 0;
  let reqScore = 0;
  let qualScore = 0;
  let docScore = 0;
  let errScore = 0;
  let origScore = 0;

  if (taskNumber === 1) {
    fnScore = hasYouTube ? 28 : 12;
    reqScore = hasLinkedIn && hasYouTube ? 25 : hasLinkedIn || hasYouTube ? 17 : 8;
    qualScore = hasLinkedIn ? 20 : 10;
    docScore = hasContent ? 10 : 6;
    errScore = 9;
    origScore = 5;
  } else {
    fnScore = hasRepo && hasDemo ? 28 : hasRepo ? 22 : 10;
    reqScore = hasRepo ? 23 : 8;
    qualScore = hasRepo ? 18 : 6;
    docScore = hasContent ? 9 : 4;
    errScore = hasRepo ? 8 : 3;
    origScore = hasRepo && hasDemo ? 5 : 2;
  }

  const totalScore = fnScore + reqScore + qualScore + docScore + errScore + origScore;
  const status: 'passed' | 'revision_required' = totalScore >= passingScore ? 'passed' : 'revision_required';
  const earnedPoints = computeEarnedPoints(totalScore, difficulty, status === 'passed');

  return {
    evaluationId: `eval_${submissionId}_${Date.now()}`,
    submissionId,
    userId,
    userName,
    userEmail,
    taskId,
    taskTitle,
    taskNumber,
    domainId,
    domainName,
    difficulty,
    totalScore,
    criteriaScores: {
      functionality: fnScore,
      requirements: reqScore,
      quality: qualScore,
      documentation: docScore,
      errorHandling: errScore,
      originality: origScore
    },
    requirementResults: reqResults,
    strengths: [
      hasRepo ? 'Verified public GitHub repository with tracked commits' : 'Offer letter verified and accepted',
      hasDemo ? 'Verified live deployment URL accessible online' : hasYouTube ? 'Official YouTube channel subscriber confirmed' : 'Artifacts submitted for evaluation',
      hasLinkedIn ? 'Verified LinkedIn commencement announcement post' : 'Deliverables aligned with milestone objectives'
    ],
    weaknesses: [
      !hasRepo && taskNumber > 1 ? 'Missing public GitHub repository URL' : '',
      !hasDemo && taskNumber > 1 ? 'Live project deployment URL not supplied' : '',
      !hasLinkedIn && taskNumber === 1 ? 'LinkedIn announcement post link missing' : ''
    ].filter(Boolean),
    detectedIssues: [
      !hasRepo && taskNumber > 1 ? 'Cannot inspect code architecture without repository URL' : '',
      !hasContent ? 'Limited technical documentation and notes' : ''
    ].filter(Boolean),
    improvementSuggestions: [
      'Add comprehensive automated unit test coverage',
      'Provide clear README setup and execution instructions',
      'Demonstrate error handling across network edge cases'
    ],
    confidence: 0.92,
    status,
    evaluatedAt: new Date().toISOString(),
    evaluatorType: 'AI' as const,
    earnedPoints
  };
}

// -------------------------------------------------------------
// API ROUTES
// -------------------------------------------------------------

// SSE Live Events Stream for instant zero-delay updates across admin and student dashboards
app.get('/api/live-events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  sseClients.add(res);
  res.write(`event: connected\ndata: ${JSON.stringify({ time: Date.now(), activeSubmissions: submissionsStore.size })}\n\n`);

  const keepAlive = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(keepAlive);
      sseClients.delete(res);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
});

// Helper to accurately compare domain identifiers and names without generic string collisions
function serverIsSameDomain(domainA?: string, domainB?: string, nameA?: string, nameB?: string): boolean {
  if (!domainA && !domainB && !nameA && !nameB) return true;
  const normalize = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanA = [normalize(domainA), normalize(nameA)].filter(Boolean);
  const cleanB = [normalize(domainB), normalize(nameB)].filter(Boolean);
  if (!cleanA.length && !cleanB.length) return true;
  if (!cleanA.length || !cleanB.length) return false;

  const aliases: Record<string, string[]> = {
    webdev: ['webdevelopment', 'fullstackweb', 'fullstackwebdevelopment', 'webdev'],
    webdevelopment: ['webdev', 'fullstackweb', 'fullstackwebdevelopment'],
    aiml: ['artificialintelligenceandmachinelearning', 'machinelearning', 'ai', 'aiml'],
    artificialintelligenceandmachinelearning: ['aiml', 'machinelearning', 'ai'],
    datascience: ['datascienceanddataanalytics', 'dataanalytics'],
    datascienceanddataanalytics: ['datascience', 'dataanalytics'],
    cybersecurity: ['cybersecurity', 'infosec'],
    appdev: ['appdevelopment', 'mobileappdevelopment', 'mobiledevelopment'],
    appdevelopment: ['appdev', 'mobileappdevelopment'],
    uiux: ['uiuxdesign', 'productdesign'],
    uiuxdesign: ['uiux', 'productdesign'],
    businessanalytics: ['businessanalytics', 'businessintelligence'],
    cloudcomputing: ['cloudcomputing', 'clouddevops'],
    iot: ['internetofthings', 'iot'],
    internetofthings: ['iot', 'internetofthings'],
    digitalmarketing: ['digitalmarketing', 'growthmarketing'],
    softwareengineering: ['softwareengineering', 'softwaredevelopment'],
    pythondev: ['pythonprogramming', 'pythondevelopment', 'python'],
    pythonprogramming: ['pythondev', 'pythondevelopment', 'python'],
    javadev: ['javaprogramming', 'javadevelopment', 'java'],
    javaprogramming: ['javadev', 'javadevelopment', 'java'],
    databasemanagement: ['databasemanagement', 'dbms', 'databases'],
    blockchaindev: ['blockchaindevelopment', 'blockchain', 'web3'],
    graphicdesign: ['graphicdesign', 'visualdesign'],
    contentcreation: ['contentcreation', 'creativemedia'],
    fintech: ['financeandfintech', 'finance', 'fintech'],
    hrmanagement: ['humanresourcesandmanagement', 'hr', 'humanresources'],
    entrepreneurship: ['entrepreneurshipandbusinessdevelopment', 'businessdevelopment'],
    eceengineering: ['electronicsandcommunication', 'ece', 'electronicsandcommunicationengineering']
  };

  const genericStopWords = new Set(['virtualinternship', 'internship', 'tech', 'general', 'default', 'foundation', 'development', 'engineering']);

  for (const a of cleanA) {
    if (genericStopWords.has(a)) continue;
    for (const b of cleanB) {
      if (genericStopWords.has(b)) continue;
      if (a === b) return true;
      const listA = aliases[a] || [];
      if (listA.includes(b)) return true;
      const listB = aliases[b] || [];
      if (listB.includes(a)) return true;
    }
  }
  return false;
}

// Helper to strictly reconcile internship milestones with approved submissions in submissionsStore
function reconcileInternshipWithSubmissions(internship: InternshipStoreItem): InternshipStoreItem {
  if (!internship || !internship.userId) return internship;

  // Approved submissions strictly required to mark any task complete
  const approvedTaskNumbers = Array.from(submissionsStore.values())
    .filter(s =>
      s.userId === internship.userId &&
      serverIsSameDomain(s.domainId, internship.domainId, s.domainName, internship.domainName) &&
      s.status === 'approved'
    )
    .map(s => Number(s.taskNumber || 1));

  const validCompletedTasks = Array.from(new Set(approvedTaskNumbers.filter(n => n >= 1 && n <= 5))).sort((a, b) => a - b);
  const task1Done = validCompletedTasks.includes(1);
  const progress = validCompletedTasks.length * 20;
  const currentTask = validCompletedTasks.length >= 5 ? 5 : (validCompletedTasks.length > 0 ? Math.min(5, Math.max(...validCompletedTasks) + 1) : 1);

  return {
    ...internship,
    completedTasks: validCompletedTasks,
    task1VerificationCompleted: task1Done,
    progress,
    currentTask,
    status: progress >= 100 ? 'completed' : (internship.status || 'active')
  };
}

// GET & POST Internships for persistent server storage across sessions & refreshes
app.get('/api/internships', (req, res) => {
  try {
    const { userId, domainId } = req.query;
    if (!userId) {
      const list = Array.from(internshipsStore.values()).map(reconcileInternshipWithSubmissions);
      return res.json({ success: true, internships: list });
    }
    const uid = String(userId);
    const userInternships = Array.from(internshipsStore.values())
      .filter(i => i.userId === uid)
      .map(reconcileInternshipWithSubmissions);

    if (domainId) {
      const did = String(domainId);
      const matched = userInternships.find(i => i.domainId === did || serverIsSameDomain(i.domainId, did, i.domainName, did));
      return res.json({ success: true, internship: matched || null });
    }
    const direct = internshipsStore.get(uid);
    const resolvedDirect = direct ? reconcileInternshipWithSubmissions(direct) : (userInternships[0] || null);
    return res.json({ success: true, internship: resolvedDirect, internships: userInternships });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch internship' });
  }
});

app.post('/api/internships', (req, res) => {
  try {
    const internship = req.body;
    if (!internship || !internship.userId) {
      return res.status(400).json({ error: 'Internship object with userId is required' });
    }
    const uid = String(internship.userId);
    const domId = String(internship.domainId || 'default');
    const key = `${uid}_${domId}`;

    const rawNormalized: InternshipStoreItem = {
      ...internship,
      id: internship.id || key,
      userId: uid,
      domainId: domId,
      progress: typeof internship.progress === 'number' ? internship.progress : 0,
      currentTask: typeof internship.currentTask === 'number' ? internship.currentTask : 1,
      completedTasks: Array.isArray(internship.completedTasks) ? internship.completedTasks : [],
      task1VerificationCompleted: Boolean(internship.task1VerificationCompleted),
      updatedAt: new Date().toISOString()
    };

    // Strictly reconcile so no unapproved tasks are marked completed
    const normalized = reconcileInternshipWithSubmissions(rawNormalized);

    internshipsStore.set(key, normalized);
    internshipsStore.set(uid, normalized);
    saveJsonFile('internships.json', Object.fromEntries(internshipsStore));

    // Ensure student record exists in usersStore with active domain
    if (!usersStore.has(uid) && !isServerAuthorizedAdmin(uid, internship.userEmail)) {
      const nowIso = new Date().toISOString();
      const email = String(internship.userEmail || '').trim().toLowerCase();
      const studentItem: UserStoreItem = {
        uid,
        name: internship.userName || (email ? email.split('@')[0] : 'Intern'),
        email,
        role: 'student',
        selectedDomain: normalized.domainName || domId,
        internshipStatus: normalized.progress >= 100 ? 'completed' : 'active',
        progress: normalized.progress,
        agreementAccepted: true,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      usersStore.set(uid, studentItem);
      saveJsonFile('users.json', Object.fromEntries(usersStore));
      broadcastEvent('user_updated', studentItem);
    }

    broadcastEvent('internship_updated', normalized);
    return res.json({ success: true, internship: normalized });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to save internship' });
  }
});

// 1. Submit Task (Queued for Manual Admin Verification)
app.post('/api/evaluations/submit-and-evaluate', async (req, res) => {
  try {
    const { task, submission } = req.body || {};
    if (!task || !submission) {
      return res.status(400).json({ error: 'Both task and submission objects are required.' });
    }

    const submissionId = String(submission.submissionId || submission.id || `sub_${Date.now()}`);
    const userId = String(submission.userId || '');
    const storedUser = usersStore.get(userId);
    const userName = String((submission.userName && submission.userName !== 'Intern' ? submission.userName : '') || storedUser?.name || 'Intern');
    const userEmail = String(submission.userEmail || storedUser?.email || '');
    const taskId = String(task.taskId || task.id || `task-${task.taskNumber || 1}`);
    const taskNumber = Number(task.taskNumber || submission.taskNumber || 1);
    const domainId = String(task.domainId || submission.domainId || 'general');
    const domainName = String(task.domain || task.domainName || submission.domainName || 'Virtual Internship');

    // Clean up any older/previous submission for this exact user, taskNumber, and domain
    for (const [key, item] of submissionsStore.entries()) {
      if (item.userId === userId && Number(item.taskNumber) === taskNumber && serverIsSameDomain(item.domainId, domainId, item.domainName, domainName)) {
        submissionsStore.delete(key);
      }
    }

    // Save submission state as 'submitted' for manual admin verification
    const projectTitle = String(task.title || submission.projectTitle || `Task ${taskNumber}`);
    const subItem: SubmissionStoreItem = {
      ...submission,
      submissionId,
      id: submissionId,
      userId,
      userName,
      userEmail,
      taskId,
      domainId,
      domainName,
      taskNumber,
      projectTitle,
      submittedAt: submission.submittedAt || new Date().toISOString(),
      submissionType: submission.submissionType || 'all',
      content: submission.content || submission.textResponse || '',
      githubUrl: submission.githubUrl || submission.repositoryURL || '',
      repositoryURL: submission.repositoryURL || submission.githubUrl || '',
      projectUrl: submission.projectUrl || submission.demoURL || '',
      demoURL: submission.demoURL || submission.projectUrl || '',
      driveURL: submission.driveURL || '',
      pdfUrl: submission.pdfUrl || '',
      fileUrls: submission.fileUrls || (submission.fileName ? [submission.fileName] : []),
      notes: submission.notes || '',
      attemptNumber: submission.attemptNumber || 1,
      status: 'submitted', // ALWAYS queued for manual admin verification on new submission
      youtubeProofText: submission.youtubeProofText || submission.youtubeSubscribeProof || '',
      youtubeSubscribeProof: submission.youtubeSubscribeProof || submission.youtubeProofText || '',
      youtubeScreenshotUrl: submission.youtubeScreenshotUrl || '',
      youtubeScreenshotFileName: submission.youtubeScreenshotFileName || '',
      offerLetterFileName: submission.offerLetterFileName || '',
      offerLetterUrl: submission.offerLetterUrl || '',
      socialProofUrl: submission.socialProofUrl || submission.linkedinProofUrl || '',
      linkedinProofUrl: submission.linkedinProofUrl || submission.socialProofUrl || '',
      linkedinVerified: submission.linkedinVerified ?? true,
      youtubeChannelChecked: submission.youtubeChannelChecked ?? true,
      level: submission.level || task.difficulty || 'Intermediate',
      isManuallyVerified: false,
      rubricScore: undefined,
      adminFeedback: undefined,
      reviewedBy: undefined,
      reviewedAt: undefined
    } as any;

    submissionsStore.set(subItem.submissionId, subItem);
    saveJsonFile('submissions.json', Object.fromEntries(submissionsStore));

    // Ensure student exists in usersStore immediately upon submission so Admin Roster & Queue always reflect real student
    if (userId && !isServerAuthorizedAdmin(userId, userEmail)) {
      const nowIso = new Date().toISOString();
      const existingStudent = usersStore.get(userId);
      if (!existingStudent) {
        const newStudent: UserStoreItem = {
          uid: userId,
          name: userName !== 'Intern' ? userName : (userEmail ? userEmail.split('@')[0] : 'Intern'),
          email: userEmail.toLowerCase().trim(),
          role: 'student',
          selectedDomain: domainName || domainId,
          internshipStatus: 'active',
          progress: 0,
          agreementAccepted: true,
          createdAt: nowIso,
          updatedAt: nowIso
        };
        usersStore.set(userId, newStudent);
        saveJsonFile('users.json', Object.fromEntries(usersStore));
        broadcastEvent('user_updated', newStudent);
      } else {
        let changed = false;
        if ((!existingStudent.name || existingStudent.name === 'Student' || existingStudent.name === 'Intern') && userName && userName !== 'Intern') {
          existingStudent.name = userName;
          changed = true;
        }
        if (!existingStudent.selectedDomain && (domainName || domainId)) {
          existingStudent.selectedDomain = domainName || domainId;
          changed = true;
        }
        if (!existingStudent.internshipStatus || existingStudent.internshipStatus === 'none') {
          existingStudent.internshipStatus = 'active';
          changed = true;
        }
        if (changed) {
          existingStudent.updatedAt = nowIso;
          usersStore.set(userId, existingStudent);
          saveJsonFile('users.json', Object.fromEntries(usersStore));
          broadcastEvent('user_updated', existingStudent);
        }
      }
    }

    // Update persistent student internship record without auto-completing Task 1
    const intKey = `${userId}_${domainId}`;
    let existingInt = internshipsStore.get(intKey);
    if (!existingInt) {
      existingInt = {
        id: intKey,
        userId,
        domainId,
        domainName,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        status: 'active',
        progress: 0,
        currentTask: 1,
        completedTasks: [],
        task1VerificationCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    } else {
      existingInt.task1VerificationCompleted = existingInt.task1VerificationCompleted || false;
      existingInt.updatedAt = new Date().toISOString();
    }
    existingInt = reconcileInternshipWithSubmissions(existingInt);
    internshipsStore.set(intKey, existingInt);
    internshipsStore.set(userId, existingInt);
    saveJsonFile('internships.json', Object.fromEntries(internshipsStore));

    // Broadcast instant real-time event to Admin Portal and all clients
    broadcastEvent('submission_created', subItem);
    broadcastEvent('submission_updated', subItem);
    broadcastEvent('internship_updated', existingInt);

    return res.json({
      success: true,
      message: 'Submission successfully received and queued for manual admin verification.',
      submission: subItem,
      internship: existingInt
    });
  } catch (error: any) {
    console.error('Submit task error:', error);
    return res.status(500).json({ error: error.message || 'Task submission failed' });
  }
});

// GET All Submissions (For Admin Verification Queue and Intern Dashboard)
app.get('/api/submissions', (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const { userId } = req.query;
    let all = Array.from(submissionsStore.values()).map(s => {
      const u = usersStore.get(s.userId);
      const id = (s as any).id || s.submissionId;
      return {
        ...s,
        id,
        submissionId: s.submissionId || id,
        userName: (s.userName && s.userName !== 'Intern') ? s.userName : (u?.name || s.userName || 'Intern'),
        userEmail: s.userEmail || u?.email || '',
        status: s.status || 'submitted',
        taskNumber: Number(s.taskNumber || 1)
      };
    });
    if (userId) {
      all = all.filter(s => s.userId === String(userId));
    }
    all.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    return res.json({ success: true, submissions: all });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch submissions' });
  }
});

// Dedicated Admin Queue Submissions Endpoint
app.get('/api/admin/submissions', (_req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const all = Array.from(submissionsStore.values()).map(s => {
      const u = usersStore.get(s.userId);
      const id = (s as any).id || s.submissionId;
      return {
        ...s,
        id,
        submissionId: s.submissionId || id,
        userName: (s.userName && s.userName !== 'Intern') ? s.userName : (u?.name || s.userName || 'Intern'),
        userEmail: s.userEmail || u?.email || '',
        status: s.status || 'submitted',
        taskNumber: Number(s.taskNumber || 1)
      };
    });
    all.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    return res.json({ success: true, submissions: all });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch admin submissions' });
  }
});

// Direct Submission Save Endpoint
app.post('/api/submissions', (req, res) => {
  try {
    const submission = req.body;
    if (!submission || !submission.userId) {
      return res.status(400).json({ error: 'Submission payload with userId is required' });
    }
    const submissionId = String(submission.submissionId || submission.id || `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
    const existing = submissionsStore.get(submissionId);

    // Clean up older duplicate for this user, taskNumber, and domain
    for (const [key, item] of submissionsStore.entries()) {
      if (
        item.userId === submission.userId &&
        Number(item.taskNumber) === Number(submission.taskNumber) &&
        serverIsSameDomain(item.domainId, submission.domainId, item.domainName, submission.domainName) &&
        key !== submissionId
      ) {
        submissionsStore.delete(key);
      }
    }

    const storedUser = usersStore.get(String(submission.userId));
    const resolvedName = (submission.userName && submission.userName !== 'Intern' ? submission.userName : '') || existing?.userName || storedUser?.name || 'Intern';
    const resolvedEmail = submission.userEmail || existing?.userEmail || storedUser?.email || '';
    const subItem: any = {
      ...(existing || {}),
      ...submission,
      id: submissionId,
      submissionId,
      userName: resolvedName,
      userEmail: resolvedEmail,
      taskNumber: Number(submission.taskNumber || existing?.taskNumber || 1),
      status: existing?.isManuallyVerified ? existing.status : (submission.status || 'submitted'),
      submittedAt: submission.submittedAt || existing?.submittedAt || new Date().toISOString(),
      isManuallyVerified: existing?.isManuallyVerified ?? (typeof submission.isManuallyVerified === 'boolean' ? submission.isManuallyVerified : false)
    };
    submissionsStore.set(submissionId, subItem);
    saveJsonFile('submissions.json', Object.fromEntries(submissionsStore));

    if (!storedUser && !isServerAuthorizedAdmin(String(submission.userId), resolvedEmail)) {
      const nowIso = new Date().toISOString();
      const newStudent: UserStoreItem = {
        uid: String(submission.userId),
        name: resolvedName !== 'Intern' ? resolvedName : (resolvedEmail ? resolvedEmail.split('@')[0] : 'Intern'),
        email: resolvedEmail.toLowerCase().trim(),
        role: 'student',
        selectedDomain: submission.domainName || submission.domainId,
        internshipStatus: 'active',
        progress: 0,
        agreementAccepted: true,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      usersStore.set(newStudent.uid, newStudent);
      saveJsonFile('users.json', Object.fromEntries(usersStore));
      broadcastEvent('user_updated', newStudent);
    }

    broadcastEvent('submission_created', subItem);
    broadcastEvent('submission_updated', subItem);
    return res.json({ success: true, submission: subItem });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Merge submissions synced from Firestore / client session into server store without clobbering verified state
app.post('/api/submissions/sync', (req, res) => {
  try {
    const incoming = Array.isArray(req.body?.submissions) ? req.body.submissions : [];
    let syncedCount = 0;
    for (const raw of incoming) {
      if (!raw || !raw.userId) continue;
      const canonicalId = String(raw.submissionId || raw.id || `sub_${raw.userId}_${raw.taskNumber || 1}`);
      const existing = submissionsStore.get(canonicalId);
      const rawTime = new Date(raw.reviewedAt || raw.submittedAt || 0).getTime();
      const existingTime = existing ? new Date(existing.reviewedAt || existing.submittedAt || 0).getTime() : -1;

      const rawVerified = Boolean(raw.isManuallyVerified || raw.status === 'approved' || raw.status === 'rejected' || raw.status === 'revision_required');
      const existingVerified = Boolean(existing && (existing.isManuallyVerified || existing.status === 'approved' || existing.status === 'rejected' || existing.status === 'revision_required'));

      if (!existing || (rawVerified && !existingVerified) || (rawTime > existingTime && (!existingVerified || rawVerified))) {
        submissionsStore.set(canonicalId, {
          ...(existing || {}),
          ...raw,
          id: canonicalId,
          submissionId: canonicalId,
          taskNumber: Number(raw.taskNumber || existing?.taskNumber || 1),
          status: raw.status || existing?.status || 'submitted'
        });
        syncedCount++;
      }
    }
    if (syncedCount > 0) {
      saveJsonFile('submissions.json', Object.fromEntries(submissionsStore));
    }
    return res.json({ success: true, syncedCount, total: submissionsStore.size });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Manual Task Verification & Score Assignment Route
app.post('/api/admin/verify-submission', (req, res) => {
  try {
    const {
      adminId,
      adminName,
      submissionId,
      score,
      status, // 'approved' | 'revision_required' | 'rejected'
      feedback,
      difficulty
    } = req.body || {};

    if (!adminId || !submissionId || score === undefined || !status) {
      return res.status(400).json({ error: 'adminId, submissionId, score, and status are required.' });
    }

    let sub = submissionsStore.get(submissionId);
    if (!sub) {
      for (const item of submissionsStore.values()) {
        if ((item as any).id === submissionId || item.submissionId === submissionId) {
          sub = item;
          break;
        }
      }
    }
    if (!sub && req.body.userId && req.body.taskNumber) {
      for (const item of submissionsStore.values()) {
        if (
          item.userId === req.body.userId &&
          Number(item.taskNumber) === Number(req.body.taskNumber) &&
          (!req.body.domainId || serverIsSameDomain(item.domainId, req.body.domainId, item.domainName, req.body.domainId))
        ) {
          sub = item;
          break;
        }
      }
    }
    if (!sub && req.body.submission) {
      sub = {
        ...req.body.submission,
        submissionId,
        id: submissionId
      } as SubmissionStoreItem;
      submissionsStore.set(submissionId, sub);
    }
    if (!sub) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const canonicalSubId = sub.submissionId || (sub as any).id || submissionId;
    const storedUser = usersStore.get(sub.userId);
    if (storedUser?.name && (!sub.userName || sub.userName === 'Intern')) {
      sub.userName = storedUser.name;
    }

    const finalScore = Math.max(0, Math.min(100, Number(score)));
    const finalStatus: 'passed' | 'revision_required' = status === 'approved' ? 'passed' : 'revision_required';
    const taskDiff = difficulty || (sub as any).level || 'Intermediate';
    const earnedPoints = computeEarnedPoints(finalScore, taskDiff, status === 'approved');

    // Create or update evaluation record
    const evalId = sub.evaluationId || `eval_${canonicalSubId}`;
    sub.evaluationId = evalId;

    // Update submission
    sub.status = status;
    sub.rubricScore = finalScore;
    (sub as any).level = taskDiff;
    sub.adminFeedback = feedback || (status === 'approved' ? 'Approved after manual admin verification.' : 'Revision required by admin mentor.');
    sub.reviewedBy = adminName || adminId;
    sub.reviewedAt = new Date().toISOString();
    sub.isManuallyVerified = true;
    (sub as any).id = canonicalSubId;
    sub.submissionId = canonicalSubId;
    submissionsStore.set(canonicalSubId, sub);
    saveJsonFile('submissions.json', Object.fromEntries(submissionsStore));

    const evaluationItem: EvaluationStoreItem = {
      evaluationId: evalId,
      submissionId: canonicalSubId,
      userId: sub.userId,
      userName: sub.userName,
      userEmail: sub.userEmail,
      taskId: sub.taskId,
      taskNumber: sub.taskNumber,
      domainId: sub.domainId,
      domainName: sub.domainName,
      difficulty: taskDiff,
      totalScore: finalScore,
      criteriaScores: {
        functionality: Math.round(finalScore * 0.35),
        requirements: Math.round(finalScore * 0.25),
        quality: Math.round(finalScore * 0.20),
        documentation: Math.round(finalScore * 0.10),
        errorHandling: Math.round(finalScore * 0.05),
        originality: Math.round(finalScore * 0.05)
      },
      requirementResults: [
        {
          requirement: 'Manual Admin Verification',
          status: status === 'approved' ? 'verified' : 'unmet',
          feedback: sub.adminFeedback || 'Verified by admin'
        }
      ],
      strengths: status === 'approved' ? [sub.adminFeedback || 'All deliverables manually verified and accepted by administrator'] : [],
      weaknesses: status !== 'approved' ? [sub.adminFeedback || 'Milestone revision required'] : [],
      detectedIssues: [],
      improvementSuggestions: [sub.adminFeedback || 'Continue following internship milestones'],
      confidence: 1.0,
      status: finalStatus,
      evaluatedAt: new Date().toISOString(),
      evaluatorType: 'ADMIN_OVERRIDE',
      earnedPoints,
      adminOverride: {
        adminId,
        previousScore: 0,
        newScore: finalScore,
        reason: feedback || 'Manual verification by administrator',
        overriddenAt: new Date().toISOString()
      }
    };

    evaluationsStore.set(evalId, evaluationItem);
    saveJsonFile('evaluations.json', Object.fromEntries(evaluationsStore));

    // Record Audit Log
    const auditLog: AuditLogStoreItem = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      adminId,
      action: 'ADMIN_MANUAL_VERIFICATION',
      targetType: 'SUBMISSION',
      targetId: canonicalSubId,
      newScore: finalScore,
      reason: feedback || `Admin manually marked as ${status} with score ${finalScore}/100`,
      timestamp: new Date().toISOString(),
      metadata: {
        userId: sub.userId,
        userName: sub.userName,
        taskNumber: sub.taskNumber,
        status,
        earnedPoints
      }
    };
    auditLogsStore.unshift(auditLog);
    saveJsonFile('audit_logs.json', auditLogsStore);

    // Recalculate real users leaderboard
    const updatedLeaderboard = recalculateLeaderboard();

    // Update persistent student internship progress strictly reconciled with approved submissions
    const intKey = `${sub.userId}_${sub.domainId || 'default'}`;
    let userInt = internshipsStore.get(intKey) || internshipsStore.get(sub.userId);
    if (!userInt) {
      userInt = {
        id: intKey,
        userId: sub.userId,
        domainId: sub.domainId || 'general',
        domainName: sub.domainName || 'Virtual Internship',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        status: 'active',
        progress: 0,
        currentTask: 1,
        completedTasks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
    userInt = reconcileInternshipWithSubmissions({
      ...userInt,
      updatedAt: new Date().toISOString()
    });
    internshipsStore.set(intKey, userInt);
    internshipsStore.set(sub.userId, userInt);
    saveJsonFile('internships.json', Object.fromEntries(internshipsStore));
    broadcastEvent('internship_updated', userInt);

    // Ensure student exists in usersStore so leaderboard and roster stay complete across instances
    let targetUser = usersStore.get(sub.userId);
    if (!targetUser && sub.userId && !isServerAuthorizedAdmin(sub.userId, sub.userEmail)) {
      const nowIso = new Date().toISOString();
      targetUser = {
        uid: sub.userId,
        name: sub.userName || (sub.userEmail ? sub.userEmail.split('@')[0] : 'Intern'),
        email: sub.userEmail || '',
        role: 'student',
        selectedDomain: sub.domainName || sub.domainId,
        internshipStatus: userInt.progress >= 100 ? 'completed' : 'active',
        progress: userInt.progress,
        agreementAccepted: true,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      usersStore.set(sub.userId, targetUser);
      saveJsonFile('users.json', Object.fromEntries(usersStore));
      broadcastEvent('user_updated', targetUser);
    } else if (targetUser) {
      targetUser.progress = userInt.progress;
      targetUser.internshipStatus = userInt.progress >= 100 ? 'completed' : 'active';
      targetUser.updatedAt = new Date().toISOString();
      usersStore.set(sub.userId, targetUser);
      saveJsonFile('users.json', Object.fromEntries(usersStore));
      broadcastEvent('user_updated', targetUser);
    }

    // Recompute leaderboard AFTER targetUser is guaranteed up to date
    const refreshedLeaderboard = recalculateLeaderboard();

    // Broadcast instant real-time events to all connected portals
    broadcastEvent('submission_updated', sub);
    broadcastEvent('submission_verified', { submission: sub, evaluation: evaluationItem, leaderboard: refreshedLeaderboard });
    broadcastEvent('leaderboard_updated', refreshedLeaderboard);

    return res.json({
      success: true,
      submission: sub,
      evaluation: evaluationItem,
      auditLog,
      internship: userInt,
      leaderboard: refreshedLeaderboard
    });
  } catch (error: any) {
    console.error('Admin manual verification error:', error);
    return res.status(500).json({ error: error.message || 'Manual verification failed' });
  }
});

// Backward-compatible alias for existing code
app.post('/api/gemini/evaluate-task', async (req, res) => {
  try {
    const { task, submission } = req.body || {};
    const evaluation = await performEvaluation(task, submission);

    const subItem: SubmissionStoreItem = {
      submissionId: evaluation.submissionId,
      userId: evaluation.userId,
      userName: evaluation.userName,
      userEmail: evaluation.userEmail,
      taskId: evaluation.taskId,
      domainId: evaluation.domainId,
      domainName: evaluation.domainName,
      taskNumber: evaluation.taskNumber,
      submittedAt: new Date().toISOString(),
      submissionType: submission?.submissionType || 'all',
      content: submission?.content || submission?.textResponse || '',
      githubUrl: submission?.githubUrl || submission?.repositoryURL || '',
      projectUrl: submission?.projectUrl || submission?.demoURL || '',
      fileUrls: submission?.fileUrls || [],
      attemptNumber: submission?.attemptNumber || 1,
      status: evaluation.status === 'passed' ? 'passed' : 'revision_required',
      evaluationId: evaluation.evaluationId
    };

    submissionsStore.set(subItem.submissionId, subItem);
    evaluationsStore.set(evaluation.evaluationId, evaluation);
    recalculateLeaderboard();

    return res.json({
      success: true,
      evaluation: {
        ...evaluation,
        score: evaluation.totalScore,
        grade: evaluation.totalScore >= 90 ? 'A+' : evaluation.totalScore >= 80 ? 'A' : evaluation.totalScore >= 70 ? 'B+' : 'B',
        summary: `Score: ${evaluation.totalScore}/100 • Status: ${evaluation.status.toUpperCase()} • Earned Points: ${evaluation.earnedPoints}`,
        breakdown: {
          codeArchitecture: evaluation.criteriaScores?.quality || Math.round(evaluation.totalScore * 0.2),
          deliverableCompleteness: evaluation.criteriaScores?.requirements || Math.round(evaluation.totalScore * 0.25),
          practicalImplementation: evaluation.criteriaScores?.functionality || Math.round(evaluation.totalScore * 0.3),
          documentationAndReadiness: evaluation.criteriaScores?.documentation || Math.round(evaluation.totalScore * 0.1)
        },
        recommendations: evaluation.improvementSuggestions
      }
    });
  } catch (error: any) {
    console.error('Task evaluation error:', error);
    return res.status(500).json({ error: error.message || 'Evaluation process failed' });
  }
});

// 2. Get All Evaluations (Admin) & Evaluations for a User
app.get('/api/evaluations', (_req, res) => {
  const list = Array.from(evaluationsStore.values())
    .sort((a, b) => new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime());
  return res.json({ success: true, evaluations: list });
});

app.get('/api/evaluations/user/:userId', (req, res) => {
  const { userId } = req.params;
  const list = Array.from(evaluationsStore.values())
    .filter(e => e.userId === userId)
    .sort((a, b) => new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime());
  return res.json({ success: true, evaluations: list });
});

// 3. Get Evaluation by ID
app.get('/api/evaluations/:evaluationId', (req, res) => {
  const { evaluationId } = req.params;
  const evaluation = evaluationsStore.get(evaluationId);
  if (!evaluation) {
    return res.status(404).json({ error: 'Evaluation not found' });
  }
  return res.json({ success: true, evaluation });
});

// 4. Get Evaluation by Submission ID
app.get('/api/evaluations/submission/:submissionId', (req, res) => {
  const { submissionId } = req.params;
  const evaluation = Array.from(evaluationsStore.values()).find(e => e.submissionId === submissionId);
  if (!evaluation) {
    return res.status(404).json({ error: 'Evaluation for submission not found' });
  }
  return res.json({ success: true, evaluation });
});

// 5. Get Public Leaderboard with Filters (overall, weekly, monthly, domain)
app.get('/api/leaderboard', (req, res) => {
  const filter = String(req.query.filter || 'overall'); // overall, weekly, monthly
  const domainId = String(req.query.domainId || '');

  let entries = recalculateLeaderboard();

  if (domainId && domainId !== 'all') {
    entries = entries.filter(e =>
      serverIsSameDomain(e.domainId, domainId, e.domainName, domainId)
    );
  }

  // Adjust score for weekly / monthly if filtered
  if (filter === 'weekly') {
    entries = entries.map(e => ({
      ...e,
      totalPoints: e.weeklyPoints ?? 0
    })).filter(e => e.totalPoints > 0).sort((a, b) => b.totalPoints - a.totalPoints);
  } else if (filter === 'monthly') {
    entries = entries.map(e => ({
      ...e,
      totalPoints: e.monthlyPoints ?? e.totalPoints
    })).filter(e => e.totalPoints > 0).sort((a, b) => b.totalPoints - a.totalPoints);
  }

  // Re-index ranks
  entries.forEach((e, idx) => {
    e.rank = idx + 1;
  });

  return res.json({ success: true, leaderboard: entries, updatedAt: new Date().toISOString() });
});

// 5b. Get Authoritative Domain Cohort Leaderboard (real enrolled & verified students only)
app.get('/api/domain-leaderboard', (req, res) => {
  try {
    const domainId = String(req.query.domainId || '');
    const currentUserId = req.query.currentUserId ? String(req.query.currentUserId) : undefined;

    if (!domainId) {
      return res.status(400).json({ error: 'domainId is required' });
    }

    const userStats = new Map<string, {
      userId: string;
      userName: string;
      userEmail?: string;
      userPhoto?: string;
      completedTasks: Set<number>;
      scores: number[];
      totalPoints: number;
      lastActive: string;
      domainName?: string;
    }>();

    // Aggregate from approved submissions & matching evaluations
    for (const sub of submissionsStore.values()) {
      if (sub.status !== 'approved') continue;
      if (!serverIsSameDomain(sub.domainId, domainId, sub.domainName, domainId)) continue;

      const regUser = usersStore.get(sub.userId);
      if (regUser?.role === 'admin' || regUser?.role === 'company' || isServerAuthorizedAdmin(sub.userId, sub.userEmail || regUser?.email)) {
        continue;
      }

      if (!userStats.has(sub.userId)) {
        userStats.set(sub.userId, {
          userId: sub.userId,
          userName: regUser?.name || sub.userName || 'Intern',
          userEmail: regUser?.email || sub.userEmail,
          userPhoto: regUser?.photoURL,
          completedTasks: new Set<number>(),
          scores: [],
          totalPoints: 0,
          lastActive: sub.reviewedAt || sub.submittedAt,
          domainName: sub.domainName
        });
      }

      const stat = userStats.get(sub.userId)!;
      const tNum = Number(sub.taskNumber || 1);
      if (!stat.completedTasks.has(tNum)) {
        stat.completedTasks.add(tNum);
        const evalRec = (sub.evaluationId ? evaluationsStore.get(sub.evaluationId) : undefined) ||
          Array.from(evaluationsStore.values()).find(e => e.submissionId === sub.submissionId);
        const score = Number(sub.rubricScore ?? evalRec?.totalScore ?? 85);
        const pts = evalRec?.earnedPoints ?? computeEarnedPoints(score, (sub as any).level || 'Intermediate', true);
        stat.scores.push(score);
        stat.totalPoints += pts;
        const ts = new Date(sub.reviewedAt || sub.submittedAt).getTime();
        if (ts > new Date(stat.lastActive).getTime()) {
          stat.lastActive = sub.reviewedAt || sub.submittedAt;
        }
      }
    }

    // If currentUserId is a real non-admin student actively enrolled in this domain, show their 0-pt standing
    if (currentUserId && !userStats.has(currentUserId)) {
      const regUser = usersStore.get(currentUserId);
      const isStudent = !regUser || (regUser.role !== 'admin' && regUser.role !== 'company');
      if (isStudent && !isServerAuthorizedAdmin(currentUserId, regUser?.email)) {
        const enrolledMatch = Array.from(internshipsStore.values()).find(
          i => i.userId === currentUserId && serverIsSameDomain(i.domainId, domainId, i.domainName, domainId)
        );
        if (enrolledMatch || (regUser?.selectedDomain && serverIsSameDomain(regUser.selectedDomain, domainId, regUser.selectedDomain, domainId))) {
          userStats.set(currentUserId, {
            userId: currentUserId,
            userName: regUser?.name || 'You',
            userEmail: regUser?.email,
            userPhoto: regUser?.photoURL,
            completedTasks: new Set<number>(),
            scores: [],
            totalPoints: 0,
            lastActive: new Date().toISOString(),
            domainName: enrolledMatch?.domainName || domainId
          });
        }
      }
    }

    const entries = Array.from(userStats.values()).map(stat => {
      const count = stat.completedTasks.size;
      const sumScores = stat.scores.reduce((a, b) => a + b, 0);
      const avg = stat.scores.length > 0 ? Math.round(sumScores / stat.scores.length) : 0;
      const best = stat.scores.length > 0 ? Math.max(...stat.scores) : 0;

      let levelBadge = 'Rising Intern 🌱';
      if (count === 5 && avg >= 92) levelBadge = 'Grandmaster 🏆';
      else if (count >= 4) levelBadge = 'Elite Architect 🌟';
      else if (count >= 3) levelBadge = 'Senior Fellow ⚡';
      else if (count >= 2) levelBadge = 'Core Builder 🚀';

      return {
        rank: 0,
        userId: stat.userId,
        userName: stat.userName,
        userEmail: stat.userEmail,
        userPhoto: stat.userPhoto,
        domainId,
        domainName: stat.domainName || domainId,
        totalScore: stat.totalPoints,
        completedTasksCount: count,
        averageScore: avg,
        bestTaskScore: best,
        levelBadge,
        statusText: count === 5 ? '100% Completed' : `Milestone ${count} of 5`,
        isCurrentUser: stat.userId === currentUserId,
        lastActive: stat.lastActive
      };
    });

    entries.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.completedTasksCount !== a.completedTasksCount) return b.completedTasksCount - a.completedTasksCount;
      return b.averageScore - a.averageScore;
    });

    entries.forEach((e, idx) => {
      e.rank = idx + 1;
    });

    return res.json({ success: true, leaderboard: entries, updatedAt: new Date().toISOString() });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 6. Get User Performance Metrics
app.get('/api/performance/:userId', (req, res) => {
  const { userId } = req.params;
  const leaderboard = recalculateLeaderboard();
  const userEntry = leaderboard.find(l => l.userId === userId);

  const userEvals = Array.from(evaluationsStore.values())
    .filter(e => e.userId === userId)
    .sort((a, b) => new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime());

  const passedEvals = userEvals.filter(e => e.status === 'passed');

  let beginnerCount = 0;
  let intermediateCount = 0;
  let advancedCount = 0;
  for (const ev of passedEvals) {
    const diff = (ev.difficulty || '').toLowerCase();
    if (diff === 'beginner' || diff === 'easy') beginnerCount++;
    else if (diff === 'advanced' || diff === 'hard') advancedCount++;
    else intermediateCount++;
  }

  const performance = {
    userId,
    userName: userEntry?.userName || 'Intern',
    totalPoints: userEntry?.totalPoints || passedEvals.reduce((acc, curr) => acc + curr.earnedPoints, 0),
    currentRank: userEntry?.rank || leaderboard.length + 1,
    tasksCompleted: passedEvals.length,
    averageScore: userEntry?.averageScore || (passedEvals.length > 0 ? Math.round(passedEvals.reduce((acc, curr) => acc + curr.totalScore, 0) / passedEvals.length) : 0),
    beginnerTasks: beginnerCount,
    intermediateTasks: intermediateCount,
    advancedTasks: advancedCount,
    badges: userEntry?.badges || [],
    recentEvaluations: userEvals.slice(0, 5),
    progressOverTime: userEvals.map(e => ({
      taskId: e.taskId,
      taskTitle: e.taskTitle,
      score: e.totalScore,
      points: e.earnedPoints,
      date: e.evaluatedAt,
      status: e.status
    }))
  };

  return res.json({ success: true, performance });
});

// 7. Admin Override AI Score
app.post('/api/admin/override-evaluation', (req, res) => {
  try {
    const {
      adminId,
      evaluationId,
      submissionId,
      newScore,
      reason,
      newStatus
    } = req.body || {};

    if (!adminId || (!evaluationId && !submissionId) || newScore === undefined || !reason) {
      return res.status(400).json({ error: 'adminId, evaluationId or submissionId, newScore, and reason are required.' });
    }

    let evaluation = evaluationId ? evaluationsStore.get(evaluationId) : null;
    if (!evaluation && submissionId) {
      evaluation = Array.from(evaluationsStore.values()).find(e => e.submissionId === submissionId) || null;
    }

    if (!evaluation) {
      return res.status(404).json({ error: 'Evaluation not found' });
    }

    const previousScore = evaluation.totalScore;
    const finalScore = Math.max(0, Math.min(100, Number(newScore)));
    const passingScore = 70;
    const status: 'passed' | 'revision_required' = newStatus || (finalScore >= passingScore ? 'passed' : 'revision_required');
    const earnedPoints = computeEarnedPoints(finalScore, evaluation.difficulty || 'Intermediate', status === 'passed');

    evaluation.totalScore = finalScore;
    evaluation.status = status;
    evaluation.evaluatorType = 'ADMIN_OVERRIDE';
    evaluation.earnedPoints = earnedPoints;
    evaluation.adminOverride = {
      adminId,
      previousScore,
      newScore: finalScore,
      reason,
      overriddenAt: new Date().toISOString()
    };

    evaluationsStore.set(evaluation.evaluationId, evaluation);
    saveJsonFile('evaluations.json', Object.fromEntries(evaluationsStore));

    // Update submission
    const sub = submissionsStore.get(evaluation.submissionId);
    if (sub) {
      sub.status = status === 'passed' ? 'approved' : 'revision_required';
      sub.rubricScore = finalScore;
      sub.adminFeedback = reason;
      sub.isManuallyVerified = true;
      sub.reviewedBy = adminId;
      sub.reviewedAt = new Date().toISOString();
      submissionsStore.set(sub.submissionId, sub);
      saveJsonFile('submissions.json', Object.fromEntries(submissionsStore));

      const intKey = `${sub.userId}_${sub.domainId || 'default'}`;
      const existingInt = internshipsStore.get(intKey) || internshipsStore.get(sub.userId);
      if (existingInt) {
        const reconciled = reconcileInternshipWithSubmissions(existingInt);
        internshipsStore.set(intKey, reconciled);
        internshipsStore.set(sub.userId, reconciled);
        saveJsonFile('internships.json', Object.fromEntries(internshipsStore));
        broadcastEvent('internship_updated', reconciled);
      }
      broadcastEvent('submission_updated', sub);
      broadcastEvent('submission_verified', { submission: sub, evaluation });
    }

    // Record Audit Log
    const auditLog: AuditLogStoreItem = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      adminId,
      action: 'ADMIN_SCORE_OVERRIDE',
      targetType: 'EVALUATION',
      targetId: evaluation.evaluationId,
      previousScore,
      newScore: finalScore,
      reason,
      timestamp: new Date().toISOString(),
      metadata: {
        submissionId: evaluation.submissionId,
        userId: evaluation.userId,
        newStatus: status
      }
    };

    auditLogsStore.unshift(auditLog);
    saveJsonFile('audit_logs.json', auditLogsStore);

    // Recalculate leaderboard and broadcast live
    const updatedLeaderboard = recalculateLeaderboard();
    broadcastEvent('leaderboard_updated', updatedLeaderboard);

    return res.json({
      success: true,
      evaluation,
      auditLog,
      leaderboard: updatedLeaderboard
    });
  } catch (error: any) {
    console.error('Admin override error:', error);
    return res.status(500).json({ error: error.message || 'Admin override failed' });
  }
});

// 8. Admin Flag Suspicious Submission
app.post('/api/admin/flag-submission', (req, res) => {
  try {
    const { adminId, submissionId, reason } = req.body || {};
    if (!adminId || !submissionId || !reason) {
      return res.status(400).json({ error: 'adminId, submissionId, and reason are required.' });
    }

    const sub = submissionsStore.get(submissionId);
    if (sub) {
      sub.isSuspicious = true;
      sub.suspiciousReason = reason;
      submissionsStore.set(submissionId, sub);
      saveJsonFile('submissions.json', Object.fromEntries(submissionsStore));
    }

    // Record Audit Log
    const auditLog: AuditLogStoreItem = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      adminId,
      action: 'FLAG_SUSPICIOUS_SUBMISSION',
      targetType: 'SUBMISSION',
      targetId: submissionId,
      reason,
      timestamp: new Date().toISOString()
    };

    auditLogsStore.unshift(auditLog);
    saveJsonFile('audit_logs.json', auditLogsStore);

    return res.json({ success: true, auditLog });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 9. Admin Audit Logs
app.get('/api/admin/audit-logs', (req, res) => {
  return res.json({ success: true, logs: auditLogsStore });
});

// 10. User Management Endpoints (Persisted in usersStore)
app.get('/api/users', (_req, res) => {
  try {
    const list = Array.from(usersStore.values());
    return res.json({ success: true, users: list });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/users', (_req, res) => {
  try {
    const list = Array.from(usersStore.values());
    return res.json({ success: true, users: list });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/users/:uid', (req, res) => {
  try {
    const uid = String(req.params.uid);
    let user = usersStore.get(uid);
    if (!user) {
      const qEmail = req.query.email ? String(req.query.email).toLowerCase().trim() : '';
      user = Array.from(usersStore.values()).find(u =>
        u.uid === uid || (qEmail && u.email && u.email.toLowerCase().trim() === qEmail)
      );
    }
    return res.json({ success: true, user: user || null });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});



app.post('/api/users', (req, res) => {
  try {
    const user = req.body;
    if (!user || !user.uid) {
      return res.status(400).json({ error: 'User payload with uid is required' });
    }
    const uid = String(user.uid);
    const cleanEmail = user.email ? String(user.email).toLowerCase().trim() : '';
    let existing = usersStore.get(uid);
    if (!existing && cleanEmail) {
      existing = Array.from(usersStore.values()).find(u => u.email && u.email.toLowerCase().trim() === cleanEmail);
    }
    existing = existing || ({} as UserStoreItem);

    // Enforce role authorization: Only the authorized admin ID can be admin!
    let authoritativeRole: 'student' | 'company' | 'admin' = (user.role as any) || existing.role || 'student';
    if (authoritativeRole === 'admin') {
      if (!isServerAuthorizedAdmin(uid, user.email || existing.email)) {
        authoritativeRole = user.companyId ? 'company' : 'student';
      }
    } else if (isServerAuthorizedAdmin(uid, user.email || existing.email)) {
      authoritativeRole = 'admin';
    }

    // Preserve real human name if incoming is empty or 'Student'
    let finalName = user.name && String(user.name).trim() && String(user.name).trim().toLowerCase() !== 'intern' && String(user.name).trim().toLowerCase() !== 'student'
      ? String(user.name).trim()
      : (existing.name && existing.name.trim().toLowerCase() !== 'intern' && existing.name.trim().toLowerCase() !== 'student'
        ? existing.name
        : (user.name || (cleanEmail ? cleanEmail.split('@')[0] : 'Student')));

    const updated: UserStoreItem = {
      ...existing,
      ...user,
      uid,
      name: finalName,
      email: cleanEmail || existing.email || '',
      role: authoritativeRole,
      updatedAt: new Date().toISOString()
    };
    usersStore.set(uid, updated);
    saveJsonFile('users.json', Object.fromEntries(usersStore));
    broadcastEvent('user_updated', updated);
    return res.json({ success: true, user: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Bulk upsert users discovered from Firestore into Express store
app.post('/api/users/sync', (req, res) => {
  try {
    const incoming = Array.isArray(req.body?.users) ? req.body.users : [];
    let syncedCount = 0;
    for (const raw of incoming) {
      if (!raw || !raw.uid) continue;
      const uid = String(raw.uid);
      const existing = usersStore.get(uid);
      const rawTime = new Date(raw.updatedAt || raw.createdAt || 0).getTime();
      const existingTime = existing ? new Date(existing.updatedAt || existing.createdAt || 0).getTime() : -1;
      if (!existing || rawTime > existingTime) {
        const cleanEmail = raw.email ? String(raw.email).toLowerCase().trim() : (existing?.email || '');
        const authoritativeRole: 'student' | 'company' | 'admin' = isServerAuthorizedAdmin(uid, cleanEmail)
          ? 'admin'
          : (raw.role === 'company' ? 'company' : 'student');
        usersStore.set(uid, {
          ...(existing || {}),
          ...raw,
          uid,
          email: cleanEmail,
          role: authoritativeRole,
          progress: Math.max(Number(raw.progress || 0), Number(existing?.progress || 0))
        });
        syncedCount++;
      }
    }
    if (syncedCount > 0) {
      saveJsonFile('users.json', Object.fromEntries(usersStore));
    }
    return res.json({ success: true, syncedCount, total: usersStore.size });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Authentication Routes (Reliable registration and login across dev/preview sandbox sessions)
app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, password, role, referralCode, referredBy, uid: incomingUid } = req.body || {};
    if (!email || !String(email).trim()) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    let existingUser = Array.from(usersStore.values()).find(u => u.email && u.email.toLowerCase() === cleanEmail);

    const resolvedName = (name && String(name).trim() && String(name).trim().toLowerCase() !== 'intern' && String(name).trim().toLowerCase() !== 'student')
      ? String(name).trim()
      : (existingUser?.name && existingUser.name.toLowerCase() !== 'intern' && existingUser.name.toLowerCase() !== 'student'
        ? existingUser.name
        : (cleanEmail.split('@')[0] || 'Student'));

    const cleanRole: 'student' | 'company' | 'admin' = isServerAuthorizedAdmin(incomingUid || existingUser?.uid, cleanEmail)
      ? 'admin'
      : (role === 'company' ? 'company' : 'student');

    const uid = incomingUid || existingUser?.uid || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const userItem: UserStoreItem = {
      ...existingUser,
      uid,
      name: resolvedName,
      email: cleanEmail,
      role: cleanRole,
      password: password || existingUser?.password,
      referralCode: referralCode || existingUser?.referralCode || `VIR${Math.floor(100 + Math.random() * 900)}`,
      referredBy: referredBy || existingUser?.referredBy,
      internshipStatus: existingUser?.internshipStatus || 'none',
      progress: typeof existingUser?.progress === 'number' ? existingUser?.progress : 0,
      agreementAccepted: true,
      agreementAcceptedAt: existingUser?.agreementAcceptedAt || new Date().toISOString(),
      agreementVersion: 'v1.0-2026',
      createdAt: existingUser?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    usersStore.set(uid, userItem);
    saveJsonFile('users.json', Object.fromEntries(usersStore));
    broadcastEvent('user_updated', userItem);

    return res.json({ success: true, user: userItem });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Registration failed' });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !String(email).trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }
    const cleanEmail = String(email).trim().toLowerCase();

    // 1. Check in usersStore
    let matchedUser = Array.from(usersStore.values()).find(u => u.email && u.email.toLowerCase() === cleanEmail);

    // 2. Check in companiesStore if not in usersStore
    if (!matchedUser) {
      const matchedCompany = Array.from(companiesStore.values()).find(c => c.officialEmail && c.officialEmail.toLowerCase() === cleanEmail);
      if (matchedCompany) {
        matchedUser = {
          uid: matchedCompany.userId || matchedCompany.id,
          name: matchedCompany.name,
          email: matchedCompany.officialEmail,
          role: 'company',
          companyId: matchedCompany.id,
          referralCode: 'COMP' + Math.floor(100 + Math.random() * 900),
          internshipStatus: 'none',
          progress: 0,
          createdAt: matchedCompany.createdAt || new Date().toISOString(),
          updatedAt: matchedCompany.updatedAt || new Date().toISOString()
        };
        usersStore.set(matchedUser.uid, matchedUser);
      }
    }

    if (!matchedUser) {
      return res.status(404).json({ error: 'Account not found. Please register first.' });
    }

    // If password provided and user has password, check match
    if (password && matchedUser.password && matchedUser.password !== password) {
      return res.status(401).json({ error: 'Incorrect password. Please verify your credentials.' });
    }

    // Ensure role and human name are strictly populated without wiping real name
    if (!matchedUser.role) {
      matchedUser.role = isServerAuthorizedAdmin(matchedUser.uid, matchedUser.email) ? 'admin' : 'student';
    }
    if (!matchedUser.name || !matchedUser.name.trim() || matchedUser.name.toLowerCase() === 'intern') {
      matchedUser.name = cleanEmail.split('@')[0] || 'Student';
    }

    return res.json({ success: true, user: matchedUser });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Login failed' });
  }
});



app.post('/api/admin/users/:uid/toggle-suspend', (req, res) => {
  try {
    const uid = String(req.params.uid);
    const user = usersStore.get(uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    user.isSuspended = !user.isSuspended;
    user.updatedAt = new Date().toISOString();
    usersStore.set(uid, user);
    saveJsonFile('users.json', Object.fromEntries(usersStore));
    broadcastEvent('user_updated', user);
    return res.json({ success: true, user });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/users/:uid/toggle-paid', (req, res) => {
  try {
    const uid = String(req.params.uid);
    const user = usersStore.get(uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    user.hasPaidPackage = !user.hasPaidPackage;
    if (user.hasPaidPackage) {
      user.paidPackageAt = new Date().toISOString();
    }
    user.updatedAt = new Date().toISOString();
    usersStore.set(uid, user);
    saveJsonFile('users.json', Object.fromEntries(usersStore));
    broadcastEvent('user_updated', user);
    return res.json({ success: true, user });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 11. Company Portal Endpoints
app.get('/api/companies', (_req, res) => {
  try {
    const list = Array.from(companiesStore.values());
    return res.json({ success: true, companies: list });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/companies/:id', (req, res) => {
  try {
    const id = String(req.params.id);
    const company = companiesStore.get(id);
    return res.json({ success: true, company: company || null });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/companies/register', (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.userId || !data.name || !data.officialEmail) {
      return res.status(400).json({ error: 'userId, company name, and officialEmail are required' });
    }
    const id = String(data.id || data.userId);
    const now = new Date().toISOString();
    const newCompany: CompanyStoreItem = {
      id,
      userId: String(data.userId),
      name: String(data.name).trim(),
      officialEmail: String(data.officialEmail).trim().toLowerCase(),
      contactPerson: String(data.contactPerson || '').trim(),
      designation: String(data.designation || '').trim(),
      website: String(data.website || '').trim(),
      industry: String(data.industry || 'Technology').trim(),
      description: String(data.description || '').trim(),
      hiringRequirements: Array.isArray(data.hiringRequirements) ? data.hiringRequirements : [],
      preferredSkills: Array.isArray(data.preferredSkills) ? data.preferredSkills : [],
      logoUrl: data.logoUrl || undefined,
      verificationDocumentUrl: data.verificationDocumentUrl || undefined,
      verificationStatus: 'pending_verification',
      talentDiscoveryEnabled: false,
      createdAt: now,
      updatedAt: now,
    };
    companiesStore.set(id, newCompany);
    saveJsonFile('companies.json', Object.fromEntries(companiesStore));

    // Update user profile to company role
    const user = usersStore.get(newCompany.userId);
    if (user) {
      user.role = 'company';
      user.companyId = id;
      user.updatedAt = now;
      usersStore.set(user.uid, user);
      saveJsonFile('users.json', Object.fromEntries(usersStore));
      broadcastEvent('user_updated', user);
    }

    broadcastEvent('company_updated', newCompany);
    return res.json({ success: true, company: newCompany });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/companies/:id', (req, res) => {
  try {
    const id = String(req.params.id);
    const existing = companiesStore.get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Company not found' });
    }
    const updates = req.body;
    delete updates.verificationStatus;
    delete updates.talentDiscoveryEnabled;

    const updated: CompanyStoreItem = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    };
    companiesStore.set(id, updated);
    saveJsonFile('companies.json', Object.fromEntries(companiesStore));
    broadcastEvent('company_updated', updated);
    return res.json({ success: true, company: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/companies/:id/verify', (req, res) => {
  try {
    const id = String(req.params.id);
    const { status, verificationNotes, reviewerName } = req.body;
    const company = companiesStore.get(id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    if (!['pending_verification', 'approved', 'rejected', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Invalid verification status' });
    }
    company.verificationStatus = status;
    company.talentDiscoveryEnabled = status === 'approved';
    if (verificationNotes) company.verificationNotes = verificationNotes;
    if (reviewerName) company.reviewedBy = reviewerName;
    company.reviewedAt = new Date().toISOString();
    company.updatedAt = new Date().toISOString();

    companiesStore.set(id, company);
    saveJsonFile('companies.json', Object.fromEntries(companiesStore));
    broadcastEvent('company_updated', company);
    return res.json({ success: true, company });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 12. Talent Discovery Candidates Endpoint
app.get('/api/candidates', (req, res) => {
  try {
    const { domain, search, minScore, status } = req.query;

    const allUsers = Array.from(usersStore.values());
    const studentUsers = allUsers.filter(u => u.role !== 'admin' && u.role !== 'company' && !u.isSuspended);

    const candidates = studentUsers.map((u, index) => {
      const userSubs = Array.from(submissionsStore.values()).filter(s => s.userId === u.uid);
      const userEvals = Array.from(evaluationsStore.values()).filter(e => e.userId === u.uid);
      const internship = internshipsStore.get(`${u.uid}_${u.selectedDomain || ''}`) ||
                         Array.from(internshipsStore.values()).find(i => i.userId === u.uid);

      const approvedSubs = userSubs.filter(s => s.status === 'approved');
      const scores = userEvals.map(e => e.totalScore).filter(s => typeof s === 'number');
      const averageScore = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : (approvedSubs.length > 0 ? 88 : 0);

      const totalPoints = userEvals.reduce((acc, e) => acc + (e.earnedPoints || e.totalScore || 0), 0) || (approvedSubs.length * 100);

      const domainId = u.selectedDomain || internship?.domainId || 'web-dev';
      const domainName = internship?.domainName || 'Web Development';

      const verifiedProjects = approvedSubs.map(s => ({
        taskNumber: s.taskNumber || 1,
        title: s.projectTitle || `Task ${s.taskNumber}`,
        githubUrl: s.githubUrl || s.repositoryURL,
        projectUrl: s.projectUrl || s.demoURL,
        score: s.rubricScore || 90,
        status: s.status,
        verifiedAt: s.reviewedAt || s.submittedAt,
      }));

      const defaultSkills: Record<string, string[]> = {
        'ai-ml': ['Python', 'PyTorch', 'TensorFlow', 'Scikit-Learn', 'Deep Learning', 'Computer Vision'],
        'web-dev': ['React', 'TypeScript', 'Node.js', 'Tailwind CSS', 'REST APIs', 'PostgreSQL'],
        'data-science': ['Python', 'Pandas', 'NumPy', 'Data Visualization', 'SQL', 'Statistical Modeling'],
        'cyber-security': ['Network Security', 'Penetration Testing', 'Cryptography', 'Linux', 'OWASP'],
        'app-dev': ['React Native', 'Flutter', 'Mobile Architecture', 'Firebase', 'State Management'],
        'cloud-computing': ['AWS', 'Docker', 'Kubernetes', 'CI/CD', 'Terraform', 'Linux'],
      };

      const skills = (u.skills && u.skills.length > 0)
        ? u.skills
        : (defaultSkills[domainId] || ['Problem Solving', 'Git', 'Software Development']);

      const progress = Math.min(100, Math.max(u.progress || 0, approvedSubs.length * 20));

      return {
        studentId: u.uid,
        displayName: u.name || 'VirIntern Fellow',
        domainId,
        domainName,
        progress,
        averageScore,
        totalPoints,
        rank: index + 1,
        skills,
        bio: u.bio || `Specialized ${domainName} Virtual Intern delivering practical verified deliverables.`,
        completedTasksCount: approvedSubs.length,
        verifiedProjects,
        internshipStatus: (progress >= 100 || u.internshipStatus === 'completed') ? 'completed' : 'active',
        resumeUrl: u.consentShareResume !== false ? u.resumeUrl : undefined,
        githubProfileUrl: u.githubProfileUrl,
        linkedinProfileUrl: u.linkedinProfileUrl,
        consentShareProfile: u.consentShareProfile !== false,
        consentShareResume: u.consentShareResume !== false,
        lastActive: u.updatedAt || u.createdAt || new Date().toISOString(),
      };
    });

    candidates.sort((a, b) => (b.totalPoints - a.totalPoints) || (b.averageScore - a.averageScore) || (b.progress - a.progress));
    candidates.forEach((c, i) => { c.rank = i + 1; });

    let filtered = candidates.filter(c => c.consentShareProfile);
    if (domain) {
      filtered = filtered.filter(c => c.domainId === String(domain) || c.domainName.toLowerCase().includes(String(domain).toLowerCase()));
    }
    if (search) {
      const q = String(search).toLowerCase();
      filtered = filtered.filter(c => c.displayName.toLowerCase().includes(q) || c.skills.some((s: string) => s.toLowerCase().includes(q)));
    }
    if (minScore) {
      const min = Number(minScore);
      filtered = filtered.filter(c => c.averageScore >= min);
    }
    if (status) {
      filtered = filtered.filter(c => c.internshipStatus === status);
    }

    return res.json({ success: true, candidates: filtered, total: filtered.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 13. Shortlist Management Endpoints
app.get('/api/shortlists', (req, res) => {
  try {
    const { companyId } = req.query;
    let list = Array.from(shortlistsStore.values());
    if (companyId) {
      list = list.filter(s => s.companyId === String(companyId));
    }
    return res.json({ success: true, shortlists: list });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/shortlists', (req, res) => {
  try {
    const data = req.body;
    if (!data.companyId || !data.studentId) {
      return res.status(400).json({ error: 'companyId and studentId are required' });
    }
    const id = data.id || `shortlist_${data.companyId}_${data.studentId}`;
    const now = new Date().toISOString();
    const existing = shortlistsStore.get(id);
    const item: ShortlistStoreItem = {
      id,
      companyId: String(data.companyId),
      companyName: String(data.companyName || 'Verified Partner'),
      studentId: String(data.studentId),
      studentName: String(data.studentName || 'Student Candidate'),
      studentEmail: String(data.studentEmail || ''),
      studentDomain: data.studentDomain,
      roleOrOpportunityTitle: String(data.roleOrOpportunityTitle || 'Internship / Junior Role'),
      status: data.status || 'shortlisted',
      privateNotes: data.privateNotes || '',
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    };
    shortlistsStore.set(id, item);
    saveJsonFile('shortlists.json', Object.fromEntries(shortlistsStore));
    broadcastEvent('shortlist_updated', item);
    return res.json({ success: true, shortlist: item });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/shortlists/:id', (req, res) => {
  try {
    const id = String(req.params.id);
    const existing = shortlistsStore.get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Shortlist entry not found' });
    }
    const updated: ShortlistStoreItem = {
      ...existing,
      ...req.body,
      id,
      updatedAt: new Date().toISOString(),
    };
    shortlistsStore.set(id, updated);
    saveJsonFile('shortlists.json', Object.fromEntries(shortlistsStore));
    broadcastEvent('shortlist_updated', updated);
    return res.json({ success: true, shortlist: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/shortlists/:id', (req, res) => {
  try {
    const id = String(req.params.id);
    shortlistsStore.delete(id);
    saveJsonFile('shortlists.json', Object.fromEntries(shortlistsStore));
    broadcastEvent('shortlist_deleted', { id });
    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 14. Recruitment Opportunities Endpoints
app.get('/api/opportunities', (req, res) => {
  try {
    const { companyId, approvedOnly } = req.query;
    let list = Array.from(opportunitiesStore.values());
    if (companyId) {
      list = list.filter(o => o.companyId === String(companyId));
    }
    if (approvedOnly === 'true') {
      list = list.filter(o => o.approvalStatus === 'approved');
    }
    return res.json({ success: true, opportunities: list });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/opportunities', (req, res) => {
  try {
    const data = req.body;
    if (!data.companyId || !data.title || !data.description) {
      return res.status(400).json({ error: 'companyId, title, and description are required' });
    }
    const id = `opp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const item: OpportunityStoreItem = {
      id,
      companyId: String(data.companyId),
      companyName: String(data.companyName || 'Corporate Partner'),
      title: String(data.title).trim(),
      domainId: data.domainId,
      domainName: data.domainName,
      requiredSkills: Array.isArray(data.requiredSkills) ? data.requiredSkills : [],
      description: String(data.description).trim(),
      locationType: data.locationType || 'Remote',
      location: data.location,
      stipendOrSalary: data.stipendOrSalary,
      deadline: data.deadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      approvalStatus: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    opportunitiesStore.set(id, item);
    saveJsonFile('opportunities.json', Object.fromEntries(opportunitiesStore));
    broadcastEvent('opportunity_updated', item);
    return res.json({ success: true, opportunity: item });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/opportunities/:id/review', (req, res) => {
  try {
    const id = String(req.params.id);
    const { status, adminNotes } = req.body;
    const opp = opportunitiesStore.get(id);
    if (!opp) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid approval status' });
    }
    opp.approvalStatus = status;
    if (adminNotes) opp.adminNotes = adminNotes;
    opp.updatedAt = new Date().toISOString();
    opportunitiesStore.set(id, opp);
    saveJsonFile('opportunities.json', Object.fromEntries(opportunitiesStore));
    broadcastEvent('opportunity_updated', opp);
    return res.json({ success: true, opportunity: opp });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 15. Public Credential Verification & Sync Endpoints
app.get('/api/certificates/:certificateId', (req, res) => {
  try {
    const rawId = String(req.params.certificateId || '').trim();
    if (!rawId) {
      return res.status(400).json({ error: 'certificateId is required' });
    }
    const cert =
      certificatesStore.get(rawId) ||
      Array.from(certificatesStore.values()).find(
        (c) => c?.certificateId && String(c.certificateId).toLowerCase() === rawId.toLowerCase()
      );
    if (!cert) {
      return res.status(404).json({ error: 'Certificate not found' });
    }
    return res.json({ success: true, certificate: cert });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/certificates', (req, res) => {
  try {
    const cert = req.body;
    if (!cert || !cert.certificateId || !cert.userId || !cert.studentName) {
      return res.status(400).json({ error: 'certificateId, userId, and studentName are required' });
    }
    certificatesStore.set(String(cert.certificateId), cert);
    saveJsonFile('certificates.json', Object.fromEntries(certificatesStore));
    return res.json({ success: true, certificate: cert });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Recalculate leaderboard cleanly on startup from verified real evaluations
recalculateLeaderboard();

// Mount Vite or serve static assets in production
async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
