import {
  DomainItem,
  ProjectTask,
  PackageConfig,
  PackageBenefit,
  TaskSubmission,
  InternshipRecord,
  CertificateRecord,
  ReferralRecord,
  AppNotification,
  InterviewQuestionItem,
  EmailLog,
  UserProfile,
  EAgreementRecord,
  TaskAssignment,
  AuditLogRecord,
  CapstoneProjectRecord,
  DomainLeaderboardEntry,
  SystemSettings,
  TaskEvaluationRecord,
  LeaderboardRecord,
  CompanyProfile,
  CompanyVerificationStatus,
  ShortlistRecord,
  ShortlistStatus,
  RecruitmentOpportunity,
  OpportunityApprovalStatus,
  CandidateProfileView
} from '../types';

export const DEFAULT_SETTINGS: SystemSettings = {
  tasksPerLevel: {
    Easy: 5,
    Intermediate: 5,
    Hard: 5,
    Advanced: 5
  },
  passingScore: 70,
  crossStudentBalancing: true
};
import { db, auth } from '../firebase/firebase';
import { ADMIN_UID } from '../firebase/config';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../firebase/errorHandling';
import { generateStudentTasks, getStudentTrackIndex } from './domainProjectsService';

function withTimeout<T>(promise: Promise<T>, ms = 6500): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}

// Safeguard Firestore doc creation against undefined arguments that trigger internal ResourcePath.fromString indexOf errors
function safeDoc(collectionName: string, ...segments: (string | undefined | null)[]) {
  if (!collectionName || typeof collectionName !== 'string' || !collectionName.trim()) return null;
  for (const s of segments) {
    if (!s || typeof s !== 'string' || !s.trim()) {
      return null;
    }
  }
  return doc(db, collectionName, ...(segments as string[]));
}

// Remove undefined fields so Firestore does not throw unsupported field value or serialization errors
function cleanFirestoreData<T extends Record<string, any>>(obj: T): Partial<T> {
  if (!obj || typeof obj !== 'object') return obj;
  const clean: any = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined) {
      if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
        clean[key] = cleanFirestoreData(val);
      } else {
        clean[key] = val;
      }
    }
  }
  return clean;
}

