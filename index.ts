export type UserRole = 'student' | 'company' | 'admin';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  role: UserRole;
  selectedDomain?: string;
  referralCode: string;
  referredBy?: string;
  internshipStatus: 'none' | 'agreement_pending' | 'active' | 'completed';
  internshipStartDate?: string;
  internshipEndDate?: string;
  progress: number;
  agreementAccepted?: boolean;
  agreementAcceptedAt?: string;
  agreementVersion?: string;
  hasPaidPackage?: boolean;
  paidPackageAt?: string;
  isSuspended?: boolean;
  // Student talent profile fields
  skills?: string[];
  bio?: string;
  resumeUrl?: string;
  githubProfileUrl?: string;
  linkedinProfileUrl?: string;
  consentShareProfile?: boolean;
  consentShareResume?: boolean;
  // Company association if role is company
  companyId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DomainItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  isActive: boolean;
  durationDays: number;
  tags?: string[];
  learningObjectives?: string[];
  prerequisites?: string[];
  assessmentRubric?: string;
  createdAt: string;
}

export type TaskDifficulty = 'Beginner' | 'Intermediate' | 'Advanced' | 'Easy' | 'Hard';
export type DifficultyLevel = 'Easy' | 'Intermediate' | 'Hard' | 'Advanced';
export type ProgressionLevel = 'Level 1 - Easy' | 'Level 2 - Intermediate' | 'Level 3 - Hard' | 'Level 4 - Capstone';
export type AllowedSubmissionType = 'text' | 'github' | 'project_url' | 'pdf' | 'image' | 'file';

export interface RubricCriterion {
  criterion: string;
  maxMarks: number;
  awardedMarks?: number;
  feedback?: string;
}

export interface ProjectTask {
  id: string;
  taskId?: string; // Standard alias for id
  domainId: string;
  domain?: string; // Standard alias for domainId
  taskNumber: 1 | 2 | 3 | 4 | 5;
  title: string;
  objective: string;
  description: string;
  difficulty: TaskDifficulty;
  level?: DifficultyLevel;
  progressionLevel?: ProgressionLevel;
  requirements?: string[];
  learningObjectives?: string[];
  prerequisites?: string[];
  requiredTools?: string[];
  instructions: string[];
  expectedOutput: string;
  submissionType: 'github_and_demo' | 'github_only' | 'document_or_link' | 'all';
  allowedSubmissionTypes?: AllowedSubmissionType[];
  evaluationRubric?: Record<string, number>;
  passingScore?: number; // e.g. 70
  maximumAttempts?: number; // e.g. 3
  verificationRequirement?: string;
  offerLetterTemplateUrl?: string;
  offerLetterTemplateName?: string;
  offerLetterInstructions?: string;
  offerLetterRequired?: boolean;
  rubric?: string;
  rubricCriteria?: RubricCriterion[];
  estimatedDuration?: string;
  tags?: string[];
  version?: string;
  resources: { title: string; url: string }[];
  isActive: boolean;
  status?: 'draft' | 'approved' | 'published' | 'archived';
  createdAt: string;
  updatedAt?: string;
}

export type SubmissionStatus =
  | 'pending_review'
  | 'evaluated'
  | 'passed'
  | 'revision_required'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'draft';

export interface RequirementEvaluationResult {
  requirement: string;
  status: 'verified' | 'unmet' | 'unable_to_verify' | 'passed' | 'failed';
  feedback?: string;
  evidence?: string;
}

export interface TaskEvaluationRecord {
  evaluationId: string;
  submissionId: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  taskId: string;
  taskTitle?: string;
  taskNumber?: number;
  domainId?: string;
  domainName?: string;
  difficulty?: TaskDifficulty;
  totalScore: number;
  criteriaScores: Record<string, number>;
  requirementResults: RequirementEvaluationResult[];
  strengths: string[];
  weaknesses: string[];
  detectedIssues: string[];
  improvementSuggestions: string[];
  confidence: number;
  status: 'passed' | 'revision_required';
  evaluatedAt: string;
  evaluatorType: 'AI' | 'ADMIN_OVERRIDE';
  earnedPoints?: number;
  adminOverride?: {
    adminId: string;
    adminEmail?: string;
    previousScore: number;
    newScore: number;
    reason: string;
    overriddenAt: string;
  };
}

export interface LeaderboardRecord {
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
}

export interface GeminiTaskEvaluation {
  score: number;
  grade: string;
  summary: string;
  strengths: string[];
  recommendations: string[];
  breakdown: {
    codeArchitecture: number;
    deliverableCompleteness: number;
    practicalImplementation: number;
    documentationAndReadiness: number;
  };
  criteriaScores?: Record<string, number>;
  requirementResults?: RequirementEvaluationResult[];
  detectedIssues?: string[];
  improvementSuggestions?: string[];
  confidence?: number;
  status?: 'passed' | 'revision_required';
  mentorVerdict?: string;
  evaluatedAt: string;
}

export interface DomainLeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  userEmail?: string;
  userPhoto?: string;
  domainId: string;
  domainName: string;
  totalScore: number;
  completedTasksCount: number;
  averageScore: number;
  bestTaskScore: number;
  levelBadge: string;
  statusText: string;
  isCurrentUser?: boolean;
  lastActive: string;
}

export interface TaskSubmission {
  id: string;
  submissionId?: string; // Standard alias for id
  assignmentId?: string;
  userId: string;
  userEmail: string;
  userName: string;
  domainId: string;
  domainName: string;
  taskId?: string; // Standard alias for projectId
  taskNumber: number;
  projectId: string;
  projectTitle: string;
  level?: DifficultyLevel;
  progressionLevel?: ProgressionLevel;
  version?: number;
  attemptNumber?: number;
  submissionType?: string;
  content?: string; // Text answers / explanations
  githubUrl?: string; // Standard alias for repositoryURL
  projectUrl?: string; // Standard alias for demoURL
  fileUrls?: string[]; // Attached PDFs, images, files
  evaluationId?: string;
  isSuspicious?: boolean;
  suspiciousReason?: string;
  repositoryURL?: string;
  driveURL?: string;
  pdfUrl?: string;
  imageUrl?: string;
  demoURL?: string;
  textResponse?: string;
  codeSnippet?: string;
  fileName?: string;
  fileDataUri?: string;
  fileType?: string;
  notes?: string;
  // Task 1 special verification & offer letter fields
  task1VerificationType?: 'letter' | 'social' | 'offer_letter';
  offerLetterUrl?: string;
  offerLetterFileName?: string;
  offerLetterDataUri?: string;
  letterFileUrl?: string;
  socialProofUrl?: string;
  linkedinVerified?: boolean;
  linkedinProofUrl?: string;
  youtubeChannelChecked?: boolean;
  youtubeProofText?: string;
  youtubeSubscribeProof?: string;
  youtubeScreenshotUrl?: string; // Base64 data URI or image link of YT subscribe screenshot
  youtubeScreenshotFileName?: string;
  isManuallyVerified?: boolean;
  verifiedByAdminName?: string;
  verifiedByAdminId?: string;
  status: SubmissionStatus;
  rubricScore?: number; // 0 to 100, passing >= 70
  rubricFeedback?: string;
  rubricEvaluations?: RubricCriterion[];
  geminiEvaluation?: GeminiTaskEvaluation;
  adminFeedback?: string;
  decisionReason?: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface TaskAssignment {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  domainId: string;
  domainName: string;
  taskId: string;
  taskTitle: string;
  taskNumber: number;
  level?: DifficultyLevel;
  progressionLevel?: ProgressionLevel;
  assignedAt: string;
  dueAt?: string;
  assignmentSource: 'random_engine' | 'manual_admin';
  reassignmentReason?: string;
  status: 'assigned' | 'submitted' | 'approved' | 'revision_required' | 'rejected';
}

export interface LevelProgress {
  level: DifficultyLevel;
  requiredTasks: number;
  approvedTasks: number;
  status: 'locked' | 'in_progress' | 'completed';
  completedAt?: string;
}

export interface SystemSettings {
  tasksPerLevel: {
    Easy: number;
    Intermediate: number;
    Hard: number;
    Advanced: number;
  };
  passingScore: number;
  crossStudentBalancing: boolean;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorEmail?: string;
  action: string;
  targetType: 'assignment' | 'task' | 'domain' | 'submission' | 'certificate' | 'user' | 'TASK' | 'USER' | 'DOMAIN' | 'SUBMISSION' | 'CERTIFICATE';
  targetId: string;
  reason?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface CapstoneProjectRecord {
  id: string;
  enrollmentId?: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  domainId: string;
  domainName: string;
  taskId: string;
  proposal?: string;
  repositoryUrl?: string;
  demoUrl?: string;
  driveUrl?: string;
  documentationUrl?: string;
  videoDemoUrl?: string;
  deliverablesSummary?: string;
  rubricScore?: number;
  status: 'pending' | 'under_review' | 'approved' | 'revision_required' | 'rejected';
  adminFeedback?: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface EAgreementRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  agreementVersion: string;
  agreementAccepted: boolean;
  acceptedAt: string;
  ipAddress?: string;
  termsSummary: string;
}

export interface InternshipRecord {
  id: string;
  userId: string;
  domainId: string;
  domainName: string;
  domainSlug?: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed';
  progress: number; // 0 to 100
  currentTask: number; // 1 to 5
  currentLevel?: DifficultyLevel;
  levelProgress?: {
    Easy: LevelProgress;
    Intermediate: LevelProgress;
    Hard: LevelProgress;
    Advanced: LevelProgress;
  };
  task1ProjectCompleted?: boolean;
  task1VerificationCompleted?: boolean;
  completedTasks: number[];
  capstoneSubmitted?: boolean;
  capstoneApproved?: boolean;
  capstoneId?: string;
  certificateEligible?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PackageBenefit {
  id: string;
  title: string;
  description: string;
  icon?: string; // e.g. "Award", "FileText", "BookOpen", "ShieldCheck", "Star", "Download", "Briefcase", "Linkedin", "CheckCircle"
  imageUrl?: string; // Optional image URL or base64 data URI
  fileUrl?: string; // Uploaded PDF, PNG, JPG, DOCX file (base64 data URI or downloadable URL)
  fileName?: string; // Original uploaded file name (e.g. "guidelines.pdf")
  fileType?: string; // MIME type or extension
  resourceLink?: string; // Downloadable / external resource link
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface PackageConfig {
  id: string;
  title: string;
  price: number; // default 99
  originalPrice: number;
  currency: string;
  description: string;
  features?: string[];
  isActive: boolean;
  updatedAt: string;
}

export interface CertificateRecord {
  certificateId: string; // e.g. VI-2026-WD-104928
  userId: string;
  studentName: string;
  internshipDomain: string;
  internshipTitle: string;
  startDate: string;
  completionDate: string;
  issueDate: string;
  type: 'Completion' | 'Appreciation';
  grade?: string;
  status: 'valid' | 'revoked';
}

export interface ReferralRecord {
  id: string;
  referrerUid: string;
  referrerCode: string;
  referredUid: string;
  referredEmail: string;
  referredName: string;
  status: 'signed_up' | 'purchased';
  rewardAmount: number; // e.g. 10% of 99 = 9.9
  rewardPaid: boolean;
  createdAt: string;
  paidAt?: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'task_unlocked' | 'submission_received' | 'submission_approved' | 'submission_rejected' | 'deadline' | 'completed' | 'reward' | 'internship_started';
  isRead: boolean;
  createdAt: string;
  link?: string;
}

export interface InterviewQuestionItem {
  id: string;
  category: 'HR' | 'Technical' | 'Programming' | 'AI/ML' | 'Web Development' | 'DBMS' | 'Operating Systems' | 'Networking' | 'Aptitude' | 'Data Structures' | 'ECE & Embedded' | string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  question: string;
  answer: string;
  explanation?: string;
  sampleCode?: string;
}

export interface EmailLog {
  id: string;
  to: string;
  subject: string;
  preview: string;
  sentAt: string;
  type: 'welcome' | 'internship_started' | 'task_unlocked' | 'submission_received' | 'approved' | 'rejected' | 'completion' | 'package_ready';
}

export interface AuditLogRecord {
  id: string;
  adminId: string;
  adminEmail?: string;
  action: string;
  targetType: 'SUBMISSION' | 'EVALUATION' | 'LEADERBOARD' | 'USER' | 'TASK';
  targetId: string;
  previousScore?: number;
  newScore?: number;
  reason?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface TaskEvaluationConfig {
  taskId: string;
  domain: string;
  title: string;
  description: string;
  difficulty: TaskDifficulty;
  requirements: string[];
  expectedOutput: string;
  allowedSubmissionTypes: AllowedSubmissionType[];
  evaluationRubric: {
    functionality: number;
    requirements: number;
    quality: number;
    documentation: number;
    errorHandling: number;
    originality: number;
  };
  passingScore: number;
  maximumAttempts: number;
}

export interface StudentSubmission {
  submissionId: string;
  userId: string;
  taskId: string;
  submittedAt: string;
  submissionType: string;
  content: string;
  githubUrl?: string;
  projectUrl?: string;
  fileUrls?: string[];
  attemptNumber: number;
  status: 'pending_review' | 'evaluated' | 'passed' | 'revision_required' | 'rejected';
}

export type CompanyVerificationStatus = 'pending_verification' | 'approved' | 'rejected' | 'suspended';

export interface CompanyProfile {
  id: string; // companyId / uid
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
  verificationStatus: CompanyVerificationStatus;
  verificationNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  talentDiscoveryEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ShortlistStatus = 'shortlisted' | 'under_review' | 'contacted' | 'rejected';

export interface ShortlistRecord {
  id: string;
  companyId: string;
  companyName: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentDomain?: string;
  roleOrOpportunityTitle: string;
  status: ShortlistStatus;
  privateNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export type OpportunityApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface RecruitmentOpportunity {
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
  approvalStatus: OpportunityApprovalStatus;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateVerifiedProject {
  taskNumber: number;
  title: string;
  githubUrl?: string;
  projectUrl?: string;
  score?: number;
  status: string;
  verifiedAt?: string;
}

export interface CandidateProfileView {
  studentId: string;
  displayName: string;
  domainId: string;
  domainName: string;
  progress: number;
  averageScore: number;
  totalPoints: number;
  rank: number;
  skills: string[];
  bio?: string;
  completedTasksCount: number;
  verifiedProjects: CandidateVerifiedProject[];
  internshipStatus: 'active' | 'completed' | 'none';
  resumeUrl?: string;
  githubProfileUrl?: string;
  linkedinProfileUrl?: string;
  consentShareProfile: boolean;
  consentShareResume: boolean;
  lastActive: string;
}