// Resilient Domain Matching Helper: Maps domain IDs, slugs, and names seamlessly without generic collisions
export function isSameDomain(domainA?: string, domainB?: string, nameA?: string, nameB?: string): boolean {
  if (!domainA && !domainB && !nameA && !nameB) return true;

  const normalize = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const tokensA = [normalize(domainA), normalize(nameA)].filter(Boolean);
  const tokensB = [normalize(domainB), normalize(nameB)].filter(Boolean);

  if (tokensA.length === 0 && tokensB.length === 0) return true;
  if (tokensA.length === 0 || tokensB.length === 0) return false;

  const domainAliases: Record<string, string[]> = {
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

  const genericStopWords = new Set(['virtualinternship', 'internship', 'tech', 'general', 'default', 'foundation', 'development', 'engineering', 'programming']);

  for (const a of tokensA) {
    if (genericStopWords.has(a)) continue;
    for (const b of tokensB) {
      if (genericStopWords.has(b)) continue;
      if (a === b) return true;
      const aliasesA = domainAliases[a] || [];
      if (aliasesA.includes(b)) return true;
      const aliasesB = domainAliases[b] || [];
      if (aliasesB.includes(a)) return true;
    }
  }

  return false;
}

// Seed Initial Domains (Non-hardcoded in code logic - seeded to DB and editable via Admin)
const DEFAULT_DOMAINS: DomainItem[] = [
  {
    id: 'ai-ml',
    name: 'Artificial Intelligence and Machine Learning',
    slug: 'ai-ml',
    description: 'Build machine learning pipelines, deep neural networks, computer vision models, NLP transformers, and generative AI agents.',
    icon: 'Cpu',
    color: 'from-indigo-600 to-cyan-600',
    isActive: true,
    durationDays: 30,
    tags: ['PyTorch', 'TensorFlow', 'LLMs', 'Neural Nets', 'Scikit-Learn'],
    learningObjectives: ['Supervised & unsupervised learning algorithms', 'Deep learning architectures (CNN/RNN/Transformers)', 'Model evaluation and deployment'],
    prerequisites: ['Python basics', 'Linear algebra', 'Calculus fundamentals'],
    assessmentRubric: 'Data preprocessing (25%), Model accuracy & architecture (35%), Code quality & evaluation (25%), Documentation & deployment (15%)',
    createdAt: new Date().toISOString()
  },
  {
    id: 'web-dev',
    name: 'Web Development',
    slug: 'web-development',
    description: 'Master modern frontend & full-stack development using React, TypeScript, REST APIs, and modern responsive CSS frameworks.',
    icon: 'Globe',
    color: 'from-blue-600 to-indigo-600',
    isActive: true,
    durationDays: 30,
    tags: ['React', 'TypeScript', 'Node.js', 'Tailwind CSS', 'Next.js'],
    learningObjectives: ['Responsive web design principles', 'Modern React state & component architecture', 'REST/GraphQL API consumption & full-stack deployment'],
    prerequisites: ['HTML5', 'CSS3', 'JavaScript ES6+'],
    assessmentRubric: 'UI/UX design & responsiveness (30%), Code architecture & cleanliness (30%), State & API handling (25%), Deployment & testing (15%)',
    createdAt: new Date().toISOString()
  },
  {
    id: 'data-science',
    name: 'Data Science and Data Analytics',
    slug: 'data-science',
    description: 'Harness pandas, NumPy, statistical modeling, data visualization, exploratory data analysis, and predictive modeling on real datasets.',
    icon: 'BarChart2',
    color: 'from-violet-600 to-purple-600',
    isActive: true,
    durationDays: 30,
    tags: ['Pandas', 'NumPy', 'Scikit-Learn', 'Matplotlib', 'SQL'],
    learningObjectives: ['Data cleaning & wrangling pipelines', 'Exploratory data analysis & statistical inference', 'Machine learning modeling & business dashboarding'],
    prerequisites: ['Python syntax', 'Basic statistics', 'Spreadsheet basics'],
    assessmentRubric: 'Data cleaning & integrity (25%), Statistical rigor & analysis (35%), Visualization quality (25%), Actionable insights & reporting (15%)',
    createdAt: new Date().toISOString()
  },
  {
    id: 'cybersecurity',
    name: 'Cybersecurity',
    slug: 'cybersecurity',
    description: 'Understand network security fundamentals, penetration testing, vulnerability assessment, threat intelligence, and digital forensics.',
    icon: 'ShieldCheck',
    color: 'from-slate-700 to-zinc-900',
    isActive: true,
    durationDays: 30,
    tags: ['Ethical Hacking', 'OWASP', 'Wireshark', 'SecOps', 'Cryptography'],
    learningObjectives: ['Threat modeling & vulnerability scanning', 'Network protocol analysis & firewall configuration', 'Incident response & penetration testing methodologies'],
    prerequisites: ['Computer networking fundamentals', 'Linux command line', 'Basic scripting'],
    assessmentRubric: 'Security vulnerability discovery (35%), Exploit mitigation & hardening (35%), Compliance & reporting (20%), Tool utilization (10%)',
    createdAt: new Date().toISOString()
  },
  {
    id: 'app-dev',
    name: 'App Development',
    slug: 'app-development',
    description: 'Build native and cross-platform mobile applications for iOS & Android with React Native, Flutter, and modern mobile tooling.',
    icon: 'Smartphone',
    color: 'from-emerald-600 to-teal-600',
    isActive: true,
    durationDays: 30,
    tags: ['React Native', 'Mobile UI', 'Expo', 'REST APIs', 'Mobile Storage'],
    learningObjectives: ['Cross-platform mobile component design', 'Mobile navigation & persistent offline state', 'Native hardware API integration (Camera, GPS, Storage)'],
    prerequisites: ['JavaScript/TypeScript', 'Basic UI styling', 'Async programming'],
    assessmentRubric: 'Mobile UX & responsiveness (30%), Architecture & state management (30%), API integration & error resilience (25%), Performance & packaging (15%)',
    createdAt: new Date().toISOString()
  },
  {
    id: 'ui-ux',
    name: 'UI/UX Design',
    slug: 'ui-ux-design',
    description: 'Design intuitive digital products, wireframes, high-fidelity prototypes, user research plans, usability tests, and design systems.',
    icon: 'Palette',
    color: 'from-pink-600 to-rose-600',
    isActive: true,
    durationDays: 30,
    tags: ['Figma', 'User Research', 'Design Systems', 'Prototyping', 'Wireframing'],
    learningObjectives: ['User persona creation & journey mapping', 'High-fidelity prototyping in Figma with auto-layout', 'Design token systems and usability testing'],
    prerequisites: ['Design curiosity', 'Basic visual aesthetics', 'Empathy for user workflows'],
    assessmentRubric: 'User research & problem definition (25%), Visual hierarchy & typography (30%), Prototype interactivity & flow (30%), Design system consistency (15%)',
    createdAt: new Date().toISOString()
  },
  {
    id: 'business-analytics',
    name: 'Business Analytics',
    slug: 'business-analytics',
    description: 'Transform organizational datasets into strategic decision-making insights using SQL, Excel modeling, Power BI, and KPI forecasting.',
    icon: 'TrendingUp',
    color: 'from-amber-600 to-yellow-600',
    isActive: true,
    durationDays: 30,
    tags: ['Power BI', 'SQL', 'Financial Modeling', 'Excel Macros', 'KPIs'],
    learningObjectives: ['Business metric derivation and financial modeling', 'Executive dashboard creation in Power BI / Tableau', 'Predictive business forecasting and scenario analysis'],
    prerequisites: ['Spreadsheet proficiency', 'Analytical problem solving'],
    assessmentRubric: 'Metric accuracy & business logic (35%), Dashboard usability & design (30%), Strategic recommendations (25%), Documentation (10%)',
    createdAt: new Date().toISOString()
  },
  {
    id: 'cloud-computing',
    name: 'Cloud Computing',
    slug: 'cloud-computing',
    description: 'Deploy resilient cloud infrastructure with AWS/GCP, Docker containers, Kubernetes clusters, CI/CD pipelines, and serverless functions.',
    icon: 'Cloud',
    color: 'from-sky-600 to-blue-700',
    isActive: true,
    durationDays: 30,
    tags: ['AWS', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD'],
    learningObjectives: ['Cloud architectural patterns & infrastructure as code', 'Containerization with Docker & microservice orchestration', 'Automated CI/CD build and deployment pipelines'],
    prerequisites: ['Linux fundamentals', 'Basic networking', 'Git version control'],
    assessmentRubric: 'Infrastructure design & IaC (35%), Containerization & deployment reliability (30%), Cloud security & cost efficiency (25%), Documentation (10%)',
    createdAt: new Date().toISOString()
  },
  {
    id: 'iot',
    name: 'Internet of Things (IoT)',
    slug: 'internet-of-things',
    description: 'Architect connected device systems, MQTT sensor telemetry, embedded edge firmware, smart automation hubs, and cloud IoT dashboards.',
    icon: 'Wifi',
    color: 'from-teal-600 to-cyan-700',
    isActive: true,
    durationDays: 30,
    tags: ['ESP32', 'Arduino', 'MQTT', 'Node-RED', 'Edge Computing', 'Sensors'],
    learningObjectives: ['Microcontroller firmware development (ESP32/Arduino)', 'Sensor telemetry over MQTT & WebSockets', 'Cloud IoT ingest and rule-based actuator triggering'],
    prerequisites: ['C/C++ or Python basics', 'Basic electronics principles'],
    assessmentRubric: 'Hardware-firmware interfacing (35%), Telemetry protocol implementation (30%), Cloud dashboard integration (25%), Power & edge efficiency (10%)',
    createdAt: new Date().toISOString()
  },
  {
    id: 'digital-marketing',
    name: 'Digital Marketing',
    slug: 'digital-marketing',
    description: 'Execute growth campaigns, search engine optimization (SEO), content strategy, paid ad funnels, performance marketing, and web analytics.',
    icon: 'Megaphone',
    color: 'from-orange-500 to-pink-600',
    isActive: true,
    durationDays: 30,
    tags: ['SEO', 'Google Ads', 'Content Strategy', 'Analytics', 'Conversion Funnels'],
    learningObjectives: ['Comprehensive SEO audits & keyword research strategies', 'Multi-channel acquisition campaign design & A/B testing', 'Marketing analytics, ROAS tracking, and conversion rate optimization'],
    prerequisites: ['Basic digital literacy', 'Analytical and writing skills'],
    assessmentRubric: 'Strategy formulation & audience targeting (30%), Campaign asset quality (25%), Data analytics & optimization logic (30%), Growth proposal (15%)',
    createdAt: new Date().toISOString()
  },
  {
    id: 'software-engineering',
    name: 'Software Engineering',
    slug: 'software-engineering',
    description: 'Master core software engineering principles, design patterns, scalable system design, clean architecture, automated testing, and CI/CD.',
    icon: 'Layers',
    color: 'from-blue-700 to-slate-900',
    isActive: true,
    durationDays: 30,
    tags: ['System Design', 'Design Patterns', 'Unit Testing', 'Clean Architecture', 'Git Flow'],
    learningObjectives: ['Object-oriented design patterns & SOLID principles', 'Distributed system architecture & caching strategies', 'Automated test suites (Unit, Integration, E2E) and code review standards'],
    prerequisites: ['Any programming language proficiency', 'Data structures basics'],
    assessmentRubric: 'Architecture & pattern implementation (35%), Code quality & SOLID compliance (30%), Test suite coverage (25%), Documentation & profiling (10%)',
    createdAt: new Date().toISOString()
  },
  {
    id: 'python-dev',
    name: 'Python Programming',
    slug: 'python-programming',
    description: 'Deep dive into Python scripting, automation, object-oriented software engineering, FastAPI backends, and async concurrency.',
    icon: 'Terminal',
    color: 'from-amber-600 to-orange-600',
    isActive: true,
    durationDays: 30,
    tags: ['Python 3', 'OOP', 'FastAPI', 'Automation', 'Pytest', 'AsyncIO'],
    learningObjectives: ['Advanced Python data models & generator pipelines', 'RESTful API development with FastAPI and Pydantic', 'Automated testing with Pytest and async programming'],
    prerequisites: ['Basic computer science literacy', 'Logical reasoning'],
    assessmentRubric: 'Pythonic code style & typing (30%), API design & functionality (35%), Test coverage & edge cases (25%), Performance & packaging (10%)',
    createdAt: new Date().toISOString()
  },
  {
    id: 'java-dev',
    name: 'Java Programming',
    slug: 'java-development',
    description: 'Learn enterprise software patterns, Spring Boot microservices, multithreading, JPA/Hibernate, and resilient backend design.',
    icon: 'Coffee',
    color: 'from-red-600 to-rose-600',
    isActive: true,
    durationDays: 30,
    tags: ['Java 21', 'Spring Boot', 'Microservices', 'JPA/Hibernate', 'JUnit'],
    learningObjectives: ['Java object-oriented enterprise design patterns', 'Spring Boot REST microservices and JPA persistence', 'Concurrent multithreading and unit testing with JUnit/Mockito'],
    prerequisites: ['Object-oriented programming concepts', 'Basic database knowledge'],
    assessmentRubric: 'Enterprise pattern adherence (35%), Spring Boot implementation (30%), Unit test coverage (20%), Code maintainability (15%)',
    createdAt: new Date().toISOString()
  },
  {
    id: 'database-management',
    name: 'Database Management',
    slug: 'database-management',
    description: 'Master relational schema modeling, indexing optimization, ACID transactions, complex SQL queries, and NoSQL document stores.',
    icon: 'Database',
    color: 'from-emerald-700 to-teal-800',
    isActive: true,
    durationDays: 30,
    tags: ['PostgreSQL', 'MySQL', 'MongoDB', 'Indexing', 'Query Optimization', 'ACID'],
    learningObjectives: ['Relational schema normalization (3NF/BCNF)', 'Query execution plan analysis and index tuning', 'NoSQL aggregation pipelines and distributed transaction isolation'],
    prerequisites: ['Basic SQL familiarity', 'Relational data concepts'],
    assessmentRubric: 'Schema normalization & modeling (35%), Query optimization & execution profiling (35%), Integrity constraints & transaction safety (20%), Documentation (10%)',
    createdAt: new Date().toISOString()
  },
  {
    id: 'blockchain-dev',
    name: 'Blockchain Development',
    slug: 'blockchain-development',
    description: 'Develop decentralized smart contracts, Web3 dApps, tokenomics models, cryptographic proofs, and decentralized security audits.',
    icon: 'Lock',
    color: 'from-purple-700 to-indigo-900',
    isActive: true,
    durationDays: 30,
    tags: ['Solidity', 'Web3.js', 'Ethers.js', 'Smart Contracts', 'Hardhat', 'IPFS'],
    learningObjectives: ['Smart contract development with Solidity & Hardhat', 'Cryptographic hashing, gas optimization, and reentrancy protection', 'Web3 wallet integration and decentralized storage (IPFS)'],
    prerequisites: ['Programming fundamentals', 'Cryptographic basics'],
    assessmentRubric: 'Smart contract security & audit checks (40%), Gas optimization & logic (30%), Frontend dApp integration (20%), Test suite coverage (10%)',
    createdAt: new Date().toISOString()
  },
  {
    id: 'graphic-design',
    name: 'Graphic Design',
    slug: 'graphic-design',
    description: 'Create impactful visual identities, brand typography guidelines, vector illustrations, promotional collateral, and digital asset kits.',
    icon: 'Brush',
    color: 'from-fuchsia-600 to-pink-700',
    isActive: true,
    durationDays: 30,
    tags: ['Photoshop', 'Illustrator', 'Branding', 'Typography', 'Visual Identity'],
    learningObjectives: ['Brand identity systems and logo design guidelines', 'Color theory, print layout preparation, and vector illustrations', 'Digital media asset optimization across social formats'],
    prerequisites: ['Visual arts interest', 'Basic software familiarity'],
    assessmentRubric: 'Creative originality & brand concept (35%), Typography & color harmony (35%), Technical asset execution & formats (20%), Style guide presentation (10%)',
    createdAt: new Date().toISOString()
  },
  {
    id: 'content-creation',
    name: 'Content Creation',
    slug: 'content-creation',
    description: 'Craft compelling technical narratives, video production storyboards, multi-platform publishing strategies, and audience engagement plans.',
    icon: 'Video',
    color: 'from-rose-600 to-red-700',
    isActive: true,
    durationDays: 30,
    tags: ['Storyboarding', 'Video Editing', 'Technical Writing', 'Podcasting', 'Audience Growth'],
    learningObjectives: ['Engaging narrative development & video production workflows', 'Search-optimized technical copywriting and scriptwriting', 'Content distribution calendars and retention analytics'],
    prerequisites: ['Strong communication skills', 'Creative storytelling passion'],
    assessmentRubric: 'Narrative clarity & hook engagement (35%), Production value & editing (30%), Distribution strategy & audience fit (25%), Deliverable polish (10%)',
    createdAt: new Date().toISOString()
  },
  {
    id: 'fintech',
    name: 'Finance and FinTech',
    slug: 'finance-and-fintech',
    description: 'Analyze financial markets, build automated algorithmic trading simulators, fraud detection models, and payment gateway architectures.',
    icon: 'DollarSign',
    color: 'from-emerald-600 to-green-800',
    isActive: true,
    durationDays: 30,
    tags: ['Algorithmic Trading', 'Risk Modeling', 'Payment APIs', 'Fraud Detection', 'Financial Ratios'],
    learningObjectives: ['Quantitative financial modeling & valuation metrics', 'Payment gateway API integrations & PCI compliance basics', 'Algorithmic backtesting and risk assessment models'],
    prerequisites: ['Basic finance concepts', 'Python or spreadsheet modeling'],
    assessmentRubric: 'Financial logic & numerical accuracy (35%), Algorithmic model robustness (35%), Security & compliance standards (20%), Documentation (10%)',
    createdAt: new Date().toISOString()
  },
  {
    id: 'hr-management',
    name: 'Human Resources and Management',
    slug: 'human-resources-and-management',
    description: 'Develop structured talent acquisition pipelines, performance appraisal rubrics, employee engagement frameworks, and HR policy manuals.',
    icon: 'Users',
    color: 'from-blue-600 to-teal-700',
    isActive: true,
    durationDays: 30,
    tags: ['Talent Acquisition', 'HR Analytics', 'Onboarding Frameworks', 'Performance Management'],
    learningObjectives: ['Competency-based recruitment & structured interview design', 'HR metrics tracking (attrition, time-to-hire, eNPS)', 'Organizational culture frameworks and dispute resolution policies'],
    prerequisites: ['Interpersonal skills', 'Organizational interest'],
    assessmentRubric: 'Policy depth & legal compliance (35%), Framework usability & clarity (35%), Metric-driven HR analytics (20%), Presentation quality (10%)',
    createdAt: new Date().toISOString()
  },
  {
    id: 'entrepreneurship',
    name: 'Entrepreneurship and Business Development',
    slug: 'entrepreneurship-and-business-development',
    description: 'Formulate viable business models, Lean Canvas blueprints, pitch decks, competitive go-to-market strategies, and revenue forecasts.',
    icon: 'Briefcase',
    color: 'from-amber-600 to-red-700',
    isActive: true,
    durationDays: 30,
    tags: ['Lean Canvas', 'Go-To-Market', 'Pitch Deck', 'Unit Economics', 'Product-Market Fit'],
    learningObjectives: ['Customer discovery & product-market fit validation', 'Unit economics modeling (CAC, LTV, Burn Rate, Margins)', 'Investor pitch deck creation and go-to-market launch planning'],
    prerequisites: ['Commercial curiosity', 'Entrepreneurial mindset'],
    assessmentRubric: 'Value proposition & market feasibility (35%), Financial model & unit economics (35%), Pitch presentation & strategic clarity (20%), Execution roadmap (10%)',
    createdAt: new Date().toISOString()
  },
  {
    id: 'ece-engineering',
    name: 'Electronics & Communication (ECE)',
    slug: 'electronics-and-communication',
    description: 'Master embedded systems, IoT sensor telemetry, microcontroller programming (ESP32/STM32), digital signal processing (DSP), and hardware-software interfacing.',
    icon: 'Radio',
    color: 'from-cyan-600 to-indigo-700',
    isActive: true,
    durationDays: 30,
    tags: ['Embedded C', 'IoT', 'ESP32', 'VLSI', 'Signal Processing', 'Microcontrollers'],
    learningObjectives: ['Embedded microcontroller firmware architecture', 'Digital signal processing and sensor calibration', 'Hardware-software serial telemetry and edge processing'],
    prerequisites: ['C/C++ basics', 'Circuit analysis fundamentals'],
    assessmentRubric: 'Firmware design & correctness (35%), Hardware interfacing & sensor accuracy (30%), Signal integrity & power efficiency (20%), Documentation (15%)',
    createdAt: new Date().toISOString()
  }
];

// Seed 5 Projects for each domain
function generateDefaultProjects(): ProjectTask[] {
  const tasks: ProjectTask[] = [];
  
  DEFAULT_DOMAINS.forEach(dom => {
    // Task 1: Dedicated Official Onboarding & Verification (Offer Letter + YouTube & LinkedIn Verification)
    tasks.push({
      id: `${dom.id}-task-1`,
      domainId: dom.id,
      taskNumber: 1,
      title: `Task 1: Official Onboarding & Verification (Offer Letter + YouTube & LinkedIn Verification)`,
      objective: `Review and verify your official VirIntern Internship Offer Letter, subscribe and auto-verify on the official YouTube Channel (@virintern), and verify your LinkedIn commencement announcement post.`,
      description: `Welcome to your VirIntern Virtual Internship in ${dom.name}! Complete your enrollment verification by accepting your pre-attached appointment offer letter, joining our official YouTube community, and verifying your LinkedIn announcement.`,
      difficulty: 'Beginner',
      instructions: [
        'Preview and save your Official VirIntern Internship Offer Letter (pre-attached to your student profile).',
        'Confirm active subscriber membership in the official YouTube Community (@virintern) using automated verification.',
        'Share your official offer letter announcement on LinkedIn and verify your post link.',
        'Submit this onboarding milestone to immediately unlock your assigned virtual internship projects.'
      ],
      expectedOutput: 'Verified Offer Letter Acceptance + Confirmed YouTube Channel Subscriber Status + Verified LinkedIn Announcement Post Link.',
      submissionType: 'document_or_link',
      verificationRequirement: 'Pre-Attached Official Offer Letter Verification + Automated YouTube Community Subscribe + Verified LinkedIn Post',
      offerLetterRequired: true,
      offerLetterInstructions: 'Your official VirIntern Internship Offer Letter is pre-attached and ready. Preview or save your copy anytime from the dashboard.',
      offerLetterTemplateUrl: 'https://virintern.com/docs/offer-letter-template.pdf',
      offerLetterTemplateName: 'VirIntern_Official_Offer_Letter_Template.pdf',
      resources: [
        { title: 'Official VirIntern Program Orientation', url: 'https://virintern.com' },
        { title: 'YouTube Community Channel (@virintern)', url: 'https://youtube.com/@virintern?sub_confirmation=1' }
      ],
      isActive: true,
      createdAt: new Date().toISOString()
    });

    // Task 2: Project Development
    tasks.push({
      id: `${dom.id}-task-2`,
      domainId: dom.id,
      taskNumber: 2,
      title: `Task 2: Development - Dynamic Features & Integration`,
      objective: `Build core business logic, interactive workflows, and integrate external data sources or storage.`,
      description: `Advance your ${dom.name} system by building responsive data-driven modules, handling state, and managing error states robustly.`,
      difficulty: 'Intermediate',
      instructions: [
        'Implement dynamic data ingestion, interactive user actions, or algorithmic processing.',
        'Design modular architecture ensuring separation of concerns.',
        'Handle edge cases, loading spinners, and network exceptions gracefully.',
        'Commit progress regularly with descriptive git commit messages.'
      ],
      expectedOutput: 'Interactive project deployed on a public host or repository with demonstration recording/screen link.',
      submissionType: 'all',
      resources: [
        { title: 'Architecture Patterns & API Integration Guide', url: 'https://github.com' },
        { title: 'Best Practices for Clean Code & Structure', url: 'https://github.com' }
      ],
      isActive: true,
      createdAt: new Date().toISOString()
    });

    // Task 3: Advanced Project
    tasks.push({
      id: `${dom.id}-task-3`,
      domainId: dom.id,
      taskNumber: 3,
      title: `Task 3: Advanced - Performance, Optimization & Security`,
      objective: `Harden security controls, optimize run-time throughput, and implement advanced domain features.`,
      description: `Elevate your solution by introducing caching, authentication or data sanitization, schema validation, and benchmark metrics.`,
      difficulty: 'Intermediate',
      instructions: [
        'Profile performance bottlenecks and apply memoization, indexed queries, or asset optimization.',
        'Enforce input sanitization, security headers, and secure credential handling.',
        'Implement automated tests covering critical business paths.',
        'Provide benchmark or test coverage report in repository.'
      ],
      expectedOutput: 'Optimized codebase passing validation tests with comprehensive documentation.',
      submissionType: 'github_and_demo',
      resources: [
        { title: 'Web & System Security Best Practices', url: 'https://owasp.org' },
        { title: 'Performance Profiling Deep-Dive', url: 'https://web.dev' }
      ],
      isActive: true,
      createdAt: new Date().toISOString()
    });

    // Task 4: Final Project
    tasks.push({
      id: `${dom.id}-task-4`,
      domainId: dom.id,
      taskNumber: 4,
      title: `Task 4: Production - CI/CD, Testing & Scalability`,
      objective: `Prepare enterprise-grade continuous deployment, automated workflows, and production telemetry.`,
      description: `Simulate a real engineering team sprint by integrating continuous integration workflows, containerization or bundle optimizations, and production readiness checks.`,
      difficulty: 'Advanced',
      instructions: [
        'Configure automated continuous deployment (GitHub Actions / Cloud Run / Vercel).',
        'Implement end-to-end integration tests and health-check endpoints.',
        'Create professional release notes with version tagging.',
        'Prepare staging and live preview environments.'
      ],
      expectedOutput: 'Live production URL with automated CI/CD pipeline badge in the repository.',
      submissionType: 'all',
      resources: [
        { title: 'Continuous Integration & Delivery Masterclass', url: 'https://github.com/features/actions' },
        { title: 'Production Deployment Checklist', url: 'https://12factor.net' }
      ],
      isActive: true,
      createdAt: new Date().toISOString()
    });

    // Task 5: Capstone Project
    tasks.push({
      id: `${dom.id}-task-5`,
      domainId: dom.id,
      taskNumber: 5,
      title: `Task 5: Capstone - Complete End-to-End Enterprise Solution`,
      objective: `Deliver a complete, polished, portfolio-ready product solving a real industry problem in ${dom.name}.`,
      description: `Synthesize everything you have built into a cohesive, high-impact flagship capstone project. Includes user guide, architecture diagram, live demo, and video walkthrough.`,
      difficulty: 'Advanced',
      instructions: [
        'Architect and execute a comprehensive capstone solution fulfilling all domain project specifications.',
        'Write an in-depth case study detailing problem statement, technical decisions, challenges overcome, and future roadmap.',
        'Deploy the finished application publicly and provide live demo credentials if necessary.',
        'Record a concise 2-3 minute project demonstration or Loom walkthrough.'
      ],
      expectedOutput: 'Fully deployed flagship capstone, public GitHub repository, architecture diagram, and demo link.',
      submissionType: 'all',
      resources: [
        { title: 'How to Build an Outstanding Technical Portfolio Piece', url: 'https://github.com' },
        { title: 'Software Architecture Documentation Standards', url: 'https://c4model.com' }
      ],
      isActive: true,
      createdAt: new Date().toISOString()
    });
  });

  return tasks;
}

// Default ₹99 Package configuration (admin editable!)
const DEFAULT_PACKAGE: PackageConfig = {
  id: 'virintern-completion-package',
  title: 'VirIntern Official Completion Package',
  price: 99,
  originalPrice: 999,
  currency: 'INR',
  description: 'Boost your career with verified credentials, high-impact certificates, interview prep, and industry resume kit.',
  features: [
    'Official Internship Completion Certificate (Digital & High-Res PDF)',
    'Certificate of Appreciation for outstanding project execution',
    'VirIntern Verified Digital Badge with unique verifiable credential ID',
    'Interactive Resume Builder Kit with ATS-friendly templates & copy',
    '1000+ Interview Questions Bank with in-depth answers & explanations across 10 categories',
    'Public Credential Verification URL & QR code for LinkedIn & Recruiters',
    'Lifetime access to resource updates & future career materials'
  ],
  isActive: true,
  updatedAt: new Date().toISOString()
};

// Initial Seed Package Benefits (100% dynamic - Admin can Add, Edit, Delete, Reorder, Toggle, Upload Files)
export const DEFAULT_PACKAGE_BENEFITS: PackageBenefit[] = [
  {
    id: 'benefit_comp_cert',
    title: 'Verified Completion Certificate',
    description: 'ISO-grade digital certificate with verifiable ID, QR code, and public authenticity URL.',
    icon: 'Award',
    isActive: true,
    order: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'benefit_appr_cert',
    title: 'Letter of Appreciation & Commendation',
    description: 'Issued by VirIntern mentorship board acknowledging distinction and milestone excellence.',
    icon: 'Star',
    isActive: true,
    order: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'benefit_badge',
    title: 'VirIntern Verified Digital Badge',
    description: 'Shareable badge for LinkedIn profile, GitHub profile README, and portfolio websites.',
    icon: 'ShieldCheck',
    isActive: true,
    order: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'benefit_resume',
    title: 'ATS Resume Builder & Project Kit',
    description: 'ATS-optimized templates with pre-populated project accomplishments and downloadable export format.',
    icon: 'FileText',
    isActive: true,
    order: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'benefit_interview',
    title: '1000+ Interview Question & Answer Bank',
    description: 'Curated technical, HR, system design, and coding interview question bank with solutions across 10 categories.',
    icon: 'BookOpen',
    isActive: true,
    order: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// 1000+ Interview Questions Curated Sample across all categories
const INTERVIEW_QUESTIONS_SEED: InterviewQuestionItem[] = [
  {
    id: 'hr-1',
    category: 'HR',
    difficulty: 'Easy',
    question: 'Tell me about yourself and your journey into technology.',
    answer: 'Structure your response using the Past-Present-Future framework: Briefly mention your educational background and foundational curiosity (Past), highlight your hands-on internship projects and recent achievements (Present), and connect why this target role aligns with your long-term ambitions (Future).',
    explanation: 'Keep it within 90-120 seconds. Focus on tangible project outcomes and problem-solving passion.'
  },
  {
    id: 'hr-2',
    category: 'HR',
    difficulty: 'Medium',
    question: 'Describe a time when you faced a major technical obstacle in a project. How did you resolve it?',
    answer: 'Use the STAR method (Situation, Task, Action, Result). State the obstacle clearly, explain your systematic debugging or research approach (reading logs, consulting documentation, isolating variables), and showcase the successful resolution along with measurable learning.',
    explanation: 'Interviewers look for resilience, methodical thinking, and continuous learning.'
  },
  {
    id: 'tech-1',
    category: 'Technical',
    difficulty: 'Medium',
    question: 'Explain the difference between synchronous and asynchronous code execution.',
    answer: 'Synchronous execution is blocking: each statement waits for the previous one to complete before executing. Asynchronous execution is non-blocking: long-running tasks (I/O, network requests, timers) execute in the background via event loops or threads, invoking callbacks or resolving promises when done without freezing the main thread.',
    explanation: 'Crucial for high-concurrency systems, UI responsiveness, and backend API throughput.'
  },
  {
    id: 'prog-1',
    category: 'Programming',
    difficulty: 'Medium',
    question: 'What is the Event Loop in JavaScript and how does it manage the Call Stack and Microtask Queue?',
    answer: 'The event loop continuously monitors the Call Stack and Task Queues. When the call stack is empty, it first empties all microtasks (Promise callbacks, queueMicrotask, MutationObserver) before processing the next macrotask (setTimeout, setInterval, I/O events).',
    explanation: 'Promises have higher scheduling priority than setTimeout(..., 0).'
  },
  {
    id: 'web-1',
    category: 'Web Development',
    difficulty: 'Medium',
    question: 'What are the main performance optimization techniques in modern frontend applications?',
    answer: '1. Code splitting & lazy loading via dynamic imports. 2. Image compression and WebP/AVIF formats with responsive srcset. 3. Tree-shaking unused dependencies. 4. Caching strategies using service workers or HTTP cache-control. 5. Minimizing DOM re-renders using virtualized lists and memoization.',
    explanation: 'These directly improve Core Web Vitals like LCP, INP, and CLS.'
  },
  {
    id: 'ai-1',
    category: 'AI/ML',
    difficulty: 'Hard',
    question: 'What is the vanishing gradient problem in deep neural networks and how is it mitigated?',
    answer: 'During backpropagation, gradients are calculated by the chain rule of derivatives. In deep networks using sigmoid or tanh activation functions, gradients become exponentially small as they propagate back, preventing early layers from updating weights. It is mitigated using: 1. ReLU / Leaky ReLU activations, 2. Residual skip connections (ResNet), 3. Batch Normalization, and 4. Xavier/He weight initialization.',
    explanation: 'Skip connections allow gradient highways to flow directly back to shallow layers.'
  },
  {
    id: 'dbms-1',
    category: 'DBMS',
    difficulty: 'Medium',
    question: 'Explain the ACID properties in database transactions.',
    answer: 'Atomicity: All operations in a transaction succeed, or all roll back. Consistency: The database transitions strictly from one valid state to another, obeying all constraints. Isolation: Concurrent transactions do not interfere with one another. Durability: Once committed, data persists permanently even during power outages or system crashes.',
    explanation: 'Vital for financial systems and transactional reliability.'
  },
  {
    id: 'os-1',
    category: 'Operating Systems',
    difficulty: 'Medium',
    question: 'What is the distinction between a Process and a Thread?',
    answer: 'A Process is an executing instance of a program with its own dedicated memory space, file descriptors, and virtual address space. A Thread is the smallest unit of execution within a process; threads in the same process share code, data, and heap memory, but have their own registers and call stack.',
    explanation: 'Context switching between threads is faster than processes due to shared memory spaces.'
  },
  {
    id: 'net-1',
    category: 'Networking',
    difficulty: 'Medium',
    question: 'Explain what happens under the hood when you enter a URL in a browser and press Enter.',
    answer: '1. DNS Lookup: Browser resolves domain to IP via browser cache, OS cache, router cache, and recursive DNS servers. 2. TCP Handshake: 3-way handshake (SYN, SYN-ACK, ACK) establishes connection. 3. TLS Handshake: Negotiates encryption keys for HTTPS. 4. HTTP Request: Browser sends GET request with headers. 5. Server Response: Server processes and returns HTTP status code (200) + HTML payload. 6. Rendering: Browser parses HTML to DOM, CSS to CSSOM, executes JS, and paints the page.',
    explanation: 'A classic full-stack interview question testing holistic architectural knowledge.'
  },
  {
    id: 'ds-1',
    category: 'Data Structures',
    difficulty: 'Medium',
    question: 'Compare Hash Table vs Binary Search Tree (BST) for search operations.',
    answer: 'Hash Table provides O(1) average time complexity for search, insert, and delete using key hashing, but degrades to O(N) in case of worst-case collisions and does not maintain sorted order. A balanced BST (AVL or Red-Black tree) guarantees O(log N) time complexity for search, insert, and delete, and keeps data continuously sorted.',
    explanation: 'Use Hash Table when exact key lookup speed is primary; use BST when range queries or order traversal are required.'
  },
  {
    id: 'apt-1',
    category: 'Aptitude',
    difficulty: 'Easy',
    question: 'A train 150 meters long passes a telegraph post in 12 seconds. What is the speed of the train in km/hr?',
    answer: 'Speed = Distance / Time = 150m / 12s = 12.5 m/s. To convert m/s to km/hr, multiply by 18/5: 12.5 * (18 / 5) = 45 km/hr.',
    explanation: 'Basic quantitative aptitude formula: (m/s * 18/5 = km/hr).'
  },
  {
    id: 'ece-1',
    category: 'ECE & Embedded',
    difficulty: 'Medium',
    question: 'Explain the fundamental differences between a Microprocessor (MPU) and a Microcontroller (MCU).',
    answer: 'An MPU (e.g., Intel Core, ARM Cortex-A) contains only CPU cores and relies on external RAM, ROM, and peripherals via a system bus. It is optimized for high computational throughput and multitasking OSs. An MCU (e.g., STM32, ESP32, ATmega328P) integrates CPU, RAM, Flash memory, timers, ADC, and I/O peripherals onto a single silicon chip, designed for low-power dedicated embedded control tasks.',
    explanation: 'MCUs excel in real-time control, low cost, and low power; MPUs excel in heavy OS computation.'
  },
  {
    id: 'ece-2',
    category: 'ECE & Embedded',
    difficulty: 'Medium',
    question: 'Compare I2C, SPI, and UART communication protocols used in embedded hardware.',
    answer: '1. UART: Asynchronous, point-to-point (2 wires: TX, RX), no clock line, uses agreed baud rates. 2. SPI: Synchronous, master-slave, full-duplex, 4 wires (MOSI, MISO, SCK, CS), high throughput (up to 50+ MHz). 3. I2C: Synchronous, multi-master/multi-slave, half-duplex, 2 wires (SDA, SCL) with open-drain pull-up resistors, addressed bus architecture supporting up to 127 devices.',
    explanation: 'SPI is fastest for display/storage; I2C saves pins for multiple sensor networks; UART connects serial debugging.'
  },
  {
    id: 'ece-3',
    category: 'ECE & Embedded',
    difficulty: 'Hard',
    question: 'What is Setup Time and Hold Time in digital VLSI sequential circuits? What happens if they are violated?',
    answer: 'Setup Time (t_setup) is the minimum duration the data input must remain stable before the active clock edge arrives. Hold Time (t_hold) is the minimum duration the data must remain stable after the active clock edge. If violated, flip-flops enter a metastable state where output voltage oscillates indeterminately between logic 0 and 1, causing unpredictable circuit glitches.',
    explanation: 'Fundamental concept tested across hardware design, FPGA, and ASIC engineering roles.'
  }
];

class DataService {
  private localPrefix = 'virintern_data_';
  private eventBus = new Map<string, Set<(data: any) => void>>();
  private broadcastChannel: BroadcastChannel | null = null;
  private sseSource: EventSource | null = null;
  private sseActive = false;

  constructor() {
    this.purgeLegacyTestCaches();

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('virintern_realtime_sync');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data && event.data.channel) {
            this.emitLocal(event.data.channel, event.data.payload);
          }
        };
      } catch (e) {
        // BroadcastChannel unavailable
      }
    }

    if (typeof window !== 'undefined') {
      this.ensureLiveEvents();
    }
  }

  private purgeLegacyTestCaches(): void {
    if (typeof window === 'undefined') return;
    try {
      const purgeFlag = 'virintern_cache_purge_v2';
      if (!localStorage.getItem(purgeFlag)) {
        const keysToClear: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          if (
            k === `${this.localPrefix}leaderboard` ||
            k === `${this.localPrefix}submissions` ||
            k === `${this.localPrefix}all_users` ||
            k === `${this.localPrefix}evaluations` ||
            k === `${this.localPrefix}all_evaluations` ||
            k === `${this.localPrefix}audit_logs` ||
            k === `${this.localPrefix}talent_candidates` ||
            k.startsWith(`${this.localPrefix}submissions_`) ||
            k.startsWith(`${this.localPrefix}sub_`) ||
            k.startsWith(`${this.localPrefix}submission_`) ||
            k.startsWith(`${this.localPrefix}domain_lb_`)
          ) {
            keysToClear.push(k);
          }
        }
        keysToClear.forEach(k => localStorage.removeItem(k));
        localStorage.setItem(purgeFlag, new Date().toISOString());
      }
    } catch {
      // ignore storage errors
    }
  }

  public ensureLiveEvents(): void {
    if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') return;
    if (this.sseSource && this.sseSource.readyState !== EventSource.CLOSED) return;

    try {
      const es = new EventSource('/api/live-events');
      this.sseSource = es;
      this.sseActive = true;

      const parsePayload = (evt: MessageEvent) => {
        try {
          return JSON.parse(evt.data);
        } catch {
          return null;
        }
      };

      es.addEventListener('submission_created', (evt) => {
        const payload = parsePayload(evt as MessageEvent);
        if (payload && payload.userId) {
          const norm = this.normalizeSubmission(payload);
          const curAll = this.getLocal<TaskSubmission[]>('submissions', []);
          const nextAll = this.mergeSubmissionsList([norm], curAll);
          this.setLocal('submissions', nextAll);
          this.emitLocal('submissions', nextAll);

          const curUser = this.getLocal<TaskSubmission[]>(`submissions_${norm.userId}`, []);
          const nextUser = this.mergeSubmissionsList([norm], curUser);
          this.setLocal(`submissions_${norm.userId}`, nextUser);
          this.emitLocal(`submissions_${norm.userId}`, nextUser);
        }
        this.emitLocal('submission_created', payload);
        window.dispatchEvent(new CustomEvent('virintern_submission_created', { detail: payload }));
      });

      es.addEventListener('submission_updated', (evt) => {
        const payload = parsePayload(evt as MessageEvent);
        if (payload && payload.userId) {
          const norm = this.normalizeSubmission(payload);
          const curAll = this.getLocal<TaskSubmission[]>('submissions', []);
          const nextAll = this.mergeSubmissionsList([norm], curAll);
          this.setLocal('submissions', nextAll);
          this.emitLocal('submissions', nextAll);

          const curUser = this.getLocal<TaskSubmission[]>(`submissions_${norm.userId}`, []);
          const nextUser = this.mergeSubmissionsList([norm], curUser);
          this.setLocal(`submissions_${norm.userId}`, nextUser);
          this.emitLocal(`submissions_${norm.userId}`, nextUser);
        }
        this.emitLocal('submission_updated', payload);
        window.dispatchEvent(new CustomEvent('virintern_submission_updated', { detail: payload }));
      });

      es.addEventListener('submission_verified', (evt) => {
        const payload = parsePayload(evt as MessageEvent);
        const subPayload = payload?.submission || payload;
        if (subPayload && subPayload.userId) {
          const norm = this.normalizeSubmission(subPayload);
          const curAll = this.getLocal<TaskSubmission[]>('submissions', []);
          const nextAll = this.mergeSubmissionsList([norm], curAll);
          this.setLocal('submissions', nextAll);
          this.emitLocal('submissions', nextAll);
        }
        this.emitLocal('submission_verified', payload);
        this.emitLocal('submission_updated', subPayload);
        window.dispatchEvent(new CustomEvent('virintern_submission_updated', { detail: subPayload }));
        window.dispatchEvent(new CustomEvent('virintern_leaderboard_updated', { detail: payload }));
      });

      es.addEventListener('leaderboard_updated', (evt) => {
        const payload = parsePayload(evt as MessageEvent);
        if (Array.isArray(payload)) {
          this.setLocal('leaderboard', payload);
        }
        this.emitLocal('leaderboard_updated', payload);
        window.dispatchEvent(new CustomEvent('virintern_leaderboard_updated', { detail: payload }));
      });

      es.addEventListener('internship_updated', (evt) => {
        const payload = parsePayload(evt as MessageEvent);
        if (payload?.userId) {
          this.setLocal(`internship_${payload.userId}`, payload);
          if (payload.domainId) {
            this.setLocal(`internship_${payload.userId}_${payload.domainId}`, payload);
          }
          this.emitLocal(`internship_${payload.userId}`, payload);
        }
        this.emitLocal('internship_updated', payload);
        window.dispatchEvent(new CustomEvent('virintern_internship_updated', { detail: payload }));
      });

      es.addEventListener('user_updated', (evt) => {
        const payload = parsePayload(evt as MessageEvent);
        if (payload?.uid) {
          this.setLocal(`user_${payload.uid}`, payload);
          this.emitLocal(`user_${payload.uid}`, payload);
        }
        this.emitLocal('user_updated', payload);
        window.dispatchEvent(new CustomEvent('virintern_user_updated', { detail: payload }));
      });

      es.onerror = () => {
        this.sseActive = false;
      };
    } catch {
      this.sseActive = false;
    }
  }

  // Reactive Event Bus
  public emit(channel: string, payload: any): void {
    this.emitLocal(channel, payload);
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ channel, payload });
      } catch (e) {
        // ignore
      }
    }
  }

  private emitLocal(channel: string, payload: any): void {
    const set = this.eventBus.get(channel);
    if (set) {
      set.forEach(cb => {
        try {
          cb(payload);
        } catch (err) {
          console.error(`Error in event listener for ${channel}:`, err);
        }
      });
    }
  }

  public on(channel: string, callback: (data: any) => void): () => void {
    if (!this.eventBus.has(channel)) {
      this.eventBus.set(channel, new Set());
    }
    const set = this.eventBus.get(channel)!;
    set.add(callback);
    return () => {
      set.delete(callback);
      if (set.size === 0) {
        this.eventBus.delete(channel);
      }
    };
  }

  // In-memory persistent cache to guarantee zero data loss and prevent localStorage quota drops
  private memoryStore = new Map<string, any>();

  public clearSession(): void {
    // Clear user-specific keys while preserving global configuration
    const preservePrefixes = ['domains', 'projects', 'package', 'package_benefits', 'system_settings'];
    for (const key of Array.from(this.memoryStore.keys())) {
      if (!preservePrefixes.some(p => key.startsWith(p))) {
        this.memoryStore.delete(key);
      }
    }
  }

  // Generic local fallback helpers with in-memory caching & quota protection
  private getLocal<T>(key: string, fallback: T): T {
    if (this.memoryStore.has(key)) {
      return this.memoryStore.get(key) as T;
    }
    try {
      const data = typeof window !== 'undefined' ? localStorage.getItem(this.localPrefix + key) : null;
      if (data) {
        const parsed = JSON.parse(data);
        this.memoryStore.set(key, parsed);
        return parsed;
      }
      return fallback;
    } catch {
      return fallback;
    }
  }

  private setLocal<T>(key: string, val: T): void {
    this.memoryStore.set(key, val);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(this.localPrefix + key, JSON.stringify(val));
      }
    } catch {
      // LocalStorage QuotaExceededError fallback:
      // Strip oversized base64 screenshots only from localStorage while keeping full media in memoryStore & server
      try {
        if (typeof window !== 'undefined' && Array.isArray(val)) {
          const sanitized = (val as any[]).map(item => {
            if (item && item.youtubeScreenshotUrl && item.youtubeScreenshotUrl.length > 500) {
              return { ...item, youtubeScreenshotUrl: '', youtubeScreenshotStoredOnServer: true };
            }
            return item;
          });
          localStorage.setItem(this.localPrefix + key, JSON.stringify(sanitized));
        }
      } catch {
        // memoryStore retains all data
      }
    }
  }

  // Initialize all base collections
  public async initializeDatabase(): Promise<void> {
    const existingDomains = this.getLocal<DomainItem[]>('domains', []);
    if (!existingDomains.length) {
      this.setLocal('domains', DEFAULT_DOMAINS);
    } else {
      let modified = false;
      DEFAULT_DOMAINS.forEach((defDom) => {
        if (!existingDomains.some((d) => d.id === defDom.id)) {
          existingDomains.push(defDom);
          modified = true;
        }
      });
      if (modified) {
        this.setLocal('domains', existingDomains);
        this.emit('domains', existingDomains);
      }
    }

    const existingProjects = this.getLocal<ProjectTask[]>('projects', []);
    if (!existingProjects.length) {
      this.setLocal('projects', generateDefaultProjects());
    } else {
      const defaultProjs = generateDefaultProjects();
      let projModified = false;
      defaultProjs.forEach((defProj) => {
        if (!existingProjects.some((p) => p.id === defProj.id)) {
          existingProjects.push(defProj);
          projModified = true;
        }
      });
      if (projModified) {
        this.setLocal('projects', existingProjects);
        this.emit('projects', existingProjects);
      }
    }

    const existingPkg = this.getLocal<PackageConfig | null>('package', null);
    if (!existingPkg) {
      this.setLocal('package', DEFAULT_PACKAGE);
    }

    const existingBenefits = this.getLocal<PackageBenefit[]>('package_benefits', []);
    if (!existingBenefits.length) {
      this.setLocal('package_benefits', DEFAULT_PACKAGE_BENEFITS);
    }

    const existingQA = this.getLocal<InterviewQuestionItem[]>('questions', []);
    if (!existingQA.length) {
      this.setLocal('questions', INTERVIEW_QUESTIONS_SEED);
    }

    // Attempt firestore bootstrap silently
    try {
      const pkgRef = doc(db, 'packages', DEFAULT_PACKAGE.id);
      const pkgSnap = await getDoc(pkgRef);
      if (!pkgSnap.exists()) {
        await setDoc(pkgRef, DEFAULT_PACKAGE);
      }

      // Bootstrap packageBenefits if Firestore collection is empty
      const benefitsSnap = await getDocs(collection(db, 'packageBenefits'));
      if (benefitsSnap.empty) {
        for (const benefit of DEFAULT_PACKAGE_BENEFITS) {
          await setDoc(doc(db, 'packageBenefits', benefit.id), benefit);
        }
      }
    } catch (err) {
      // Firestore offline or rules not deployed yet; local storage guarantees full function
    }
  }

  // DOMAINS
  public async getDomains(): Promise<DomainItem[]> {
    let local = this.getLocal<DomainItem[]>('domains', DEFAULT_DOMAINS);
    // Guarantee all default domains (including ECE) are always present
    let modified = false;
    DEFAULT_DOMAINS.forEach((defDom) => {
      if (!local.some((d) => d.id === defDom.id)) {
        local.push(defDom);
        modified = true;
      }
    });
    if (modified) {
      this.setLocal('domains', local);
      this.emit('domains', local);
    }

    // Background revalidate without blocking UI
    getDocs(collection(db, 'domains')).then((snap) => {
      if (!snap.empty) {
        const list: DomainItem[] = [];
        snap.forEach(d => list.push(d.data() as DomainItem));
        // Ensure default domains are never wiped by partial remote collection
        DEFAULT_DOMAINS.forEach((defDom) => {
          if (!list.some((d) => d.id === defDom.id)) {
            list.push(defDom);
          }
        });
        this.setLocal('domains', list);
        this.emit('domains', list);
      }
    }).catch(() => {});
    return local;
  }

  public async saveDomain(domain: DomainItem): Promise<void> {
    const domains = await this.getDomains();
    const idx = domains.findIndex(d => d.id === domain.id);
    if (idx >= 0) {
      domains[idx] = domain;
    } else {
      domains.push(domain);
    }
    this.setLocal('domains', domains);
    this.emit('domains', domains);

    try {
      await setDoc(doc(db, 'domains', domain.id), domain);
    } catch (error) {
      // Handled via local fallback
    }
  }

  public async deleteDomain(id: string): Promise<void> {
    const domains = (await this.getDomains()).filter(d => d.id !== id);
    this.setLocal('domains', domains);
    this.emit('domains', domains);

    try {
      await deleteDoc(doc(db, 'domains', id));
    } catch (e) {
      // fallback
    }
  }

  public subscribeDomains(callback: (domains: DomainItem[]) => void): () => void {
    callback(this.getLocal<DomainItem[]>('domains', DEFAULT_DOMAINS));

    const unsubLocal = this.on('domains', (data) => {
      callback(data);
    });

    let unsubFirestore: (() => void) | null = null;
    try {
      unsubFirestore = onSnapshot(collection(db, 'domains'), (snap) => {
        if (!snap.empty) {
          const list: DomainItem[] = [];
          snap.forEach(d => list.push(d.data() as DomainItem));
          this.setLocal('domains', list);
          callback(list);
        }
      }, (err) => {
        console.warn('Firestore domains subscription fallback:', err.message);
      });
    } catch (e) {
      // fallback
    }

    return () => {
      unsubLocal();
      if (unsubFirestore) unsubFirestore();
    };
  }

  // PROJECTS
  public async getProjects(domainId?: string, userId?: string): Promise<ProjectTask[]> {
    if (domainId && userId) {
      const domain = this.getLocal<DomainItem[]>('domains', DEFAULT_DOMAINS).find(d => d.id === domainId);
      const domainName = domain?.name || domainId;
      return generateStudentTasks(domainId, domainName, userId);
    }
    let all = this.getLocal<ProjectTask[]>('projects', []);
    if (!all.length) {
      all = generateDefaultProjects();
      this.setLocal('projects', all);
    } else {
      // Guarantee any missing tasks (e.g. from newly added domains like ECE) are merged in
      const defaultProjs = generateDefaultProjects();
      let updated = false;
      defaultProjs.forEach((dp) => {
        if (!all.some(p => p.id === dp.id)) {
          all.push(dp);
          updated = true;
        }
      });
      if (updated) {
        this.setLocal('projects', all);
        this.emit('projects', all);
      }
    }
    return domainId ? all.filter(p => p.domainId === domainId && p.isActive) : all;
  }

  public async saveProject(project: ProjectTask): Promise<void> {
    const all = await this.getProjects();
    const idx = all.findIndex(p => p.id === project.id);
    if (idx >= 0) {
      all[idx] = project;
    } else {
      all.push(project);
    }
    this.setLocal('projects', all);
    this.emit('projects', all);

    try {
      await setDoc(doc(db, 'projects', project.id), project);
    } catch (err) {
      // fallback
    }
  }

  public async deleteProject(id: string): Promise<void> {
    const all = (await this.getProjects()).filter(p => p.id !== id);
    this.setLocal('projects', all);
    this.emit('projects', all);

    try {
      await deleteDoc(doc(db, 'projects', id));
    } catch (e) {
      // fallback
    }
  }

  public subscribeProjects(
    domainId: string | undefined,
    callback: (projects: ProjectTask[]) => void,
    userId?: string
  ): () => void {
    const getFiltered = () => {
      if (domainId && userId) {
        const domain = this.getLocal<DomainItem[]>('domains', DEFAULT_DOMAINS).find(d => d.id === domainId);
        const domainName = domain?.name || domainId;
        return generateStudentTasks(domainId, domainName, userId);
      }
      const all = this.getLocal<ProjectTask[]>('projects', generateDefaultProjects());
      return domainId ? all.filter(p => p.domainId === domainId && p.isActive) : all;
    };
    callback(getFiltered());

    const unsubLocal = this.on('projects', () => {
      callback(getFiltered());
    });

    let unsubFirestore: (() => void) | null = null;
    try {
      unsubFirestore = onSnapshot(collection(db, 'projects'), (snap) => {
        if (!snap.empty && (!domainId || !userId)) {
          const list: ProjectTask[] = [];
          snap.forEach(d => list.push(d.data() as ProjectTask));
          this.setLocal('projects', list);
          callback(domainId ? list.filter(p => p.domainId === domainId && p.isActive) : list);
        }
      }, (err) => {
        console.warn('Firestore projects subscription fallback:', err.message);
      });
    } catch (e) {
      // fallback
    }

    return () => {
      unsubLocal();
      if (unsubFirestore) unsubFirestore();
    };
  }

  // PACKAGE MANAGEMENT (Admin controllable, not hardcoded ₹99)
  public async getPackageConfig(): Promise<PackageConfig> {
    const local = this.getLocal<PackageConfig>('package', DEFAULT_PACKAGE);
    getDoc(doc(db, 'packages', DEFAULT_PACKAGE.id)).then((snap) => {
      if (snap.exists()) {
        const pkg = snap.data() as PackageConfig;
        this.setLocal('package', pkg);
        this.emit('package', pkg);
      }
    }).catch(() => {});
    return local;
  }

  public async updatePackageConfig(pkg: PackageConfig): Promise<void> {
    this.setLocal('package', pkg);
    this.emit('package', pkg);
    try {
      await setDoc(doc(db, 'packages', pkg.id), pkg);
    } catch (err) {
      // fallback
    }
  }

  public subscribePackageConfig(callback: (pkg: PackageConfig) => void): () => void {
    callback(this.getLocal<PackageConfig>('package', DEFAULT_PACKAGE));

    const unsubLocal = this.on('package', (data) => {
      callback(data);
    });

    let unsubFirestore: (() => void) | null = null;
    try {
      unsubFirestore = onSnapshot(doc(db, 'packages', DEFAULT_PACKAGE.id), (snap) => {
        if (snap.exists()) {
          const fresh = snap.data() as PackageConfig;
          this.setLocal('package', fresh);
          callback(fresh);
        }
      }, (err) => {
        console.warn('Firestore package subscription fallback:', err.message);
      });
    } catch (e) {
      // fallback
    }

    return () => {
      unsubLocal();
      if (unsubFirestore) unsubFirestore();
    };
  }

  // ==========================================
  // PACKAGE BENEFITS (Dynamic & Admin Controlled)
  // ==========================================
  public async getPackageBenefits(onlyActive = false): Promise<PackageBenefit[]> {
    let list = this.getLocal<PackageBenefit[]>('package_benefits', DEFAULT_PACKAGE_BENEFITS);
    list.sort((a, b) => a.order - b.order);

    getDocs(collection(db, 'packageBenefits')).then((snap) => {
      if (!snap.empty) {
        const fetched: PackageBenefit[] = [];
        snap.forEach(d => fetched.push(d.data() as PackageBenefit));
        fetched.sort((a, b) => a.order - b.order);
        this.setLocal('package_benefits', fetched);
        this.emit('package_benefits', fetched);
      }
    }).catch(() => {});

    return onlyActive ? list.filter(b => b.isActive) : list;
  }

  public subscribePackageBenefits(callback: (benefits: PackageBenefit[]) => void, onlyActive = false): () => void {
    const getFiltered = () => {
      let list = this.getLocal<PackageBenefit[]>('package_benefits', DEFAULT_PACKAGE_BENEFITS);
      list.sort((a, b) => a.order - b.order);
      return onlyActive ? list.filter(b => b.isActive) : list;
    };

    callback(getFiltered());

    const unsubLocal = this.on('package_benefits', () => {
      callback(getFiltered());
    });

    let unsubFirestore: (() => void) | null = null;
    try {
      unsubFirestore = onSnapshot(collection(db, 'packageBenefits'), (snap) => {
        if (!snap.empty) {
          const fetched: PackageBenefit[] = [];
          snap.forEach(d => fetched.push(d.data() as PackageBenefit));
          fetched.sort((a, b) => a.order - b.order);
          this.setLocal('package_benefits', fetched);
          callback(onlyActive ? fetched.filter(b => b.isActive) : fetched);
        }
      }, (err) => {
        console.warn('Firestore package benefits subscription fallback:', err.message);
      });
    } catch (e) {
      // fallback
    }

    return () => {
      unsubLocal();
      if (unsubFirestore) unsubFirestore();
    };
  }

  public async savePackageBenefit(benefit: PackageBenefit): Promise<void> {
    const all = await this.getPackageBenefits(false);
    const idx = all.findIndex(b => b.id === benefit.id);
    if (idx >= 0) {
      all[idx] = { ...benefit, updatedAt: new Date().toISOString() };
    } else {
      all.push({
        ...benefit,
        order: benefit.order || all.length + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    all.sort((a, b) => a.order - b.order);
    this.setLocal('package_benefits', all);
    this.emit('package_benefits', all);

    try {
      await setDoc(doc(db, 'packageBenefits', benefit.id), benefit);
    } catch (err) {
      // fallback
    }
  }

  public async deletePackageBenefit(id: string): Promise<void> {
    const all = (await this.getPackageBenefits(false)).filter(b => b.id !== id);
    // Normalize ordering
    all.forEach((b, i) => { b.order = i + 1; });
    this.setLocal('package_benefits', all);
    this.emit('package_benefits', all);

    try {
      await deleteDoc(doc(db, 'packageBenefits', id));
    } catch (err) {
      // fallback
    }
  }

  public async toggleBenefitStatus(id: string): Promise<void> {
    const all = await this.getPackageBenefits(false);
    const target = all.find(b => b.id === id);
    if (target) {
      target.isActive = !target.isActive;
      target.updatedAt = new Date().toISOString();
      this.setLocal('package_benefits', all);
      this.emit('package_benefits', all);

      try {
        await updateDoc(doc(db, 'packageBenefits', id), {
          isActive: target.isActive,
          updatedAt: target.updatedAt
        });
      } catch (err) {
        // fallback
      }
    }
  }

  public async reorderBenefits(reordered: PackageBenefit[]): Promise<void> {
    reordered.forEach((b, i) => {
      b.order = i + 1;
      b.updatedAt = new Date().toISOString();
    });
    this.setLocal('package_benefits', reordered);
    this.emit('package_benefits', reordered);

    try {
      for (const b of reordered) {
        await setDoc(doc(db, 'packageBenefits', b.id), b, { merge: true });
      }
    } catch (err) {
      // fallback
    }
  }

  // Helper to ensure student progress is never downgraded by race conditions or empty snapshots
  private mergeInternship(current: InternshipRecord | null, fresh: InternshipRecord): InternshipRecord {
    if (!current) return fresh;
    if (!fresh) return current;
    // Strict isolation: Never merge milestones or progress across different domains!
    if (current.domainId && fresh.domainId && !isSameDomain(current.domainId, fresh.domainId, current.domainName, fresh.domainName)) {
      return fresh;
    }
    const allCompleted = Array.from(new Set([...(current.completedTasks || []), ...(fresh.completedTasks || [])]));
    return {
      ...current,
      ...fresh,
      progress: Math.max(current.progress || 0, fresh.progress || 0),
      task1VerificationCompleted: Boolean(current.task1VerificationCompleted || fresh.task1VerificationCompleted),
      completedTasks: allCompleted,
      currentTask: Math.max(current.currentTask || 1, fresh.currentTask || 1)
    };
  }

  // INTERNSHIP LIFECYCLE
  public async getInternship(userId: string, domainId?: string): Promise<InternshipRecord | null> {
    if (!userId || typeof userId !== 'string' || !userId.trim()) return null;

    let current = domainId
      ? this.getLocal<InternshipRecord | null>(`internship_${userId}_${domainId}`, null)
      : this.getLocal<InternshipRecord | null>(`internship_${userId}`, null);

    // If domainId was requested but local specific record didn't exist, only check generic if domain matches
    if (!current && domainId) {
      const fallback = this.getLocal<InternshipRecord | null>(`internship_${userId}`, null);
      if (fallback && (fallback.domainId === domainId || isSameDomain(fallback.domainId, domainId, fallback.domainName, domainId))) {
        current = fallback;
      }
    }

    // 1. Check persistent server /api/internships store (Server strictly reconciles with approved submissions)
    try {
      const url = domainId
        ? `/api/internships?userId=${encodeURIComponent(userId)}&domainId=${encodeURIComponent(domainId)}`
        : `/api/internships?userId=${encodeURIComponent(userId)}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.internship) {
          // If domainId was requested, verify server returned an internship matching domainId
          if (!domainId || isSameDomain(json.internship.domainId, domainId, json.internship.domainName, domainId)) {
            current = json.internship as InternshipRecord;
            this.setLocal(`internship_${userId}`, current);
            if (current && current.domainId) {
              this.setLocal(`internship_${userId}_${current.domainId}`, current);
            }
            try {
              localStorage.setItem('virintern_cached_internship', JSON.stringify(current));
            } catch {}
            this.emit(`internship_${userId}`, current);
          }
        }
      }
    } catch {}

    // 2. Non-blocking Firestore check with safe merge
    try {
      const ref = safeDoc('internships', userId);
      if (ref) {
        getDoc(ref).then((snap) => {
          if (snap.exists()) {
            const fresh = snap.data() as InternshipRecord;
            if (!domainId || isSameDomain(fresh.domainId, domainId, fresh.domainName, domainId)) {
              if (current && (!current.completedTasks || current.completedTasks.length === 0)) {
                // If current has 0 completed tasks, do not resurrect old tasks from firestore snapshot without approved submissions
                return;
              }
              const merged = this.mergeInternship(current, fresh);
              this.setLocal(`internship_${userId}`, merged);
              if (merged.domainId) {
                this.setLocal(`internship_${userId}_${merged.domainId}`, merged);
              }
              this.emit(`internship_${userId}`, merged);
            }
          }
        }).catch(() => {});
      }
    } catch {}

    return current;
  }

  public async startInternship(user: UserProfile, domain: DomainItem): Promise<InternshipRecord> {
    const existingDomainInternship = this.getLocal<InternshipRecord | null>(`internship_${user.uid}_${domain.id}`, null);
    
    // Check if user has genuinely approved submissions for this domain
    const allSubs = await this.getSubmissions(user.uid);
    const userDomainApproved = allSubs.filter(s =>
      s.userId === user.uid &&
      isSameDomain(s.domainId, domain.id, s.domainName, domain.name) &&
      (s.status === 'approved' || (s.status === 'passed' && s.isManuallyVerified === true))
    );
    const completedTasks = Array.from(new Set(userDomainApproved.map(s => Number(s.taskNumber)).filter(n => n >= 1 && n <= 5)));
    completedTasks.sort((a, b) => a - b);
    const progress = completedTasks.length * 20;
    const task1Done = completedTasks.includes(1);
    const currentTask = completedTasks.length >= 5 ? 5 : (completedTasks.length > 0 ? Math.min(5, Math.max(...completedTasks) + 1) : 1);

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
    const record: InternshipRecord = {
      id: `${user.uid}_${domain.id}`,
      userId: user.uid,
      domainId: domain.id,
      domainName: domain.name,
      startDate: (existingDomainInternship?.progress ? existingDomainInternship.startDate : null) || startDate.toISOString(),
      endDate: (existingDomainInternship?.progress ? existingDomainInternship.endDate : null) || endDate.toISOString(),
      status: progress >= 100 ? 'completed' : 'active',
      progress,
      currentTask,
      completedTasks,
      task1VerificationCompleted: task1Done,
      createdAt: (existingDomainInternship?.progress ? existingDomainInternship.createdAt : null) || startDate.toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.setLocal(`internship_${user.uid}_${domain.id}`, record);
    this.setLocal(`internship_${user.uid}`, record);
    try {
      localStorage.setItem('virintern_cached_internship', JSON.stringify(record));
    } catch {}

    // Immediately post clean 0% record to server /api/internships
    fetch('/api/internships', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    }).catch(() => {});

    // Save to user profile as well
    const updatedUser: UserProfile = {
      ...user,
      selectedDomain: domain.name,
      internshipStatus: record.status === 'completed' ? 'completed' : 'active',
      internshipStartDate: record.startDate,
      internshipEndDate: record.endDate,
      progress: record.progress || 0,
      updatedAt: new Date().toISOString()
    };
    this.setLocal(`user_${user.uid}`, updatedUser);

    this.emit(`internship_${user.uid}`, record);
    this.emit(`user_${user.uid}`, updatedUser);

    // Non-blocking background sync for remote Firestore, notifications, and emails
    const intRef = safeDoc('internships', user.uid);
    const userRef = safeDoc('users', user.uid);
    Promise.all([
      intRef ? setDoc(intRef, cleanFirestoreData(record)).catch(() => {}) : Promise.resolve(),
      userRef ? setDoc(userRef, cleanFirestoreData(updatedUser), { merge: true }).catch(() => {}) : Promise.resolve(),
      this.addNotification({
        userId: user.uid,
        title: 'Internship Started! 🚀',
        message: `Welcome to your 1-month ${domain.name} virtual internship. Task 1: Foundation Project is now unlocked!`,
        type: 'internship_started'
      }).catch(() => {}),
      this.logEmail({
        to: user.email,
        subject: `Welcome to VirIntern: Your ${domain.name} Internship has Started`,
        preview: `Congratulations! Your 1-Month Virtual Internship in ${domain.name} is officially active. Review your Task 1 instructions on the dashboard.`,
        type: 'internship_started'
      }).catch(() => {})
    ]).catch(() => {});

    return record;
  }

  public subscribeInternship(userId: string, callback: (internship: InternshipRecord | null) => void): () => void {
    if (!userId || typeof userId !== 'string' || !userId.trim()) return () => {};

    const cached = this.getLocal<InternshipRecord | null>(`internship_${userId}`, null);
    if (cached) callback(cached);

    // Initial check from persistent server
    this.getInternship(userId).then((int) => {
      if (int) callback(int);
    }).catch(() => {});

    const unsubLocal = this.on(`internship_${userId}`, (data) => {
      callback(data);
    });

    const handleStorage = (e: StorageEvent) => {
      if (e.key === `virintern_data_internship_${userId}` || e.key === 'virintern_cached_internship') {
        const fresh = this.getLocal<InternshipRecord | null>(`internship_${userId}`, null);
        if (fresh) callback(fresh);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorage);
    }

    let unsubFirestore: (() => void) | null = null;
    try {
      const intRef = safeDoc('internships', userId);
      if (intRef) {
        unsubFirestore = onSnapshot(intRef, (snap) => {
          if (snap.exists()) {
            const fresh = snap.data() as InternshipRecord;
            const current = this.getLocal<InternshipRecord | null>(`internship_${userId}`, null);
            const merged = this.mergeInternship(current, fresh);
            this.setLocal(`internship_${userId}`, merged);
            if (merged.domainId) {
              this.setLocal(`internship_${userId}_${merged.domainId}`, merged);
            }
            callback(merged);
          } else {
            const stillLocal = this.getLocal<InternshipRecord | null>(`internship_${userId}`, null);
            if (stillLocal) callback(stillLocal);
          }
        }, (err) => {
          console.warn('Firestore internship subscription fallback:', err.message);
        });
      }
    } catch (e) {
      // offline/fallback
    }

    return () => {
      unsubLocal();
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleStorage);
      }
      if (unsubFirestore) unsubFirestore();
    };
  }

  private normalizeSubmission(s: any, fallbackId?: string): TaskSubmission {
    const id = String(s?.id || s?.submissionId || fallbackId || `sub_${Date.now()}`);
    const cleanScreenshot =
      s?.youtubeScreenshotUrl === '[STORED_IN_MEMORY_AND_SERVER]' ? '' : (s?.youtubeScreenshotUrl || '');
    return {
      ...s,
      id,
      submissionId: String(s?.submissionId || id),
      taskNumber: Number(s?.taskNumber || 1),
      status: s?.status || 'submitted',
      youtubeScreenshotUrl: cleanScreenshot,
      submittedAt: s?.submittedAt || s?.createdAt || new Date().toISOString()
    } as TaskSubmission;
  }

  private mergeSubmissionsList(...lists: TaskSubmission[][]): TaskSubmission[] {
    const byId = new Map<string, TaskSubmission>();
    const pickValidMedia = (u1?: string, u2?: string) => {
      const a = u1 && u1 !== '[STORED_IN_MEMORY_AND_SERVER]' ? u1 : '';
      const b = u2 && u2 !== '[STORED_IN_MEMORY_AND_SERVER]' ? u2 : '';
      return a || b;
    };
    const pickWinner = (a: TaskSubmission, b: TaskSubmission): TaskSubmission => {
      const aVerified = Boolean(a.isManuallyVerified || a.status === 'approved' || a.status === 'rejected' || a.status === 'revision_required');
      const bVerified = Boolean(b.isManuallyVerified || b.status === 'approved' || b.status === 'rejected' || b.status === 'revision_required');
      const aSubMs = new Date(a.submittedAt || 0).getTime();
      const bSubMs = new Date(b.submittedAt || 0).getTime();
      const aRevMs = new Date(a.reviewedAt || a.submittedAt || 0).getTime();
      const bRevMs = new Date(b.reviewedAt || b.submittedAt || 0).getTime();

      let winner = bRevMs > aRevMs ? b : a;
      if (aVerified && !bVerified) {
        winner = bSubMs > aRevMs + 1000 ? b : a;
      } else if (bVerified && !aVerified) {
        winner = aSubMs > bRevMs + 1000 ? a : b;
      }
      const other = winner === a ? b : a;
      return {
        ...other,
        ...winner,
        id: winner.id || other.id,
        submissionId: winner.submissionId || other.submissionId || winner.id,
        youtubeScreenshotUrl: pickValidMedia(winner.youtubeScreenshotUrl, other.youtubeScreenshotUrl),
        userName: (winner.userName && winner.userName !== 'Intern') ? winner.userName : (other.userName || winner.userName),
        userEmail: winner.userEmail || other.userEmail
      };
    };

    for (const list of lists) {
      if (!Array.isArray(list)) continue;
      for (const raw of list) {
        if (!raw || !raw.userId) continue;
        const item = this.normalizeSubmission(raw);
        const existing = byId.get(item.id);
        byId.set(item.id, existing ? pickWinner(existing, item) : item);
      }
    }

    // Also deduplicate logically by userId + domain + taskNumber
    const byLogical = new Map<string, TaskSubmission>();
    for (const item of byId.values()) {
      let matchedKey: string | null = null;
      for (const [k, prev] of byLogical.entries()) {
        if (
          prev.userId === item.userId &&
          Number(prev.taskNumber) === Number(item.taskNumber) &&
          isSameDomain(prev.domainId, item.domainId, prev.domainName, item.domainName)
        ) {
          matchedKey = k;
          break;
        }
      }
      if (matchedKey) {
        const prev = byLogical.get(matchedKey)!;
        byLogical.set(matchedKey, pickWinner(prev, item));
      } else {
        byLogical.set(item.id, item);
      }
    }

    return Array.from(byLogical.values()).sort(
      (a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime()
    );
  }

  private mergeUsersList(...lists: UserProfile[][]): UserProfile[] {
    const byUid = new Map<string, UserProfile>();
    for (const list of lists) {
      if (!Array.isArray(list)) continue;
      for (const raw of list) {
        if (!raw || !raw.uid) continue;
        const existing = byUid.get(raw.uid);
        if (!existing) {
          byUid.set(raw.uid, { ...raw });
        } else {
          const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
          const rawTime = new Date(raw.updatedAt || raw.createdAt || 0).getTime();
          const newer = rawTime >= existingTime ? raw : existing;
          const older = newer === raw ? existing : raw;
          byUid.set(raw.uid, {
            ...older,
            ...newer,
            name: (newer.name && newer.name !== 'Student' && newer.name !== 'Intern') ? newer.name : (older.name || newer.name),
            progress: Math.max(Number(newer.progress || 0), Number(older.progress || 0)),
            hasPaidPackage: Boolean(newer.hasPaidPackage || older.hasPaidPackage)
          });
        }
      }
    }
    return Array.from(byUid.values());
  }

  // SUBMISSIONS
  public async getSubmissions(userId?: string): Promise<TaskSubmission[]> {
    const localKey = userId ? `submissions_${userId}` : 'submissions';
    const cachedLocal = this.getLocal<TaskSubmission[]>(localKey, []);
    const recentLocal = cachedLocal.filter(s => {
      if (userId && s.userId !== userId) return false;
      const age = s.submittedAt ? (Date.now() - new Date(s.submittedAt).getTime()) : 999999;
      return age < 60000;
    });

    let firestoreFetchOk = false;
    const firestorePromise = (async (): Promise<TaskSubmission[]> => {
      try {
        const ref = collection(db, 'submissions');
        const q = userId ? query(ref, where('userId', '==', userId)) : ref;
        const snap = await withTimeout(getDocs(q), 8000);
        firestoreFetchOk = true;
        if (!userId && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('virintern_submissions_loaded'));
        }
        const list: TaskSubmission[] = [];
        snap.forEach(d => list.push(this.normalizeSubmission(d.data(), d.id)));
        return list;
      } catch (error: any) {
        console.error('Unable to load submissions from Firestore. Check admin access and Firestore rules:', error);
        if (!userId && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('virintern_submissions_load_error', {
            detail: { code: error?.code || 'unknown', message: error?.message || 'Unknown Firestore error' }
          }));
        }
        return [];
      }
    })();

    const firestoreSubs = await firestorePromise;
    // Firestore is the source of truth. Use local cache only as an offline fallback;
    // merge very recent optimistic submissions while a write is propagating.
    const merged = firestoreFetchOk
      ? this.mergeSubmissionsList(firestoreSubs, recentLocal)
      : this.mergeSubmissionsList(cachedLocal);

    if (firestoreFetchOk || merged.length > 0) {
      this.setLocal(localKey, merged);
      this.emit(localKey, merged);
    }
    return merged;
  }

  public async submitTask(
    submission: Omit<TaskSubmission, 'id' | 'status' | 'submittedAt'>,
    taskDetails?: Partial<ProjectTask>
  ): Promise<{ submission: TaskSubmission; evaluation?: TaskEvaluationRecord }> {
    const subId = submission.submissionId || `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const taskNum = Number(submission.taskNumber || 1);
    const newSub: TaskSubmission = {
      ...submission,
      id: subId,
      submissionId: subId,
      taskNumber: taskNum,
      status: 'submitted',
      isManuallyVerified: false,
      submittedAt: new Date().toISOString()
    };

    // Prepare task payload for strict evaluation
    const taskPayload = {
      taskId: taskDetails?.taskId || taskDetails?.id || submission.taskId || submission.projectId || `task-${taskNum}`,
      domain: taskDetails?.domain || submission.domainName || submission.domainId || 'Virtual Internship',
      domainId: taskDetails?.domainId || submission.domainId,
      taskNumber: taskNum,
      title: taskDetails?.title || submission.projectTitle || `Task ${taskNum}`,
      objective: taskDetails?.objective || '',
      description: taskDetails?.description || '',
      difficulty: taskDetails?.difficulty || submission.level || 'Intermediate',
      requirements: taskDetails?.requirements || taskDetails?.instructions || [],
      expectedOutput: taskDetails?.expectedOutput || '',
      allowedSubmissionTypes: taskDetails?.allowedSubmissionTypes || ['text', 'github', 'project_url', 'pdf', 'image', 'file'],
      evaluationRubric: taskDetails?.evaluationRubric || {
        functionality: 30,
        requirements: 25,
        quality: 20,
        documentation: 10,
        errorHandling: 10,
        originality: 5
      },
      passingScore: taskDetails?.passingScore || 70,
      maximumAttempts: taskDetails?.maximumAttempts || 3
    };

    // 1. Immediately persist user-scoped local submissions
    const userSubs = this.getLocal<TaskSubmission[]>(`submissions_${newSub.userId}`, []);
    const filteredUserSubs = userSubs.filter(s => !(s.userId === newSub.userId && isSameDomain(s.domainId, newSub.domainId, s.domainName, newSub.domainName) && Number(s.taskNumber) === taskNum));
    filteredUserSubs.unshift(newSub);
    this.setLocal(`submissions_${newSub.userId}`, filteredUserSubs);
    this.setLocal(`sub_${newSub.id}`, newSub);
    this.setLocal(`submission_${newSub.userId}_task_${taskNum}`, newSub);

    // Also update global local store
    const allSubs = this.getLocal<TaskSubmission[]>('submissions', []);
    const filteredAll = allSubs.filter(s => !(s.userId === newSub.userId && isSameDomain(s.domainId, newSub.domainId, s.domainName, newSub.domainName) && Number(s.taskNumber) === taskNum));
    filteredAll.unshift(newSub);
    this.setLocal('submissions', filteredAll);

    // 2. Sync internship & user record so admin sees student immediately
    try {
      const internship = (await this.getInternship(newSub.userId, newSub.domainId)) || (await this.getInternship(newSub.userId));
      if (internship) {
        internship.task1VerificationCompleted = internship.task1VerificationCompleted || false;
        internship.updatedAt = new Date().toISOString();
        this.setLocal(`internship_${newSub.userId}`, internship);
        if (newSub.domainId) {
          this.setLocal(`internship_${newSub.userId}_${newSub.domainId}`, internship);
        }
        try {
          localStorage.setItem('virintern_cached_internship', JSON.stringify(internship));
        } catch {}
        this.emit(`internship_${newSub.userId}`, internship);

        fetch('/api/internships', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(internship)
        }).catch(() => {});

        const intDocRef = safeDoc('internships', newSub.userId);
        if (intDocRef) {
          setDoc(intDocRef, cleanFirestoreData(internship), { merge: true }).catch(() => {});
        }
      }
    } catch {}

    // Emit local reactive events immediately
    this.emit(`submissions_${newSub.userId}`, filteredUserSubs);
    this.emit('submissions', filteredAll);
    this.emit('submission_created', newSub);
    this.emit('submission_updated', newSub);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('virintern_submission_updated', { detail: newSub }));
      window.dispatchEvent(new CustomEvent('virintern_submission_created', { detail: newSub }));
    }

    let evaluation = undefined as TaskEvaluationRecord | undefined;
    let savedOnServer = false;
    let savedInFirestore = false;
    let authoritativeSub: TaskSubmission = newSub;

    // 3. Post to Express backend (/api/evaluations/submit-and-evaluate)
    const serverTask = (async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const evalRes = await fetch('/api/evaluations/submit-and-evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task: taskPayload,
            submission: {
              ...newSub,
              taskId: taskPayload.taskId,
              taskNumber: taskNum,
              domainId: newSub.domainId,
              domainName: newSub.domainName
            }
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (evalRes.ok) {
          savedOnServer = true;
          const evalJson = await evalRes.json();
          if (evalJson.success && evalJson.evaluation) {
            evaluation = evalJson.evaluation;
          }
          if (evalJson.submission) {
            authoritativeSub = this.normalizeSubmission({ ...newSub, ...evalJson.submission }, newSub.id);
          }
        }
      } catch (evalErr) {
        console.warn('Backend submission call note:', evalErr);
      }

    })();

    // 4. Write to Firestore submissions collection reliably (with generous timeout)
    const firestoreTask = (async () => {
      try {
        const subRef = safeDoc('submissions', newSub.id);
        if (subRef) {
          await withTimeout(setDoc(subRef, cleanFirestoreData(newSub), { merge: true }), 8000);
          savedInFirestore = true;
        }
      } catch (fsErr) {
        console.warn('Firestore submission sync warning:', fsErr);
      }
    })();

    await Promise.allSettled([serverTask, firestoreTask]);

    if (!savedOnServer && !savedInFirestore) {
      throw new Error('Could not transmit your submission to the server or database. Please check your internet connection and try again.');
    }

    // Re-sync local caches with authoritative submission
    const updatedUserSubs = filteredUserSubs.map(s => s.id === authoritativeSub.id ? authoritativeSub : s);
    this.setLocal(`submissions_${authoritativeSub.userId}`, updatedUserSubs);
    this.setLocal(`sub_${authoritativeSub.id}`, authoritativeSub);
    this.setLocal(`submission_${authoritativeSub.userId}_task_${taskNum}`, authoritativeSub);

    const updatedAllSubs = filteredAll.map(s => s.id === authoritativeSub.id ? authoritativeSub : s);
    this.setLocal('submissions', updatedAllSubs);

    // If server returned enriched fields (e.g. projectTitle/taskId), mirror authoritativeSub into Firestore too
    if (savedOnServer && !savedInFirestore) {
      const subRef = safeDoc('submissions', authoritativeSub.id);
      if (subRef) {
        setDoc(subRef, cleanFirestoreData(authoritativeSub), { merge: true }).catch(() => {});
      }
    }

    // 5. Save evaluation if present
    if (evaluation) {
      const evals = this.getLocal<TaskEvaluationRecord[]>('evaluations', []);
      const evalFiltered = evals.filter(e => e.evaluationId !== evaluation!.evaluationId);
      evalFiltered.unshift(evaluation);
      this.setLocal('evaluations', evalFiltered);
      this.setLocal(`eval_${evaluation.evaluationId}`, evaluation);
      this.setLocal(`eval_sub_${authoritativeSub.id}`, evaluation);

      try {
        const evalRef = safeDoc('evaluations', evaluation.evaluationId);
        if (evalRef) {
          await withTimeout(setDoc(evalRef, cleanFirestoreData(evaluation), { merge: true }), 5000);
        }
      } catch {}
    }

    this.emit(`submissions_${authoritativeSub.userId}`, updatedUserSubs);
    this.emit('submissions', updatedAllSubs);
    this.emit('submission_created', authoritativeSub);
    this.emit('submission_updated', authoritativeSub);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('virintern_submission_created', { detail: authoritativeSub }));
      window.dispatchEvent(new CustomEvent('virintern_submission_updated', { detail: authoritativeSub }));
    }

    // Notice to student: Queued for manual admin verification
    await this.addNotification({
      userId: authoritativeSub.userId,
      title: `Task ${authoritativeSub.taskNumber} Submitted for Admin Review ⏳`,
      message: `Your project submission for Task ${authoritativeSub.taskNumber} has been received and is queued for manual verification by the VirIntern Admin team. Once approved, your score, feedback, and leaderboard points will be assigned.`,
      type: 'submission_received'
    });

    return { submission: authoritativeSub, evaluation };
  }

  // -------------------------------------------------------------
  // AI EVALUATION & LEADERBOARD METHODS
  // -------------------------------------------------------------

  public async getEvaluations(userId?: string): Promise<TaskEvaluationRecord[]> {
    const serverPromise = (async (): Promise<TaskEvaluationRecord[]> => {
      try {
        const url = userId ? `/api/evaluations/user/${encodeURIComponent(userId)}` : '/api/evaluations';
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.evaluations)) return data.evaluations;
        }
      } catch {}
      return [];
    })();

    const firestorePromise = (async (): Promise<TaskEvaluationRecord[]> => {
      try {
        const ref = collection(db, 'evaluations');
        const q = userId ? query(ref, where('userId', '==', userId)) : ref;
        const snap = await withTimeout(getDocs(q), 5000);
        const list: TaskEvaluationRecord[] = [];
        snap.forEach(d => list.push(d.data() as TaskEvaluationRecord));
        return list;
      } catch {
        return [];
      }
    })();

    const [serverRes, fsRes] = await Promise.allSettled([serverPromise, firestorePromise]);
    const serverList = serverRes.status === 'fulfilled' ? serverRes.value : [];
    const fsList = fsRes.status === 'fulfilled' ? fsRes.value : [];

    const map = new Map<string, TaskEvaluationRecord>();
    for (const item of [...fsList, ...serverList]) {
      const id = item?.evaluationId || item?.submissionId;
      if (!id) continue;
      const existing = map.get(id);
      if (!existing || new Date(item.evaluatedAt || 0).getTime() >= new Date(existing.evaluatedAt || 0).getTime()) {
        map.set(id, item);
      }
    }

    if (map.size > 0) {
      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.evaluatedAt || 0).getTime() - new Date(a.evaluatedAt || 0).getTime()
      );
      if (!userId) {
        this.setLocal('evaluations', merged);
      }
      return merged;
    }

    const local = this.getLocal<TaskEvaluationRecord[]>('evaluations', []);
    return userId ? local.filter(e => e.userId === userId) : local;
  }

  public subscribeEvaluations(callback: (evals: TaskEvaluationRecord[]) => void, userId?: string): () => void {
    let disposed = false;
    const cached = this.getLocal<TaskEvaluationRecord[]>('evaluations', []);
    if (cached.length > 0) {
      callback(userId ? cached.filter(e => e.userId === userId) : cached);
    }

    const refresh = () => {
      this.getEvaluations(userId).then(list => {
        if (!disposed) callback(list);
      }).catch(() => {});
    };
    refresh();

    let unsubFirestore: (() => void) | null = null;
    try {
      const ref = collection(db, 'evaluations');
      const q = userId ? query(ref, where('userId', '==', userId)) : ref;
      unsubFirestore = onSnapshot(q, () => {
        if (!disposed) refresh();
      }, () => {});
    } catch {}

    const unsubVer = this.on('submission_verified', refresh);
    const unsubUpd = this.on('submission_updated', refresh);
    return () => {
      disposed = true;
      unsubVer();
      unsubUpd();
      if (unsubFirestore) unsubFirestore();
    };
  }

  public async getEvaluation(evaluationId: string): Promise<TaskEvaluationRecord | null> {
    try {
      const res = await fetch(`/api/evaluations/${evaluationId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.evaluation) return data.evaluation;
      }
    } catch (e) {}

    try {
      const ref = safeDoc('evaluations', evaluationId);
      if (ref) {
        const snap = await withTimeout(getDoc(ref), 4000);
        if (snap.exists()) return snap.data() as TaskEvaluationRecord;
      }
    } catch {}

    return this.getLocal<TaskEvaluationRecord | null>(`eval_${evaluationId}`, null);
  }

  public async getEvaluationForSubmission(submissionId: string): Promise<TaskEvaluationRecord | null> {
    try {
      const res = await fetch(`/api/evaluations/submission/${submissionId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.evaluation) return data.evaluation;
      }
    } catch (e) {}

    try {
      const ref = safeDoc('evaluations', `eval_${submissionId}`);
      if (ref) {
        const snap = await withTimeout(getDoc(ref), 4000);
        if (snap.exists()) return snap.data() as TaskEvaluationRecord;
      }
    } catch {}

    const localSub = this.getLocal<TaskEvaluationRecord | null>(`eval_sub_${submissionId}`, null);
    if (localSub) return localSub;

    const all = this.getLocal<TaskEvaluationRecord[]>('evaluations', []);
    return all.find(e => e.submissionId === submissionId) || null;
  }

  private isExcludedFromStudentLeaderboard(user?: Partial<UserProfile> | null, email?: string, uid?: string): boolean {
    if (user?.role === 'admin' || user?.role === 'company') return true;
    const targetUid = uid || user?.uid;
    if (targetUid === 'fEzJGHdgeASWWwE86wkUqhJ2Vs92') return true;
    const cleanEmail = (email || user?.email || '').toLowerCase().trim();
    if (cleanEmail === 'preethamirl@gmail.com' || cleanEmail === 'preethu1845@gmail.com') return true;
    return false;
  }

  public async getLeaderboard(filter: string = 'overall', domainId?: string): Promise<LeaderboardRecord[]> {
    // Query server + Firestore leaderboard + merged real approved submissions so standings stay 100% live across containers
    const serverPromise = (async (): Promise<LeaderboardRecord[]> => {
      try {
        const params = new URLSearchParams({ filter });
        if (domainId) params.append('domainId', domainId);
        const res = await fetch(`/api/leaderboard?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.leaderboard)) return data.leaderboard;
        }
      } catch {}
      return [];
    })();

    const fsLeaderboardPromise = (async (): Promise<LeaderboardRecord[]> => {
      try {
        const snap = await withTimeout(getDocs(collection(db, 'leaderboard')), 5000);
        const list: LeaderboardRecord[] = [];
        snap.forEach(d => list.push(d.data() as LeaderboardRecord));
        return list;
      } catch {
        return [];
      }
    })();

    const [serverRes, fsLbRes, allUsers, allSubs, allDomains] = await Promise.all([
      serverPromise,
      fsLeaderboardPromise,
      this.getAllUsers(),
      this.getSubmissions(),
      this.getDomains()
    ]);

    const filteredStudents = allUsers.filter(u => !this.isExcludedFromStudentLeaderboard(u));

    const userMap = new Map<string, {
      userId: string;
      userName: string;
      userEmail?: string;
      userPhoto?: string;
      domainId?: string;
      domainName?: string;
      passedSubs: TaskSubmission[];
    }>();

    const nowMs = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const monthMs = 30 * 24 * 60 * 60 * 1000;

    for (const sub of allSubs) {
      if (sub.status !== 'approved') continue;
      const u = filteredStudents.find(x => x.uid === sub.userId);
      if (this.isExcludedFromStudentLeaderboard(u, sub.userEmail, sub.userId)) continue;

      const subTime = new Date(sub.reviewedAt || sub.submittedAt || 0).getTime();
      if (filter === 'weekly' && nowMs - subTime > weekMs) continue;
      if (filter === 'monthly' && nowMs - subTime > monthMs) continue;

      if (!userMap.has(sub.userId)) {
        const dName = sub.domainName || allDomains.find(d => d.id === sub.domainId || d.slug === sub.domainId)?.name || 'Virtual Internship';
        userMap.set(sub.userId, {
          userId: sub.userId,
          userName: u?.name || sub.userName || 'Intern',
          userEmail: u?.email || sub.userEmail,
          userPhoto: u?.photoURL,
          domainId: sub.domainId || u?.selectedDomain,
          domainName: dName,
          passedSubs: []
        });
      }
      const uData = userMap.get(sub.userId)!;
      if (!uData.passedSubs.some(s => Number(s.taskNumber) === Number(sub.taskNumber) && isSameDomain(s.domainId, sub.domainId, s.domainName, sub.domainName))) {
        uData.passedSubs.push(sub);
      }
    }

    const computedMap = new Map<string, LeaderboardRecord>();
    for (const u of userMap.values()) {
      let totalPoints = 0;
      let totalScore = 0;
      let beginnerTasks = 0;
      let intermediateTasks = 0;
      let advancedTasks = 0;

      for (const sub of u.passedSubs) {
        const score = sub.rubricScore ?? 85;
        totalScore += score;
        const diff = (sub.level || 'Intermediate').toLowerCase();
        let maxPts = 150;
        if (diff === 'beginner' || diff === 'easy') { maxPts = 100; beginnerTasks++; }
        else if (diff === 'advanced' || diff === 'hard') { maxPts = 200; advancedTasks++; }
        else { intermediateTasks++; }
        totalPoints += Math.round((score / 100) * maxPts);
      }

      const tasksCompleted = u.passedSubs.length;
      const averageScore = tasksCompleted > 0 ? Math.round(totalScore / tasksCompleted) : 0;

      const badges: string[] = [];
      if (tasksCompleted >= 5) badges.push('Capstone Graduate 🎓');
      if (advancedTasks >= 1) badges.push('Advanced Pioneer ⚡');
      if (averageScore >= 95) badges.push('Mastery Score 🌟');
      else if (averageScore >= 85) badges.push('Top Scorer 🎯');
      if (totalPoints >= 500) badges.push('Grandmaster 🏆');
      else if (totalPoints >= 300) badges.push('Senior Fellow ⚡');
      else if (totalPoints >= 100) badges.push('Rising Intern 🌱');

      computedMap.set(u.userId, {
        userId: u.userId,
        userName: u.userName,
        userEmail: u.userEmail,
        userPhoto: u.userPhoto,
        domainId: u.domainId,
        domainName: u.domainName,
        totalPoints,
        tasksCompleted,
        averageScore,
        beginnerCompleted: beginnerTasks,
        intermediateCompleted: intermediateTasks,
        advancedCompleted: advancedTasks,
        badges,
        rank: 0,
        updatedAt: new Date().toISOString()
      });
    }

    // Merge server & Firestore leaderboard records so any verified student from either source appears cleanly
    const mergedMap = new Map<string, LeaderboardRecord>(computedMap);
    for (const r of [...fsLbRes, ...serverRes]) {
      if (!r || !r.userId) continue;
      if (this.isExcludedFromStudentLeaderboard(null, r.userEmail, r.userId)) continue;
      const existing = mergedMap.get(r.userId);
      if (!existing || (filter === 'overall' && (r.totalPoints || 0) > (existing.totalPoints || 0))) {
        mergedMap.set(r.userId, r);
      }
    }

    let records = Array.from(mergedMap.values());
    if (domainId && domainId !== 'all') {
      records = records.filter(r => isSameDomain(r.domainId, domainId, r.domainName, domainId));
    }

    records.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
      if ((b.advancedCompleted || 0) !== (a.advancedCompleted || 0)) return (b.advancedCompleted || 0) - (a.advancedCompleted || 0);
      return (b.tasksCompleted || 0) - (a.tasksCompleted || 0);
    });

    records.forEach((r, idx) => {
      r.rank = idx + 1;
    });

    if (filter === 'overall' && (!domainId || domainId === 'all')) {
      this.setLocal('leaderboard', records);
    }
    return records;
  }

  public subscribeLeaderboard(
    filter: string = 'overall',
    domainId: string | undefined,
    callback: (records: LeaderboardRecord[]) => void
  ): () => void {
    this.ensureLiveEvents();

    let disposed = false;
    let refreshTimer: any = null;
    const refresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        this.getLeaderboard(filter, domainId).then((list) => {
          if (!disposed) callback(list);
        }).catch(() => {});
      }, 100);
    };

    if (filter === 'overall' && (!domainId || domainId === 'all')) {
      const cached = this.getLocal<LeaderboardRecord[]>('leaderboard', []);
      if (cached.length > 0) callback(cached);
    }

    refresh();

    let unsubFsLb: (() => void) | null = null;
    try {
      unsubFsLb = onSnapshot(collection(db, 'leaderboard'), () => {
        if (!disposed) refresh();
      }, () => {});
    } catch {}

    const unsubLb = this.on('leaderboard_updated', refresh);
    const unsubVer = this.on('submission_verified', refresh);
    const unsubSub = this.on('submission_updated', refresh);
    const unsubUser = this.on('user_updated', refresh);

    const handleWindowEvent = () => refresh();
    if (typeof window !== 'undefined') {
      window.addEventListener('virintern_leaderboard_updated', handleWindowEvent);
      window.addEventListener('virintern_submission_updated', handleWindowEvent);
    }

    const pollInterval = setInterval(refresh, 4000);

    return () => {
      disposed = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      clearInterval(pollInterval);
      if (unsubFsLb) unsubFsLb();
      unsubLb();
      unsubVer();
      unsubSub();
      unsubUser();
      if (typeof window !== 'undefined') {
        window.removeEventListener('virintern_leaderboard_updated', handleWindowEvent);
        window.removeEventListener('virintern_submission_updated', handleWindowEvent);
      }
    };
  }

  public async getUserPerformance(userId: string): Promise<any> {
    try {
      const res = await fetch(`/api/performance/${userId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.performance && data.performance.tasksCompleted > 0) return data.performance;
      }
    } catch (e) {}

    const evals = await this.getEvaluations(userId);
    const passed = evals.filter(e => e.status === 'passed');
    return {
      userId,
      totalPoints: passed.reduce((acc, curr) => acc + (curr.earnedPoints || 0), 0),
      currentRank: 1,
      tasksCompleted: passed.length,
      averageScore: passed.length > 0 ? Math.round(passed.reduce((acc, curr) => acc + curr.totalScore, 0) / passed.length) : 0,
      beginnerTasks: passed.filter(e => e.difficulty === 'Beginner').length,
      intermediateTasks: passed.filter(e => e.difficulty === 'Intermediate').length,
      advancedTasks: passed.filter(e => e.difficulty === 'Advanced').length,
      badges: passed.length > 0 ? ['Rising Intern 🌱'] : [],
      recentEvaluations: evals.slice(0, 5),
      progressOverTime: evals.map(e => ({
        taskId: e.taskId,
        score: e.totalScore,
        points: e.earnedPoints || 0,
        date: e.evaluatedAt,
        status: e.status
      }))
    };
  }

  public async overrideEvaluation(
    adminId: string,
    evaluationId: string,
    submissionId: string,
    newScore: number,
    reason: string,
    newStatus?: 'passed' | 'revision_required'
  ): Promise<any> {
    try {
      const res = await fetch('/api/admin/override-evaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId,
          evaluationId,
          submissionId,
          newScore,
          reason,
          newStatus
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.evaluation) {
          const evalRef = safeDoc('evaluations', data.evaluation.evaluationId);
          if (evalRef) setDoc(evalRef, cleanFirestoreData(data.evaluation), { merge: true }).catch(() => {});
        }
        if (data.auditLog) {
          const logRef = safeDoc('auditLogs', data.auditLog.id);
          if (logRef) setDoc(logRef, cleanFirestoreData(data.auditLog), { merge: true }).catch(() => {});
        }
        if (Array.isArray(data.leaderboard)) {
          this.setLocal('leaderboard', data.leaderboard);
          for (const entry of data.leaderboard) {
            const lbRef = safeDoc('leaderboard', entry.userId);
            if (lbRef) {
              const { userEmail: _omitEmail, ...sanitizedLb } = entry as any;
              setDoc(lbRef, cleanFirestoreData(sanitizedLb), { merge: true }).catch(() => {});
            }
          }
        }
        this.emit('leaderboard_updated', data.leaderboard || []);
        this.emit('submission_updated', data.evaluation);
        this.emit('submission_verified', data);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('virintern_leaderboard_updated', { detail: data.leaderboard }));
          window.dispatchEvent(new CustomEvent('virintern_submission_updated', { detail: data.evaluation }));
        }
        return data;
      }
    } catch (e) {}
    return { success: false };
  }

  public async flagSubmission(adminId: string, submissionId: string, reason: string): Promise<any> {
    try {
      const res = await fetch('/api/admin/flag-submission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId, submissionId, reason })
      });
      const subRef = safeDoc('submissions', submissionId);
      if (subRef) {
        setDoc(subRef, { isSuspicious: true, suspiciousReason: reason }, { merge: true }).catch(() => {});
      }
      if (res.ok) {
        const data = await res.json();
        if (data.auditLog) {
          const logRef = safeDoc('auditLogs', data.auditLog.id);
          if (logRef) setDoc(logRef, cleanFirestoreData(data.auditLog), { merge: true }).catch(() => {});
        }
        return data;
      }
    } catch (e) {}
    return { success: false };
  }

  public async getAuditLogs(): Promise<AuditLogRecord[]> {
    const serverPromise = (async (): Promise<AuditLogRecord[]> => {
      try {
        const res = await fetch('/api/admin/audit-logs');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.logs)) return data.logs;
        }
      } catch {}
      return [];
    })();

    const firestorePromise = (async (): Promise<AuditLogRecord[]> => {
      try {
        const snap = await withTimeout(getDocs(collection(db, 'auditLogs')), 5000);
        const list: AuditLogRecord[] = [];
        snap.forEach(d => list.push({ ...(d.data() as AuditLogRecord), id: (d.data() as any).id || d.id }));
        return list;
      } catch {
        return [];
      }
    })();

    const [serverRes, fsRes] = await Promise.allSettled([serverPromise, firestorePromise]);
    const serverLogs = serverRes.status === 'fulfilled' ? serverRes.value : [];
    const fsLogs = fsRes.status === 'fulfilled' ? fsRes.value : [];

    const map = new Map<string, AuditLogRecord>();
    for (const item of [...fsLogs, ...serverLogs]) {
      if (!item || !item.id) continue;
      map.set(item.id, item);
    }

    if (map.size > 0) {
      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
      );
      this.setLocal('audit_logs', merged);
      return merged;
    }
    return this.getLocal<AuditLogRecord[]>('audit_logs', []);
  }

  public subscribeAuditLogs(callback: (logs: AuditLogRecord[]) => void): () => void {
    let disposed = false;
    const cached = this.getLocal<AuditLogRecord[]>('audit_logs', []);
    if (cached.length > 0) callback(cached);

    const refresh = () => {
      this.getAuditLogs().then(logs => {
        if (!disposed) callback(logs);
      }).catch(() => {});
    };
    refresh();

    let unsubFirestore: (() => void) | null = null;
    try {
      unsubFirestore = onSnapshot(collection(db, 'auditLogs'), () => {
        if (!disposed) refresh();
      }, () => {});
    } catch {}

    const unsubEvent = this.on('audit_logs', (logs) => {
      if (!disposed && Array.isArray(logs)) callback(logs);
    });

    return () => {
      disposed = true;
      unsubEvent();
      if (unsubFirestore) unsubFirestore();
    };
  }

  public subscribeSubmissions(userId: string | undefined, callback: (subs: TaskSubmission[]) => void): () => void {
    this.ensureLiveEvents();

    let disposed = false;
    let lastFirestoreSubs: TaskSubmission[] = [];

    const getFiltered = () => {
      if (userId) {
        return this.getLocal<TaskSubmission[]>(`submissions_${userId}`, []);
      }
      return this.getLocal<TaskSubmission[]>('submissions', []);
    };
    callback(getFiltered());

    const syncAll = () => {
      this.getSubmissions(userId).then(subs => {
        if (!disposed && subs) {
          callback(subs);
        }
      }).catch(() => {});
    };

    syncAll();

    // Real-time Firestore listener so student submissions appear instantly in Admin Portal across any tab/instance
    let unsubFirestore: (() => void) | null = null;
    try {
      const subCollection = collection(db, 'submissions');
      const q = userId ? query(subCollection, where('userId', '==', userId)) : subCollection;
      unsubFirestore = onSnapshot(q, (snap) => {
        if (disposed) return;
        const fsSubs: TaskSubmission[] = [];
        snap.forEach(d => fsSubs.push(this.normalizeSubmission(d.data(), d.id)));
        if (!userId && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('virintern_submissions_loaded'));
        }
        lastFirestoreSubs = fsSubs;
        const localSubs = getFiltered();
        const merged = this.mergeSubmissionsList(localSubs, fsSubs);
        const channelKey = userId ? `submissions_${userId}` : 'submissions';
        this.setLocal(channelKey, merged);
        callback(merged);

      }, (err) => {
        console.error('Firestore submissions listener failed:', err?.code || err?.message || err);
        if (!userId && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('virintern_submissions_load_error', {
            detail: { code: err?.code || 'unknown', message: err?.message || 'Unknown Firestore listener error' }
          }));
        }
      });
    } catch {}

    const channel = userId ? `submissions_${userId}` : 'submissions';
    const unsubLocal = this.on(channel, (data) => {
      if (!disposed && Array.isArray(data)) {
        const merged = lastFirestoreSubs.length > 0 ? this.mergeSubmissionsList(data, lastFirestoreSubs) : data;
        callback(merged);
      }
    });

    const unsubCreated = this.on('submission_created', syncAll);
    const unsubUpdated = this.on('submission_updated', syncAll);
    const unsubVerified = this.on('submission_verified', syncAll);

    const handleSubUpdated = () => {
      this.getSubmissions(userId).then(subs => {
        if (!disposed && subs) callback(subs);
      }).catch(() => {
        if (!disposed) callback(getFiltered());
      });
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'virintern_data_submissions' || e.key === `virintern_data_submissions_${userId}` || e.key === null) {
        handleSubUpdated();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('virintern_submission_updated', handleSubUpdated);
      window.addEventListener('virintern_submission_created', handleSubUpdated);
      window.addEventListener('storage', handleStorageEvent);
    }

    // Active 3-second background polling fallback to guarantee 100% cross-session sync
    const pollInterval = setInterval(syncAll, 3000);

    return () => {
      disposed = true;
      clearInterval(pollInterval);
      if (unsubFirestore) unsubFirestore();
      unsubLocal();
      unsubCreated();
      unsubUpdated();
      unsubVerified();
      if (typeof window !== 'undefined') {
        window.removeEventListener('virintern_submission_updated', handleSubUpdated);
        window.removeEventListener('virintern_submission_created', handleSubUpdated);
        window.removeEventListener('storage', handleStorageEvent);
      }
    };
  }

  // SYSTEM SETTINGS
  public async getSettings(): Promise<SystemSettings> {
    const local = this.getLocal<SystemSettings>('system_settings', DEFAULT_SETTINGS);
    try {
      const snap = await getDoc(doc(db, 'settings', 'global'));
      if (snap.exists()) {
        const data = snap.data() as SystemSettings;
        this.setLocal('system_settings', data);
        return data;
      }
    } catch {}
    return local;
  }

  public async saveSettings(settings: SystemSettings): Promise<void> {
    this.setLocal('system_settings', settings);
    this.emit('system_settings', settings);
    try {
      await setDoc(doc(db, 'settings', 'global'), cleanFirestoreData(settings));
    } catch {}
  }

  public subscribeSettings(callback: (settings: SystemSettings) => void): () => void {
    const unsubEvent = this.on('system_settings', callback);
    this.getSettings().then(callback);
    let unsubFirestore: (() => void) | undefined;
    try {
      unsubFirestore = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
        if (snap.exists()) {
          const remote = snap.data() as SystemSettings;
          this.setLocal('system_settings', remote);
          callback(remote);
        }
      }, () => {});
    } catch {}
    return () => {
      unsubEvent();
      if (unsubFirestore) unsubFirestore();
    };
  }

  // REVIEW SUBMISSION (Admin operation)
  public async reviewSubmission(
    submissionId: string,
    decision: 'approved' | 'revision_required' | 'rejected',
    scoreOrFeedback?: number | string,
    feedbackOrReviewer?: string,
    rubricBreakdown?: Record<string, number>,
    reviewedByInput?: string
  ): Promise<void> {
    const all = await this.getSubmissions();
    let target: TaskSubmission | undefined = all.find(
      s => s.id === submissionId || s.submissionId === submissionId || (s.id && submissionId && (s.id.includes(submissionId) || submissionId.includes(s.id)))
    );
    if (!target) {
      const localSubs = this.getLocal<TaskSubmission[]>('submissions', []);
      target = localSubs.find(
        s => s.id === submissionId || s.submissionId === submissionId || (s.id && submissionId && (s.id.includes(submissionId) || submissionId.includes(s.id)))
      );
    }
    if (!target) {
      const cachedSub = this.getLocal<TaskSubmission | null>(`sub_${submissionId}`, null);
      if (cachedSub) target = cachedSub;
    }
    if (!target) {
      try {
        const fsRef = safeDoc('submissions', submissionId);
        if (fsRef) {
          const snap = await withTimeout(getDoc(fsRef), 5000);
          if (snap.exists()) {
            target = this.normalizeSubmission(snap.data(), snap.id);
          }
        }
      } catch {}
    }
    if (!target) {
      throw new Error('Could not find the student submission record to verify. Please click Sync Live and try again.');
    }

    target.id = target.id || target.submissionId || submissionId;
    target.submissionId = target.submissionId || target.id;
    target.taskNumber = Number(target.taskNumber || 1);

    let score = decision === 'approved' ? 90 : decision === 'revision_required' ? 60 : 35;
    let feedback = '';
    let reviewedBy = 'VirIntern Mentor';

    if (typeof scoreOrFeedback === 'number') {
      score = scoreOrFeedback;
      feedback = feedbackOrReviewer || '';
      reviewedBy = reviewedByInput || 'VirIntern Mentor';
    } else if (typeof scoreOrFeedback === 'string') {
      feedback = scoreOrFeedback;
      reviewedBy = feedbackOrReviewer || 'VirIntern Mentor';
    }

    const nowIso = new Date().toISOString();
    target.status = decision;
    target.rubricScore = score;
    target.adminFeedback = feedback;
    target.reviewedAt = nowIso;
    target.reviewedBy = reviewedBy;
    target.isManuallyVerified = true;

    const diff = (target.level || 'Intermediate').toLowerCase();
    let maxPoints = 150;
    if (diff === 'beginner' || diff === 'easy') maxPoints = 100;
    else if (diff === 'advanced' || diff === 'hard') maxPoints = 200;
    const earnedPoints = decision === 'approved' ? Math.round((Math.max(0, Math.min(100, score)) / 100) * maxPoints) : 0;

    const evalId = target.evaluationId || `eval_${target.id}`;
    target.evaluationId = evalId;

    const evalRecord: TaskEvaluationRecord = {
      evaluationId: evalId,
      submissionId: target.id,
      userId: target.userId,
      userName: target.userName,
      userEmail: target.userEmail,
      taskId: target.taskId || target.projectId || `task-${target.taskNumber}`,
      taskNumber: target.taskNumber,
      domainId: target.domainId,
      domainName: target.domainName,
      difficulty: target.level || 'Intermediate',
      totalScore: score,
      criteriaScores: rubricBreakdown || {
        functionality: Math.round(score * 0.35),
        requirements: Math.round(score * 0.25),
        quality: Math.round(score * 0.20),
        documentation: Math.round(score * 0.10),
        errorHandling: Math.round(score * 0.05),
        originality: Math.round(score * 0.05)
      },
      requirementResults: [
        {
          requirement: 'Manual Admin Verification',
          status: decision === 'approved' ? 'passed' : 'failed',
          feedback: feedback || (decision === 'approved' ? 'All deliverables manually verified and accepted by administrator' : 'Revision required')
        }
      ],
      strengths: decision === 'approved' ? [feedback || 'Verified and approved by admin mentor'] : [],
      weaknesses: decision !== 'approved' ? [feedback || 'Milestone revision required'] : [],
      detectedIssues: [],
      improvementSuggestions: [feedback || 'Continue following internship milestones'],
      confidence: 1.0,
      status: decision === 'approved' ? 'passed' : 'revision_required',
      evaluatedAt: nowIso,
      evaluatorType: 'ADMIN_OVERRIDE',
      earnedPoints
    };

    const evals = this.getLocal<TaskEvaluationRecord[]>('evaluations', []);
    const filteredEvals = evals.filter(e => e.evaluationId !== evalId);
    filteredEvals.unshift(evalRecord);
    this.setLocal('evaluations', filteredEvals);
    this.setLocal(`eval_${evalId}`, evalRecord);
    this.setLocal(`eval_sub_${target.id}`, evalRecord);

    const activeAdminUid = auth.currentUser?.uid || ADMIN_UID;

    // 2. Update local submissions stores immediately
    const idx = all.findIndex(s => s.id === target!.id || s.submissionId === target!.id);
    if (idx >= 0) {
      all[idx] = { ...target };
    } else {
      all.unshift({ ...target });
    }
    this.setLocal('submissions', all);
    this.setLocal(`sub_${target.id}`, target);
    this.setLocal(`submission_${target.userId}_task_${target.taskNumber}`, target);
    this.setLocal(
      `submissions_${target.userId}`,
      all.filter(s => s.userId === target!.userId)
    );
    this.emit('submissions', all);
    if (target.userId) {
      this.emit(`submissions_${target.userId}`, all.filter(s => s.userId === target!.userId));
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('virintern_submission_updated', { detail: target }));
    }

    // 3. Update Internship & User progress consistently across all approved milestones for that domain
    let internship = (await this.getInternship(target.userId, target.domainId)) || (await this.getInternship(target.userId));
    if (!internship && target.userId) {
      internship = {
        id: `${target.userId}_${target.domainId || 'tech'}`,
        userId: target.userId,
        domainId: target.domainId || 'tech',
        domainName: target.domainName || 'Virtual Internship',
        startDate: nowIso,
        endDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        status: 'active',
        progress: 0,
        currentTask: 1,
        completedTasks: [],
        createdAt: nowIso,
        updatedAt: nowIso
      };
    }

    let userProfile: UserProfile | null = null;
    if (internship) {
      const domainApprovedNums = all
        .filter(s =>
          s.userId === target!.userId &&
          isSameDomain(s.domainId, internship!.domainId, s.domainName, internship!.domainName) &&
          s.status === 'approved'
        )
        .map(s => Number(s.taskNumber))
        .filter(n => n >= 1 && n <= 5);
      const completedTasks = Array.from(new Set(domainApprovedNums)).sort((a, b) => a - b);
      const newProgress = completedTasks.length * 20;
      internship.completedTasks = completedTasks;
      internship.task1VerificationCompleted = completedTasks.includes(1);
      internship.progress = newProgress;
      internship.currentTask = completedTasks.length >= 5 ? 5 : (completedTasks.length > 0 ? Math.min(5, Math.max(...completedTasks) + 1) : 1);
      internship.status = newProgress >= 100 ? 'completed' : 'active';
      internship.updatedAt = nowIso;

      if (target.domainId) {
        this.setLocal(`internship_${target.userId}_${target.domainId}`, internship);
      }
      this.setLocal(`internship_${target.userId}`, internship);
      this.emit(`internship_${target.userId}`, internship);

      userProfile = (await this.getUserProfile(target.userId)) || this.getLocal<UserProfile | null>(`user_${target.userId}`, null);
      if (!userProfile && target.userId) {
        userProfile = {
          uid: target.userId,
          name: target.userName || (target.userEmail ? target.userEmail.split('@')[0] : 'Intern'),
          email: target.userEmail || '',
          role: 'student',
          selectedDomain: target.domainName || target.domainId,
          referralCode: `VIR${Math.floor(100 + Math.random() * 900)}`,
          internshipStatus: internship.status === 'completed' ? 'completed' : 'active',
          progress: newProgress,
          agreementAccepted: true,
          createdAt: nowIso,
          updatedAt: nowIso
        };
      }
      if (userProfile) {
        userProfile.progress = newProgress;
        userProfile.internshipStatus = newProgress >= 100 ? 'completed' : 'active';
        userProfile.updatedAt = nowIso;
        await this.saveUser(userProfile);
      }

      fetch('/api/internships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(internship)
      }).catch(() => {});
    }

    // 4. Persist full updated records into Firestore (using setDoc(..., { merge: true }) so it NEVER throws NOT_FOUND)
    let savedInFirestore = false;
    try {
      const subRef = safeDoc('submissions', target.id);
      const evalRef = safeDoc('evaluations', evalId);
      const intRef = safeDoc('internships', target.userId);
      const intDomRef = target.domainId ? safeDoc('internships', `${target.userId}_${target.domainId}`) : null;
      const auditDoc: AuditLogRecord = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        adminId: activeAdminUid,
        action: 'ADMIN_MANUAL_VERIFICATION',
        targetType: 'SUBMISSION',
        targetId: target.id,
        newScore: score,
        reason: feedback || `Admin manually marked as ${decision} with score ${score}/100`,
        timestamp: nowIso,
        metadata: {
          userId: target.userId,
          userName: target.userName,
          taskNumber: target.taskNumber,
          status: decision,
          earnedPoints
        }
      };
      const auditRef = safeDoc('auditLogs', auditDoc.id);

      // Build student's updated leaderboard entry for Firestore leaderboard/{userId}
      const userApprovedSubs = all.filter(
        s => s.userId === target!.userId && s.status === 'approved'
      );
      let totalPts = 0;
      let totalScoreSum = 0;
      let bDone = 0;
      let iDone = 0;
      let aDone = 0;
      for (const s of userApprovedSubs) {
        const sScore = Number(s.rubricScore ?? 85);
        totalScoreSum += sScore;
        const d = (s.level || 'Intermediate').toLowerCase();
        let mp = 150;
        if (d === 'beginner' || d === 'easy') { mp = 100; bDone++; }
        else if (d === 'advanced' || d === 'hard') { mp = 200; aDone++; }
        else { iDone++; }
        totalPts += Math.round((sScore / 100) * mp);
      }
      const doneCount = userApprovedSubs.length;
      const avgScore = doneCount > 0 ? Math.round(totalScoreSum / doneCount) : 0;
      const badges: string[] = [];
      if (doneCount >= 5) badges.push('Capstone Graduate 🎓');
      if (aDone >= 1) badges.push('Advanced Pioneer ⚡');
      if (avgScore >= 95) badges.push('Mastery Score 🌟');
      else if (avgScore >= 85) badges.push('Top Scorer 🎯');
      if (totalPts >= 500) badges.push('Grandmaster 🏆');
      else if (totalPts >= 300) badges.push('Senior Fellow ⚡');
      else if (totalPts >= 100) badges.push('Rising Intern 🌱');

      const lbRecord: LeaderboardRecord = {
        userId: target.userId,
        userName: userProfile?.name || target.userName || 'Intern',
        userPhoto: userProfile?.photoURL,
        domainId: target.domainId || userProfile?.selectedDomain,
        domainName: target.domainName,
        totalPoints: totalPts,
        tasksCompleted: doneCount,
        averageScore: avgScore,
        beginnerCompleted: bDone,
        intermediateCompleted: iDone,
        advancedCompleted: aDone,
        badges,
        rank: 0,
        updatedAt: nowIso
      };
      const lbRef = !this.isExcludedFromStudentLeaderboard(userProfile, target.userEmail, target.userId)
        ? safeDoc('leaderboard', target.userId)
        : null;

      const writes: Promise<any>[] = [];
      if (subRef) writes.push(setDoc(subRef, cleanFirestoreData(target), { merge: true }));
      if (evalRef) writes.push(setDoc(evalRef, cleanFirestoreData(evalRecord), { merge: true }));
      if (internship && intRef) writes.push(setDoc(intRef, cleanFirestoreData(internship), { merge: true }));
      if (internship && intDomRef) writes.push(setDoc(intDomRef, cleanFirestoreData(internship), { merge: true }));
      if (auditRef) writes.push(setDoc(auditRef, cleanFirestoreData(auditDoc), { merge: true }));
      if (lbRef) {
        if (doneCount > 0) {
          writes.push(setDoc(lbRef, cleanFirestoreData(lbRecord), { merge: true }));
        } else {
          writes.push(deleteDoc(lbRef).catch(() => {}));
        }
      }

      await withTimeout(Promise.all(writes), 8000);
      savedInFirestore = true;
    } catch (fsErr) {
      console.warn('Firestore verify sync note:', fsErr);
    }

    if (!savedInFirestore) {
      throw new Error('Verification could not be saved to server or Firestore. Make sure you are signed in as an authorized admin.');
    }

    // 5. Notifications & emails for student
    if (decision === 'approved') {
      await this.addNotification({
        userId: target.userId,
        title: `Task ${target.taskNumber} Approved! 🎉`,
        message: feedback || `Great job! Your submission for Task ${target.taskNumber} was approved (Score: ${score}/100). You've earned +20% progress.`,
        type: 'submission_approved'
      });

      await this.logEmail({
        to: target.userEmail,
        subject: `Task ${target.taskNumber} Approved - VirIntern`,
        preview: `Congratulations! Your project for Task ${target.taskNumber} was approved. ${target.taskNumber < 5 ? `Task ${target.taskNumber + 1} is now unlocked.` : 'Your internship is 100% complete!'}`,
        type: 'approved'
      });

      if (target.taskNumber < 5) {
        await this.addNotification({
          userId: target.userId,
          title: `Task ${target.taskNumber + 1} Unlocked 🔓`,
          message: `You can now start working on Task ${target.taskNumber + 1}: Check out the instructions on your dashboard.`,
          type: 'task_unlocked'
        });
      } else {
        await this.addNotification({
          userId: target.userId,
          title: `Internship 100% Completed! 🎓`,
          message: `Congratulations! You have completed all 5 milestone projects of your VirIntern virtual internship.`,
          type: 'completed'
        });

        await this.logEmail({
          to: target.userEmail,
          subject: `Congratulations! You Completed Your VirIntern Internship`,
          preview: `You have completed 100% of your internship requirements! Access your completion options and credentials now.`,
          type: 'completion'
        });
      }
    } else {
      await this.addNotification({
        userId: target.userId,
        title: `Task ${target.taskNumber} Requires Changes ⚠️`,
        message: feedback || 'Please review the feedback from your mentor and resubmit your project.',
        type: 'submission_rejected'
      });

      await this.logEmail({
        to: target.userEmail,
        subject: `Update on Task ${target.taskNumber} Submission`,
        preview: `Your submission requires a few adjustments before approval. Feedback: "${feedback}". You can resubmit anytime from your dashboard.`,
        type: 'rejected'
      });
    }

    this.emit('submissions', all);
    this.emit(`submissions_${target.userId}`, all.filter(s => s.userId === target!.userId));
    this.emit('submission_updated', target);
    this.emit('submission_verified', { submission: target, evaluation: evalRecord });
    this.emit('leaderboard_updated', null);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('virintern_leaderboard_updated', { detail: target }));
    }
    if (internship) {
      this.emit(`internship_${target.userId}`, internship);
    }
    if (userProfile) {
      this.emit(`user_${target.userId}`, userProfile);
      this.emit('all_users', this.getLocal<UserProfile[]>('all_users', []));
    }
  }

  // CERTIFICATES
  public async issueCertificates(user: UserProfile, internship: InternshipRecord): Promise<{ completion: CertificateRecord; appreciation: CertificateRecord }> {
    const domainCode = internship.domainId.substring(0, 2).toUpperCase() || 'VI';
    const randNum = Math.floor(100000 + Math.random() * 900000);
    const year = new Date().getFullYear();
    const certId = `VI-${year}-${domainCode}-${randNum}`;

    const resolvedStudentName = (user.name && user.name.trim().toLowerCase() !== 'student' && user.name.trim().toLowerCase() !== 'intern')
      ? user.name.trim()
      : (typeof window !== 'undefined'
          ? (localStorage.getItem(`virintern_user_name_${(user.email || '').toLowerCase()}`) ||
             (user.uid ? localStorage.getItem(`virintern_user_name_${user.uid}`) : null) ||
             localStorage.getItem('virintern_last_signup_name') ||
             user.name)
          : user.name) || (user.email ? user.email.split('@')[0] : 'Student Intern');

    const completionCert: CertificateRecord = {
      certificateId: certId,
      userId: user.uid,
      studentName: resolvedStudentName,
      internshipDomain: internship.domainName,
      internshipTitle: `${internship.domainName} Virtual Internship`,
      startDate: new Date(internship.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      completionDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      issueDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      type: 'Completion',
      grade: 'Distinction',
      status: 'valid'
    };

    const appreciationCert: CertificateRecord = {
      certificateId: `AP-${certId}`,
      userId: user.uid,
      studentName: resolvedStudentName,
      internshipDomain: internship.domainName,
      internshipTitle: `${internship.domainName} Practical Excellence`,
      startDate: completionCert.startDate,
      completionDate: completionCert.completionDate,
      issueDate: completionCert.issueDate,
      type: 'Appreciation',
      grade: 'High Commendation',
      status: 'valid'
    };

    const certs = this.getLocal<CertificateRecord[]>('certificates', []);
    certs.push(completionCert, appreciationCert);
    this.setLocal('certificates', certs);

    fetch('/api/certificates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(completionCert)
    }).catch(() => {});
    fetch('/api/certificates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appreciationCert)
    }).catch(() => {});

    try {
      await setDoc(doc(db, 'certificates', completionCert.certificateId), completionCert);
      await setDoc(doc(db, 'certificates', appreciationCert.certificateId), appreciationCert);
    } catch (err) {
      // fallback
    }

    return { completion: completionCert, appreciation: appreciationCert };
  }

  public async getCertificate(certificateId: string): Promise<CertificateRecord | null> {
    if (!certificateId || typeof certificateId !== 'string' || !certificateId.trim()) return null;
    const cleanId = certificateId.trim();

    const certs = this.getLocal<CertificateRecord[]>('certificates', []);
    const localMatch = certs.find(c => c.certificateId.toLowerCase() === cleanId.toLowerCase());
    if (localMatch) return localMatch;

    try {
      const res = await fetch(`/api/certificates/${encodeURIComponent(cleanId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.certificate) return data.certificate as CertificateRecord;
      }
    } catch {}

    try {
      const ref = safeDoc('certificates', cleanId);
      if (ref) {
        const snap = await getDoc(ref);
        if (snap.exists()) {
          return snap.data() as CertificateRecord;
        }
      }
    } catch (err) {
      // fallback
    }

    return null;
  }

  public async getUserCertificates(userId: string): Promise<CertificateRecord[]> {
    const certs = this.getLocal<CertificateRecord[]>('certificates', []);
    return certs.filter(c => c.userId === userId);
  }

  // REFERRAL SYSTEM (10% reward, prevents self-referrals and duplicates)
  public async getReferrals(userId: string): Promise<ReferralRecord[]> {
    const all = this.getLocal<ReferralRecord[]>('referrals', []);
    return all.filter(r => r.referrerUid === userId);
  }

  public async trackReferralSignup(referrerCode: string, newUser: UserProfile): Promise<boolean> {
    if (!referrerCode || referrerCode.trim() === '' || referrerCode === newUser.referralCode) {
      return false; // Self-referral prevented
    }

    const users = this.getLocal<UserProfile[]>('all_users', []);
    const referrer = users.find(u => u.referralCode.toLowerCase() === referrerCode.toLowerCase());
    if (!referrer || referrer.uid === newUser.uid) {
      return false; // Invalid or self-referral
    }

    const allRefs = this.getLocal<ReferralRecord[]>('referrals', []);
    // Prevent duplicate referral entry
    if (allRefs.some(r => r.referredUid === newUser.uid)) {
      return false;
    }

    const newRef: ReferralRecord = {
      id: `ref_${Date.now()}`,
      referrerUid: referrer.uid,
      referrerCode: referrer.referralCode,
      referredUid: newUser.uid,
      referredEmail: newUser.email,
      referredName: newUser.name,
      status: 'signed_up',
      rewardAmount: 0,
      rewardPaid: false,
      createdAt: new Date().toISOString()
    };

    allRefs.push(newRef);
    this.setLocal('referrals', allRefs);

    await this.addNotification({
      userId: referrer.uid,
      title: 'New Student Referred! 🎉',
      message: `${newUser.name} registered using your referral link. You will earn 10% commission when they complete their package purchase!`,
      type: 'reward'
    });

    return true;
  }

  public async processReferralPurchase(purchaserUid: string, packagePrice: number): Promise<void> {
    const allRefs = this.getLocal<ReferralRecord[]>('referrals', []);
    const ref = allRefs.find(r => r.referredUid === purchaserUid);
    if (!ref) return;

    // 10% reward calculation
    const reward = Number((packagePrice * 0.10).toFixed(2));
    ref.status = 'purchased';
    ref.rewardAmount = reward;
    ref.paidAt = new Date().toISOString();

    this.setLocal('referrals', allRefs);

    await this.addNotification({
      userId: ref.referrerUid,
      title: `Referral Reward Earned: ₹${reward} 💰`,
      message: `Your referral ${ref.referredName} completed their purchase. ₹${reward} has been credited to your referral balance!`,
      type: 'reward'
    });
  }

  // NOTIFICATIONS
  public async getNotifications(userId: string): Promise<AppNotification[]> {
    if (!userId || typeof userId !== 'string' || !userId.trim()) return [];
    let all = this.getLocal<AppNotification[]>('notifications', []);
    let userNotifs = all.filter(n => n.userId === userId);
    if (!userNotifs.length) {
      const defaultNotif: AppNotification = {
        id: `notif_welcome_${userId}`,
        userId,
        title: 'Welcome to VirIntern! 🎉',
        message: 'Your virtual internship portal is active. Review your pre-attached offer letter, check your assigned domain milestones, and submit Task 1.',
        type: 'internship_started',
        isRead: false,
        createdAt: new Date().toISOString()
      };
      all.unshift(defaultNotif);
      this.setLocal('notifications', all.slice(0, 50));
      userNotifs = [defaultNotif];
      try {
        const ref = safeDoc('notifications', defaultNotif.id);
        if (ref) setDoc(ref, cleanFirestoreData(defaultNotif)).catch(() => {});
      } catch {}
    }
    return userNotifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public async addNotification(item: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>): Promise<void> {
    const notif: AppNotification = {
      ...item,
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      isRead: false,
      createdAt: new Date().toISOString()
    };
    const all = this.getLocal<AppNotification[]>('notifications', []);
    all.unshift(notif);
    this.setLocal('notifications', all.slice(0, 50)); // limit 50

    try {
      const ref = safeDoc('notifications', notif.id);
      if (ref) {
        await setDoc(ref, cleanFirestoreData(notif));
      }
    } catch (e) {
      // fallback
    }

    const userNotifs = all.filter(n => n.userId === item.userId);
    this.emit(`notifications_${item.userId}`, userNotifs);
  }

  public async markNotificationAsRead(id: string): Promise<void> {
    if (!id || typeof id !== 'string' || !id.trim()) return;
    const all = this.getLocal<AppNotification[]>('notifications', []);
    const n = all.find(item => item.id === id);
    if (n) {
      n.isRead = true;
      this.setLocal('notifications', all);
      try {
        const ref = safeDoc('notifications', id);
        if (ref) {
          await updateDoc(ref, { isRead: true });
        }
      } catch (e) {
        // fallback
      }
      this.emit(`notifications_${n.userId}`, all.filter(item => item.userId === n.userId));
    }
  }

  public async markAllNotificationsAsRead(userId: string): Promise<void> {
    if (!userId || typeof userId !== 'string' || !userId.trim()) return;
    const all = this.getLocal<AppNotification[]>('notifications', []);
    all.forEach(n => {
      if (n.userId === userId) {
        n.isRead = true;
        try {
          const ref = safeDoc('notifications', n.id);
          if (ref) {
            updateDoc(ref, { isRead: true }).catch(() => {});
          }
        } catch {
          // fallback
        }
      }
    });
    this.setLocal('notifications', all);
    this.emit(`notifications_${userId}`, all.filter(item => item.userId === userId));
  }

  public subscribeNotifications(userId: string, callback: (notifs: AppNotification[]) => void): () => void {
    if (!userId || typeof userId !== 'string' || !userId.trim()) return () => {};

    const getFiltered = () => {
      let all = this.getLocal<AppNotification[]>('notifications', []);
      let userNotifs = all.filter(n => n.userId === userId);
      if (!userNotifs.length) {
        const defaultNotif: AppNotification = {
          id: `notif_welcome_${userId}`,
          userId,
          title: 'Welcome to VirIntern! 🎉',
          message: 'Your virtual internship portal is active. Review your pre-attached offer letter, check your assigned domain milestones, and submit Task 1.',
          type: 'internship_started',
          isRead: false,
          createdAt: new Date().toISOString()
        };
        all.unshift(defaultNotif);
        this.setLocal('notifications', all.slice(0, 50));
        userNotifs = [defaultNotif];
        try {
          const ref = safeDoc('notifications', defaultNotif.id);
          if (ref) setDoc(ref, cleanFirestoreData(defaultNotif)).catch(() => {});
        } catch {}
      }
      return userNotifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    };
    callback(getFiltered());

    const unsubLocal = this.on(`notifications_${userId}`, (data) => {
      callback(data);
    });

    let unsubFirestore: (() => void) | null = null;
    try {
      const notifsRef = collection(db, 'notifications');
      const q = query(notifsRef, where('userId', '==', userId));
      unsubFirestore = onSnapshot(q, (snap) => {
        if (!snap.empty) {
          const list: AppNotification[] = [];
          snap.forEach(d => list.push(d.data() as AppNotification));
          const localList = this.getLocal<AppNotification[]>('notifications', []);
          const mergedMap = new Map<string, AppNotification>();
          localList.filter(n => n.userId === userId).forEach(n => mergedMap.set(n.id, n));
          list.forEach(n => mergedMap.set(n.id, n));
          const merged = Array.from(mergedMap.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          callback(merged);
        } else {
          // If Firestore is empty, do not blow away local notifications!
          const localList = getFiltered();
          if (localList.length > 0) {
            callback(localList);
          }
        }
      }, (err) => {
        console.warn('Firestore notifications subscription fallback:', err.message);
      });
    } catch (e) {
      // fallback
    }

    return () => {
      unsubLocal();
      if (unsubFirestore) unsubFirestore();
    };
  }

  // EMAIL LOGS (for live simulator demo)
  public async getEmailLogs(): Promise<EmailLog[]> {
    return this.getLocal<EmailLog[]>('email_logs', []);
  }

  public async logEmail(email: Omit<EmailLog, 'id' | 'sentAt'>): Promise<void> {
    const newLog: EmailLog = {
      ...email,
      id: `em_${Date.now()}`,
      sentAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    const logs = await this.getEmailLogs();
    logs.unshift(newLog);
    this.setLocal('email_logs', logs.slice(0, 30));
    this.emit('email_logs', logs);
  }

  // INTERVIEW QUESTIONS
  public async getInterviewQuestions(category?: string, search?: string): Promise<InterviewQuestionItem[]> {
    let list = this.getLocal<InterviewQuestionItem[]>('questions', INTERVIEW_QUESTIONS_SEED);
    if (category && category !== 'All') {
      list = list.filter(q => q.category === category);
    }
    if (search && search.trim() !== '') {
      const qLower = search.toLowerCase();
      list = list.filter(q => (q.question || '').toLowerCase().includes(qLower) || (q.answer || '').toLowerCase().includes(qLower));
    }
    return list;
  }

  // USERS MANAGEMENT
  public async getAllUsers(): Promise<UserProfile[]> {
    const local = this.getLocal<UserProfile[]>('all_users', []);

    const serverPromise = (async (): Promise<UserProfile[]> => {
      try {
        const res = await fetch('/api/admin/users', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.users)) return data.users;
        }
      } catch {}
      return [];
    })();

    const firestorePromise = (async (): Promise<UserProfile[]> => {
      try {
        const snap = await withTimeout(getDocs(collection(db, 'users')), 5000);
        const list: UserProfile[] = [];
        snap.forEach(d => {
          const data = d.data() as UserProfile;
          if (data) list.push({ ...data, uid: data.uid || d.id });
        });
        return list;
      } catch {
        return [];
      }
    })();

    const [serverRes, fsRes] = await Promise.allSettled([serverPromise, firestorePromise]);
    const serverUsers = serverRes.status === 'fulfilled' ? serverRes.value : [];
    const fsUsers = fsRes.status === 'fulfilled' ? fsRes.value : [];

    if (serverUsers.length > 0 || fsUsers.length > 0) {
      const merged = this.mergeUsersList(serverUsers, fsUsers);

      // Hydrate Express if Firestore discovered additional registered students
      if (fsUsers.length > 0) {
        const serverUids = new Set(serverUsers.map(u => u.uid));
        const missingOnServer = fsUsers.filter(u => u.uid && !serverUids.has(u.uid));
        if (missingOnServer.length > 0) {
          fetch('/api/users/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ users: missingOnServer })
          }).catch(() => {});
        }
      }

      this.setLocal('all_users', merged);
      return merged;
    }
    return local;
  }

  public async getUserProfile(uid: string): Promise<UserProfile | null> {
    if (!uid || typeof uid !== 'string' || !uid.trim()) return null;

    const local = this.getLocal<UserProfile | null>(`user_${uid}`, null);
    if (local) {
      // Revalidate in background without blocking caller
      fetch(`/api/users/${uid}`).then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            this.setLocal(`user_${uid}`, data.user);
            this.emit(`user_${uid}`, data.user);
          }
        }
      }).catch(() => {});
      return local;
    }

    const allUsers = this.getLocal<UserProfile[]>('all_users', []);
    const cachedUser = allUsers.find(u => u.uid === uid);
    if (cachedUser) return cachedUser;

    try {
      const res = await fetch(`/api/users/${uid}`);
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          this.setLocal(`user_${uid}`, data.user);
          return data.user;
        }
      }
    } catch {}

    try {
      const ref = safeDoc('users', uid);
      if (!ref) return null;
      const snap = await withTimeout(getDoc(ref), 3500);
      if (snap && snap.exists()) {
        const u = snap.data() as UserProfile;
        this.setLocal(`user_${uid}`, u);
        return u;
      }
    } catch (e) {
      // fallback
    }
    return null;
  }

  public subscribeUserProfile(uid: string, callback: (user: UserProfile | null) => void): () => void {
    if (!uid || typeof uid !== 'string' || !uid.trim()) return () => {};

    const cached = this.getLocal<UserProfile | null>(`user_${uid}`, null);
    if (cached) callback(cached);

    const unsubLocal = this.on(`user_${uid}`, (data) => {
      callback(data);
    });

    let unsubFirestore: (() => void) | null = null;
    try {
      const userRef = safeDoc('users', uid);
      if (userRef) {
        unsubFirestore = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            const fresh = snap.data() as UserProfile;
            this.setLocal(`user_${uid}`, fresh);
            callback(fresh);
          }
        }, (err) => {
          console.warn('Firestore user profile subscription fallback:', err.message);
        });
      }
    } catch (e) {
      // fallback
    }

    return () => {
      unsubLocal();
      if (unsubFirestore) unsubFirestore();
    };
  }

  public subscribeAllUsers(callback: (users: UserProfile[]) => void): () => void {
    this.ensureLiveEvents();
    callback(this.getLocal<UserProfile[]>('all_users', []));

    let disposed = false;
    const syncUsers = () => {
      this.getAllUsers().then((users) => {
        if (!disposed) callback(users);
      }).catch(() => {});
    };
    syncUsers();

    // Live Firestore listener on users collection so new intern signups appear instantly in Admin Portal
    let unsubFirestore: (() => void) | null = null;
    try {
      unsubFirestore = onSnapshot(collection(db, 'users'), (snap) => {
        if (disposed) return;
        const fsUsers: UserProfile[] = [];
        snap.forEach(d => {
          const data = d.data() as UserProfile;
          if (data) fsUsers.push({ ...data, uid: data.uid || d.id });
        });
        const localUsers = this.getLocal<UserProfile[]>('all_users', []);
        const merged = this.mergeUsersList(localUsers, fsUsers);
        this.setLocal('all_users', merged);
        callback(merged);

        if (fsUsers.length > 0) {
          fetch('/api/users/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ users: fsUsers })
          }).catch(() => {});
        }
      }, () => {});
    } catch {}

    const unsubLocal = this.on('all_users', (data) => {
      if (!disposed) callback(data);
    });
    const unsubUserUpdated = this.on('user_updated', syncUsers);
    const pollInterval = setInterval(syncUsers, 5000);

    return () => {
      disposed = true;
      clearInterval(pollInterval);
      if (unsubFirestore) unsubFirestore();
      unsubLocal();
      unsubUserUpdated();
    };
  }

  public async saveUser(user: UserProfile): Promise<void> {
    if (!user || !user.uid || typeof user.uid !== 'string' || !user.uid.trim()) return;

    this.setLocal(`user_${user.uid}`, user);
    if (typeof window !== 'undefined' && user.name && user.name.toLowerCase() !== 'student' && user.name.toLowerCase() !== 'intern') {
      if (user.email) localStorage.setItem(`virintern_user_name_${user.email.toLowerCase().trim()}`, user.name);
      if (user.uid) localStorage.setItem(`virintern_user_name_${user.uid}`, user.name);
      localStorage.setItem('virintern_last_signup_name', user.name);
    }
    const all = await this.getAllUsers();
    const idx = all.findIndex(u => u.uid === user.uid);
    if (idx >= 0) {
      all[idx] = user;
    } else {
      all.push(user);
    }
    this.setLocal('all_users', all);

    this.emit(`user_${user.uid}`, user);
    this.emit('all_users', all);

    // Persist to server backend
    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      });
    } catch {}

    try {
      const ref = safeDoc('users', user.uid);
      if (ref) {
        await setDoc(ref, cleanFirestoreData(user), { merge: true });
      }
    } catch (err) {
      // fallback
    }
  }

  // E-AGREEMENT PERSISTENCE (Stored in Firebase database e_agreements + users)
  public async saveEAgreement(params: {
    userId: string;
    userName: string;
    userEmail: string;
    agreementVersion?: string;
  }): Promise<EAgreementRecord> {
    if (!params || !params.userId || typeof params.userId !== 'string') {
      throw new Error('Valid userId is required to save E-Agreement');
    }

    const acceptedAt = new Date().toISOString();
    const version = params.agreementVersion || 'v1.0-2026';
    const agreementDoc: EAgreementRecord = {
      id: params.userId,
      userId: params.userId,
      userName: params.userName,
      userEmail: params.userEmail,
      agreementVersion: version,
      agreementAccepted: true,
      acceptedAt,
      ipAddress: 'client-verified',
      termsSummary: 'VirIntern Virtual Internship E-Agreement, Honor Policy & Sequential Milestone Code of Conduct'
    };

    // 1. Cache locally
    this.setLocal(`e_agreement_${params.userId}`, agreementDoc);
    const allAgreements = this.getLocal<EAgreementRecord[]>('e_agreements_all', []);
    const existingIdx = allAgreements.findIndex(a => a.userId === params.userId);
    if (existingIdx >= 0) {
      allAgreements[existingIdx] = agreementDoc;
    } else {
      allAgreements.push(agreementDoc);
    }
    this.setLocal('e_agreements_all', allAgreements);

    // 2. Persist to Firestore e_agreements and merge into users collection
    try {
      const eRef = safeDoc('e_agreements', params.userId);
      const uRef = safeDoc('users', params.userId);
      const promises: Promise<any>[] = [];
      if (eRef) promises.push(setDoc(eRef, cleanFirestoreData(agreementDoc), { merge: true }));
      if (uRef) promises.push(setDoc(uRef, {
        agreementAccepted: true,
        agreementAcceptedAt: acceptedAt,
        agreementVersion: version,
        updatedAt: acceptedAt
      }, { merge: true }));
      await Promise.allSettled(promises);
    } catch (e) {
      console.warn('Firestore e_agreements write note:', e);
    }

    this.emit(`e_agreement_${params.userId}`, agreementDoc);
    return agreementDoc;
  }

  public async getEAgreement(userId: string): Promise<EAgreementRecord | null> {
    if (!userId || typeof userId !== 'string' || !userId.trim()) return null;

    const cached = this.getLocal<EAgreementRecord | null>(`e_agreement_${userId}`, null);
    if (cached) return cached;

    try {
      const ref = safeDoc('e_agreements', userId);
      if (ref) {
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as EAgreementRecord;
          this.setLocal(`e_agreement_${userId}`, data);
          return data;
        }
      }
    } catch (e) {
      // fallback
    }
    return null;
  }

  public async toggleUserSuspension(uid: string): Promise<void> {
    const all = await this.getAllUsers();
    const u = all.find(x => x.uid === uid);
    if (u) {
      u.isSuspended = !u.isSuspended;
      this.setLocal('all_users', all);
      this.setLocal(`user_${uid}`, u);
      this.emit(`user_${uid}`, u);
      this.emit('all_users', all);
      try {
        await fetch(`/api/admin/users/${uid}/toggle-suspend`, { method: 'POST' });
      } catch {}
      try {
        await updateDoc(doc(db, 'users', uid), { isSuspended: u.isSuspended });
      } catch {
        // fallback
      }
    }
  }

  // TASK ASSIGNMENTS PERSISTENCE (Randomized Allocation Records)
  public async getAssignments(studentId?: string): Promise<TaskAssignment[]> {
    const all = this.getLocal<TaskAssignment[]>('task_assignments', []);
    if (studentId) {
      return all.filter(a => a.studentId === studentId);
    }
    return all;
  }

  public async saveAssignment(assignment: TaskAssignment): Promise<void> {
    const all = await this.getAssignments();
    const idx = all.findIndex(a => a.id === assignment.id);
    if (idx >= 0) {
      all[idx] = assignment;
    } else {
      all.unshift(assignment);
    }
    this.setLocal('task_assignments', all);
    this.emit('task_assignments', all);
    this.emit(`assignments_${assignment.studentId}`, all.filter(a => a.studentId === assignment.studentId));

    try {
      const ref = safeDoc('assignments', assignment.id);
      if (ref) {
        await setDoc(ref, cleanFirestoreData(assignment));
      }
    } catch (e) {
      // fallback
    }
  }

  public subscribeAssignments(studentId: string | undefined, callback: (assignments: TaskAssignment[]) => void): () => void {
    const getFiltered = () => {
      const all = this.getLocal<TaskAssignment[]>('task_assignments', []);
      return studentId ? all.filter(a => a.studentId === studentId) : all;
    };
    callback(getFiltered());

    const channel = studentId ? `assignments_${studentId}` : 'task_assignments';
    const unsubLocal = this.on(channel, (data) => {
      callback(data);
    });

    let unsubFirestore: (() => void) | null = null;
    try {
      const ref = collection(db, 'assignments');
      const q = studentId ? query(ref, where('studentId', '==', studentId)) : ref;
      unsubFirestore = onSnapshot(q, (snap) => {
        const list: TaskAssignment[] = [];
        snap.forEach(d => list.push(d.data() as TaskAssignment));
        if (list.length > 0) {
          if (!studentId) this.setLocal('task_assignments', list);
          callback(list);
        }
      }, (err) => {
        console.warn('Firestore assignments subscription fallback:', err.message);
      });
    } catch {
      // fallback
    }

    return () => {
      unsubLocal();
      if (unsubFirestore) unsubFirestore();
    };
  }

  // AUDIT LOGGING (Section 13 & 14)
  public async logAudit(entry: Omit<AuditLogRecord, 'id' | 'timestamp'>): Promise<void> {
    const log: AuditLogRecord = {
      ...entry,
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString()
    };
    const all = this.getLocal<AuditLogRecord[]>('audit_logs', []);
    all.unshift(log);
    this.setLocal('audit_logs', all.slice(0, 100)); // retain last 100
    this.emit('audit_logs', all);

    try {
      const ref = safeDoc('auditLogs', log.id);
      if (ref) {
        await setDoc(ref, cleanFirestoreData(log));
      }
    } catch {
      // fallback
    }
  }

  // CAPSTONE INTEGRATED PROJECTS (Section 10)
  public async getCapstones(studentId?: string): Promise<CapstoneProjectRecord[]> {
    const all = this.getLocal<CapstoneProjectRecord[]>('capstones', []);
    if (studentId) {
      return all.filter(c => c.studentId === studentId);
    }
    return all;
  }

  public async saveCapstone(capstone: CapstoneProjectRecord): Promise<void> {
    const all = await this.getCapstones();
    const idx = all.findIndex(c => c.id === capstone.id);
    if (idx >= 0) {
      all[idx] = capstone;
    } else {
      all.unshift(capstone);
    }
    this.setLocal('capstones', all);
    this.emit('capstones', all);
    this.emit(`capstones_${capstone.studentId}`, all.filter(c => c.studentId === capstone.studentId));

    try {
      const ref = safeDoc('capstones', capstone.id);
      if (ref) {
        await setDoc(ref, cleanFirestoreData(capstone));
      }
    } catch {
      // fallback
    }
  }

  // DOMAIN LEADERBOARD & PERFORMANCE (Section 12 & Domain Rankings)
  public async getDomainLeaderboard(domainId: string, currentUserId?: string): Promise<DomainLeaderboardEntry[]> {
    const serverPromise = (async (): Promise<DomainLeaderboardEntry[]> => {
      try {
        const params = new URLSearchParams({ domainId: domainId || 'web-dev' });
        if (currentUserId) params.set('currentUserId', currentUserId);
        const res = await fetch(`/api/domain-leaderboard?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.leaderboard)) return data.leaderboard;
        }
      } catch {}
      return [];
    })();

    const [serverEntries, allSubs, allUsers, allDomains] = await Promise.all([
      serverPromise,
      this.getSubmissions(),
      this.getAllUsers(),
      this.getDomains()
    ]);

    const domainSubs = allSubs.filter(s =>
      isSameDomain(s.domainId, domainId, s.domainName, domainId)
    );

    const userStats = new Map<string, {
      userId: string;
      userName: string;
      userEmail?: string;
      userPhoto?: string;
      completedTasks: Set<number>;
      scores: number[];
      totalPoints: number;
      lastActive: string;
    }>();

    for (const sub of domainSubs) {
      if (sub.status !== 'approved') continue;
      const u = allUsers.find(x => x.uid === sub.userId);
      if (this.isExcludedFromStudentLeaderboard(u, sub.userEmail, sub.userId)) continue;

      if (!userStats.has(sub.userId)) {
        userStats.set(sub.userId, {
          userId: sub.userId,
          userName: u?.name || sub.userName || 'Intern',
          userEmail: u?.email || sub.userEmail,
          userPhoto: u?.photoURL,
          completedTasks: new Set<number>(),
          scores: [],
          totalPoints: 0,
          lastActive: sub.reviewedAt || sub.submittedAt
        });
      }
      const entry = userStats.get(sub.userId)!;
      const tNum = Number(sub.taskNumber || 1);
      if (!entry.completedTasks.has(tNum)) {
        entry.completedTasks.add(tNum);
        const score = Number(sub.rubricScore ?? 85);
        entry.scores.push(score);
        const diff = (sub.level || 'Intermediate').toLowerCase();
        let maxPts = 150;
        if (diff === 'beginner' || diff === 'easy') maxPts = 100;
        else if (diff === 'advanced' || diff === 'hard') maxPts = 200;
        entry.totalPoints += Math.round((score / 100) * maxPts);

        const ts = new Date(sub.reviewedAt || sub.submittedAt).getTime();
        if (ts > new Date(entry.lastActive).getTime()) {
          entry.lastActive = sub.reviewedAt || sub.submittedAt;
        }
      }
    }

    // Ensure current non-admin user enrolled in this domain is visible at 0 pts
    if (currentUserId && !userStats.has(currentUserId)) {
      const u = allUsers.find(x => x.uid === currentUserId);
      if (!this.isExcludedFromStudentLeaderboard(u, u?.email, currentUserId)) {
        const internship = await this.getInternship(currentUserId, domainId);
        if (internship && isSameDomain(internship.domainId, domainId, internship.domainName, domainId)) {
          userStats.set(currentUserId, {
            userId: currentUserId,
            userName: u?.name || 'You',
            userEmail: u?.email,
            userPhoto: u?.photoURL,
            completedTasks: new Set<number>(),
            scores: [],
            totalPoints: 0,
            lastActive: new Date().toISOString()
          });
        }
      }
    }

    const domainItem = allDomains.find(d => isSameDomain(d.id, domainId, d.name, domainId));
    const domainName = domainItem?.name || 'Domain Track';

    const entryMap = new Map<string, DomainLeaderboardEntry>();
    for (const stat of userStats.values()) {
      const count = stat.completedTasks.size;
      const sumScores = stat.scores.reduce((a, b) => a + b, 0);
      const avg = stat.scores.length > 0 ? Math.round(sumScores / stat.scores.length) : 0;
      const best = stat.scores.length > 0 ? Math.max(...stat.scores) : 0;

      let levelBadge = 'Rising Intern 🌱';
      if (count === 5 && avg >= 92) levelBadge = 'Grandmaster 🏆';
      else if (count >= 4) levelBadge = 'Elite Architect 🌟';
      else if (count >= 3) levelBadge = 'Senior Fellow ⚡';
      else if (count >= 2) levelBadge = 'Core Builder 🚀';

      entryMap.set(stat.userId, {
        rank: 0,
        userId: stat.userId,
        userName: stat.userName,
        userEmail: stat.userEmail,
        userPhoto: stat.userPhoto,
        domainId,
        domainName,
        totalScore: stat.totalPoints,
        completedTasksCount: count,
        averageScore: avg,
        bestTaskScore: best,
        levelBadge,
        statusText: count === 5 ? '100% Completed' : `Milestone ${count} of 5`,
        isCurrentUser: stat.userId === currentUserId,
        lastActive: stat.lastActive
      });
    }

    for (const srv of serverEntries) {
      if (!srv || !srv.userId) continue;
      if (this.isExcludedFromStudentLeaderboard(null, srv.userEmail, srv.userId)) continue;
      const existing = entryMap.get(srv.userId);
      if (!existing || (srv.totalScore || 0) > (existing.totalScore || 0)) {
        entryMap.set(srv.userId, { ...srv, isCurrentUser: srv.userId === currentUserId });
      }
    }

    const entries = Array.from(entryMap.values());
    entries.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.completedTasksCount !== a.completedTasksCount) return b.completedTasksCount - a.completedTasksCount;
      return b.averageScore - a.averageScore;
    });

    entries.forEach((e, idx) => {
      e.rank = idx + 1;
    });

    this.setLocal(`domain_lb_${domainId}`, entries);
    return entries;
  }

  public subscribeDomainLeaderboard(
    domainId: string,
    currentUserId: string | undefined,
    callback: (entries: DomainLeaderboardEntry[]) => void
  ): () => void {
    this.ensureLiveEvents();

    let disposed = false;
    const refresh = () => {
      if (!domainId) return;
      this.getDomainLeaderboard(domainId, currentUserId).then((list) => {
        if (!disposed) callback(list);
      }).catch(() => {});
    };

    const cached = this.getLocal<DomainLeaderboardEntry[]>(`domain_lb_${domainId}`, []);
    if (cached.length > 0) callback(cached);

    refresh();

    const unsubLb = this.on('leaderboard_updated', refresh);
    const unsubVer = this.on('submission_verified', refresh);
    const unsubSub = this.on('submission_updated', refresh);
    const unsubInt = this.on('internship_updated', refresh);
    const unsubUser = this.on('user_updated', refresh);

    const handleWindowEvent = () => refresh();
    if (typeof window !== 'undefined') {
      window.addEventListener('virintern_leaderboard_updated', handleWindowEvent);
      window.addEventListener('virintern_submission_updated', handleWindowEvent);
      window.addEventListener('virintern_internship_updated', handleWindowEvent);
    }

    let unsubFsLb: (() => void) | null = null;
    try {
      unsubFsLb = onSnapshot(collection(db, 'leaderboard'), () => {
        if (!disposed) refresh();
      }, () => {});
    } catch {}

    const pollInterval = setInterval(refresh, 4000);

    return () => {
      disposed = true;
      clearInterval(pollInterval);
      if (unsubFsLb) unsubFsLb();
      unsubLb();
      unsubVer();
      unsubSub();
      unsubInt();
      unsubUser();
      if (typeof window !== 'undefined') {
        window.removeEventListener('virintern_leaderboard_updated', handleWindowEvent);
        window.removeEventListener('virintern_submission_updated', handleWindowEvent);
        window.removeEventListener('virintern_internship_updated', handleWindowEvent);
      }
    };
  }

  // ==========================================
  // COMPANY PORTAL & TALENT DISCOVERY METHODS
  // ==========================================

  public async getCompanies(): Promise<CompanyProfile[]> {
    try {
      const res = await fetch('/api/companies');
      if (res.ok) {
        const data = await res.json();
        if (data.companies) {
          this.setLocal('all_companies', data.companies);
          return data.companies;
        }
      }
    } catch {}
    return this.getLocal<CompanyProfile[]>('all_companies', []);
  }

  public async getCompany(id: string): Promise<CompanyProfile | null> {
    const cached = this.getLocal<CompanyProfile | null>(`company_${id}`, null);
    try {
      const res = await fetch(`/api/companies/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.company) {
          this.setLocal(`company_${id}`, data.company);
          return data.company;
        }
      }
    } catch {}
    if (cached) return cached;
    const all = await this.getCompanies();
    return all.find(c => c.id === id || c.userId === id) || null;
  }

  public async saveCompany(company: CompanyProfile): Promise<CompanyProfile> {
    this.setLocal(`company_${company.id}`, company);
    const all = await this.getCompanies();
    const idx = all.findIndex(c => c.id === company.id);
    if (idx >= 0) all[idx] = company;
    else all.push(company);
    this.setLocal('all_companies', all);
    this.emit('all_companies', all);
    this.emit(`company_${company.id}`, company);

    try {
      const res = await fetch('/api/companies/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(company)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.company) return data.company;
      }
    } catch {}
    return company;
  }

  public async updateCompany(id: string, updates: Partial<CompanyProfile>): Promise<CompanyProfile> {
    const existing = await this.getCompany(id);
    const updated: CompanyProfile = {
      ...(existing || {} as CompanyProfile),
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };
    this.setLocal(`company_${id}`, updated);
    const all = await this.getCompanies();
    const idx = all.findIndex(c => c.id === id);
    if (idx >= 0) all[idx] = updated;
    else all.push(updated);
    this.setLocal('all_companies', all);
    this.emit('all_companies', all);
    this.emit(`company_${id}`, updated);

    try {
      await fetch(`/api/companies/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch {}
    return updated;
  }

  public async verifyCompany(
    companyId: string,
    status: CompanyVerificationStatus,
    notes?: string,
    reviewerName = 'VirIntern Super Admin'
  ): Promise<void> {
    const all = await this.getCompanies();
    const target = all.find(c => c.id === companyId);
    if (target) {
      target.verificationStatus = status;
      target.talentDiscoveryEnabled = status === 'approved';
      if (notes) target.verificationNotes = notes;
      target.reviewedBy = reviewerName;
      target.reviewedAt = new Date().toISOString();
      target.updatedAt = new Date().toISOString();
      this.setLocal(`company_${companyId}`, target);
      this.setLocal('all_companies', all);
      this.emit('all_companies', all);
      this.emit(`company_${companyId}`, target);
    }

    try {
      await fetch(`/api/admin/companies/${companyId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, verificationNotes: notes, reviewerName })
      });
    } catch {}
  }

  public subscribeCompanies(callback: (companies: CompanyProfile[]) => void): () => void {
    callback(this.getLocal<CompanyProfile[]>('all_companies', []));
    this.getCompanies().then(callback).catch(() => {});
    return this.on('all_companies', callback);
  }

  // Candidates & Talent Discovery
  public async getCandidates(filters?: {
    domain?: string;
    search?: string;
    minScore?: number;
    status?: string;
  }): Promise<CandidateProfileView[]> {
    try {
      const q = new URLSearchParams();
      if (filters?.domain) q.set('domain', filters.domain);
      if (filters?.search) q.set('search', filters.search);
      if (filters?.minScore) q.set('minScore', String(filters.minScore));
      if (filters?.status) q.set('status', filters.status);

      const res = await fetch(`/api/candidates?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.candidates) {
          this.setLocal('talent_candidates', data.candidates);
          return data.candidates;
        }
      }
    } catch {}

    const users = await this.getAllUsers();
    const students = users.filter(u => u.role !== 'admin' && u.role !== 'company');
    const allSubs = await this.getSubmissions();
    const allEvals = this.getLocal<TaskEvaluationRecord[]>('all_evaluations', []);

    const list: CandidateProfileView[] = students.map((s, idx) => {
      const userSubs = allSubs.filter(sub => sub.userId === s.uid && sub.status === 'approved');
      const userEvals = allEvals.filter(e => e.userId === s.uid);
      const scores = userEvals.map(e => e.totalScore);
      const averageScore = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : (userSubs.length > 0 ? 88 : 0);
      const totalPoints = userEvals.reduce((a, b) => a + (b.earnedPoints || b.totalScore || 0), 0) || (userSubs.length * 100);

      const domainId = s.selectedDomain || 'web-dev';
      const domainName = s.selectedDomain || 'Web Development';

      const verifiedProjects = userSubs.map(sub => ({
        taskNumber: sub.taskNumber,
        title: sub.projectTitle || `Milestone ${sub.taskNumber}`,
        githubUrl: sub.githubUrl || sub.repositoryURL,
        projectUrl: sub.projectUrl || sub.demoURL,
        score: sub.rubricScore || 90,
        status: sub.status,
        verifiedAt: sub.reviewedAt || sub.submittedAt
      }));

      const defaultSkills = ['React', 'TypeScript', 'Node.js', 'Problem Solving', 'Git'];
      const skills = (s.skills && s.skills.length > 0) ? s.skills : defaultSkills;
      const progress = Math.min(100, Math.max(s.progress || 0, userSubs.length * 20));

      return {
        studentId: s.uid,
        displayName: s.name,
        domainId,
        domainName,
        progress,
        averageScore,
        totalPoints,
        rank: idx + 1,
        skills,
        bio: s.bio || `Specialized ${domainName} Virtual Intern delivering practical verified deliverables.`,
        completedTasksCount: userSubs.length,
        verifiedProjects,
        internshipStatus: progress >= 100 ? 'completed' : 'active',
        resumeUrl: s.consentShareResume !== false ? s.resumeUrl : undefined,
        githubProfileUrl: s.githubProfileUrl,
        linkedinProfileUrl: s.linkedinProfileUrl,
        consentShareProfile: s.consentShareProfile !== false,
        consentShareResume: s.consentShareResume !== false,
        lastActive: s.updatedAt || s.createdAt || new Date().toISOString()
      };
    });

    list.sort((a, b) => (b.totalPoints - a.totalPoints) || (b.averageScore - a.averageScore));
    list.forEach((c, i) => { c.rank = i + 1; });
    this.setLocal('talent_candidates', list);
    return list;
  }

  public subscribeCandidates(callback: (candidates: CandidateProfileView[]) => void): () => void {
    callback(this.getLocal<CandidateProfileView[]>('talent_candidates', []));
    this.getCandidates().then(callback).catch(() => {});
    return this.on('talent_candidates', callback);
  }

  // Shortlisting
  public async getShortlists(companyId?: string): Promise<ShortlistRecord[]> {
    try {
      const url = companyId ? `/api/shortlists?companyId=${companyId}` : '/api/shortlists';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.shortlists) {
          const key = companyId ? `shortlists_${companyId}` : 'all_shortlists';
          this.setLocal(key, data.shortlists);
          return data.shortlists;
        }
      }
    } catch {}
    const key = companyId ? `shortlists_${companyId}` : 'all_shortlists';
    return this.getLocal<ShortlistRecord[]>(key, []);
  }

  public async addToShortlist(item: Omit<ShortlistRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ShortlistRecord> {
    const id = `shortlist_${item.companyId}_${item.studentId}`;
    const now = new Date().toISOString();
    const record: ShortlistRecord = {
      ...item,
      id,
      createdAt: now,
      updatedAt: now
    };
    const list = await this.getShortlists(item.companyId);
    const existingIdx = list.findIndex(s => s.id === id);
    if (existingIdx >= 0) list[existingIdx] = record;
    else list.push(record);
    this.setLocal(`shortlists_${item.companyId}`, list);
    this.emit(`shortlists_${item.companyId}`, list);

    // Notify student about recruitment shortlist opportunity
    await this.addNotification({
      userId: item.studentId,
      title: '🎉 Corporate Shortlist Notification!',
      message: `${item.companyName} reviewed your performance and shortlisted you for "${item.roleOrOpportunityTitle}". Keep up the great work!`,
      type: 'reward'
    });

    try {
      await fetch('/api/shortlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
    } catch {}
    return record;
  }

  public async updateShortlist(id: string, updates: Partial<ShortlistRecord>): Promise<void> {
    const all = this.getLocal<ShortlistRecord[]>('all_shortlists', []);
    const target = all.find(s => s.id === id);
    if (target) {
      Object.assign(target, updates, { updatedAt: new Date().toISOString() });
      this.setLocal('all_shortlists', all);
      if (target.companyId) {
        const compList = this.getLocal<ShortlistRecord[]>(`shortlists_${target.companyId}`, []);
        const idx = compList.findIndex(s => s.id === id);
        if (idx >= 0) compList[idx] = target;
        this.setLocal(`shortlists_${target.companyId}`, compList);
        this.emit(`shortlists_${target.companyId}`, compList);
      }
    }
    try {
      await fetch(`/api/shortlists/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch {}
  }

  public async removeFromShortlist(id: string, companyId?: string): Promise<void> {
    if (companyId) {
      const list = await this.getShortlists(companyId);
      const filtered = list.filter(s => s.id !== id);
      this.setLocal(`shortlists_${companyId}`, filtered);
      this.emit(`shortlists_${companyId}`, filtered);
    }
    try {
      await fetch(`/api/shortlists/${id}`, { method: 'DELETE' });
    } catch {}
  }

  public subscribeShortlists(companyId: string, callback: (shortlists: ShortlistRecord[]) => void): () => void {
    callback(this.getLocal<ShortlistRecord[]>(`shortlists_${companyId}`, []));
    this.getShortlists(companyId).then(callback).catch(() => {});
    return this.on(`shortlists_${companyId}`, callback);
  }

  // Opportunities
  public async getOpportunities(companyId?: string, approvedOnly = false): Promise<RecruitmentOpportunity[]> {
    try {
      const q = new URLSearchParams();
      if (companyId) q.set('companyId', companyId);
      if (approvedOnly) q.set('approvedOnly', 'true');
      const res = await fetch(`/api/opportunities?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.opportunities) {
          const key = companyId ? `opps_${companyId}` : 'all_opportunities';
          this.setLocal(key, data.opportunities);
          return data.opportunities;
        }
      }
    } catch {}
    const key = companyId ? `opps_${companyId}` : 'all_opportunities';
    return this.getLocal<RecruitmentOpportunity[]>(key, []);
  }

  public async createOpportunity(data: Omit<RecruitmentOpportunity, 'id' | 'createdAt' | 'updatedAt' | 'approvalStatus'>): Promise<RecruitmentOpportunity> {
    const id = `opp_${Date.now()}`;
    const now = new Date().toISOString();
    const record: RecruitmentOpportunity = {
      ...data,
      id,
      approvalStatus: 'pending',
      createdAt: now,
      updatedAt: now
    };
    const list = await this.getOpportunities(data.companyId);
    list.unshift(record);
    this.setLocal(`opps_${data.companyId}`, list);
    this.emit(`opps_${data.companyId}`, list);

    try {
      const res = await fetch('/api/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
      if (res.ok) {
        const d = await res.json();
        if (d.opportunity) return d.opportunity;
      }
    } catch {}
    return record;
  }

  public async reviewOpportunity(id: string, status: OpportunityApprovalStatus, adminNotes?: string): Promise<void> {
    const all = await this.getOpportunities();
    const target = all.find(o => o.id === id);
    if (target) {
      target.approvalStatus = status;
      if (adminNotes) target.adminNotes = adminNotes;
      target.updatedAt = new Date().toISOString();
      this.setLocal('all_opportunities', all);
      this.emit('all_opportunities', all);
      if (target.companyId) {
        const compList = this.getLocal<RecruitmentOpportunity[]>(`opps_${target.companyId}`, []);
        const idx = compList.findIndex(o => o.id === id);
        if (idx >= 0) compList[idx] = target;
        this.setLocal(`opps_${target.companyId}`, compList);
        this.emit(`opps_${target.companyId}`, compList);
      }
    }
    try {
      await fetch(`/api/admin/opportunities/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminNotes })
      });
    } catch {}
  }

  public subscribeOpportunities(callback: (opps: RecruitmentOpportunity[]) => void): () => void {
    callback(this.getLocal<RecruitmentOpportunity[]>('all_opportunities', []));
    this.getOpportunities().then(callback).catch(() => {});
    return this.on('all_opportunities', callback);
  }
}

export const dataService = new DataService();
