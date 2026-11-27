import { ProjectTask, TaskDifficulty, DifficultyLevel, RubricCriterion } from '../types';

export interface DomainProjectTrack {
  id: string;
  domainId: string;
  trackIndex: number;
  trackTitle: string;
  projectDescription: string;
  realWorldScope: string;
  techStack: string[];
  tasks: {
    task2: {
      title: string;
      objective: string;
      description: string;
      difficulty: TaskDifficulty;
      instructions: string[];
      expectedOutput: string;
      submissionType: 'github_and_demo' | 'github_only' | 'all';
    };
    task3: {
      title: string;
      objective: string;
      description: string;
      difficulty: TaskDifficulty;
      instructions: string[];
      expectedOutput: string;
      submissionType: 'github_and_demo' | 'github_only' | 'all';
    };
    task4: {
      title: string;
      objective: string;
      description: string;
      difficulty: TaskDifficulty;
      instructions: string[];
      expectedOutput: string;
      submissionType: 'github_and_demo' | 'github_only' | 'all';
    };
    task5: {
      title: string;
      objective: string;
      description: string;
      difficulty: TaskDifficulty;
      instructions: string[];
      expectedOutput: string;
      submissionType: 'github_and_demo' | 'github_only' | 'all';
    };
  };
}

// Automatically and deterministically assign a distinct randomized project track per student
export function getStudentTrackIndex(userId?: string, totalTracks = 4): number {
  if (!userId) {
    try {
      const cached = localStorage.getItem('virintern_auto_random_track');
      if (cached !== null) return Math.abs(parseInt(cached, 10)) % totalTracks;
      const rand = Math.floor(Math.random() * totalTracks);
      localStorage.setItem('virintern_auto_random_track', String(rand));
      return rand;
    } catch {
      return 0;
    }
  }
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % totalTracks;
}

// Multi-Track Domain Projects (4 distinct production tracks per domain)
export const DOMAIN_TRACKS: Record<string, DomainProjectTrack[]> = {
  'web-dev': [
    {
      id: 'web-track-1',
      domainId: 'web-dev',
      trackIndex: 0,
      trackTitle: 'OmniStore - Modern E-Commerce Platform with Real-Time Cart & Checkout',
      projectDescription: 'Architect a responsive full-stack online storefront featuring product catalog filtering, cart persistence, inventory sync, and Stripe mock checkout.',
      realWorldScope: 'B2C E-Commerce & Retail Marketplace',
      techStack: ['React', 'TypeScript', 'Tailwind CSS', 'REST API', 'IndexedDB / Storage'],
      tasks: {
        task2: {
          title: 'Task 2: Core Storefront Architecture & Dynamic Product Catalog',
          objective: 'Construct modular component hierarchy, responsive product grid, multi-attribute filtering, and stateful cart management.',
          description: 'Build out the foundation of OmniStore with category filtering, search debouncing, price range sliders, and resilient cart state.',
          difficulty: 'Intermediate',
          instructions: [
            'Create reusable ProductCard, FilterSidebar, and CartDrawer components.',
            'Implement client-side category filtering, keyword search with 300ms debounce, and price sorting.',
            'Ensure cart items persist across page reloads using localStorage or IndexedDB.',
            'Structure clean TypeScript interfaces for Product, CartItem, and FilterState.'
          ],
          expectedOutput: 'Functional React/TS storefront with live catalog search, filtering, and persistent cart.',
          submissionType: 'github_and_demo'
        },
        task3: {
          title: 'Task 3: Dynamic Checkout Pipeline & Inventory Validation API',
          objective: 'Implement multi-step checkout workflow with form validation, coupon engine, and order confirmation generation.',
          description: 'Develop the order completion flow including shipping details validation, order summary calculation, tax logic, and receipt generator.',
          difficulty: 'Intermediate',
          instructions: [
            'Build a 3-step checkout stepper: Shipping Info → Payment Details → Order Confirmation.',
            'Validate form inputs with real-time feedback (card number, postal code, email format).',
            'Implement discount code application logic with real-time price adjustment.',
            'Generate a downloadable or printable digital order receipt with unique order ID.'
          ],
          expectedOutput: 'End-to-end checkout experience with order confirmation and invoice generator.',
          submissionType: 'github_and_demo'
        },
        task4: {
          title: 'Task 4: Performance Profiling, Image Lazy Loading & Security Hardening',
          objective: 'Optimize Core Web Vitals, implement responsive image loading, input sanitization, and automated test coverage.',
          description: 'Audit Lighthouse performance, eliminate re-render bottlenecks, sanitize customer reviews, and write Jest/Vitest unit tests.',
          difficulty: 'Advanced',
          instructions: [
            'Implement image lazy loading with blur-up placeholders for high-resolution product photography.',
            'Memoize expensive filtering computations using React useMemo and useCallback hooks.',
            'Sanitize user inputs to prevent XSS injection in product search and reviews.',
            'Write at least 3 unit tests verifying cart total calculations and coupon reductions.'
          ],
          expectedOutput: 'Optimized OmniStore achieving 90+ Lighthouse score with verified unit tests.',
          submissionType: 'github_only'
        },
        task5: {
          title: 'Task 5: Production Deployment, CI/CD Pipeline & Video Demonstration',
          objective: 'Deploy OmniStore to a public cloud provider with automated CI/CD and submit complete engineering documentation.',
          description: 'Final capstone milestone: Configure production build, deploy to Vercel/Netlify, write an exhaustive README.md, and record a video walkthrough.',
          difficulty: 'Advanced',
          instructions: [
            'Deploy the completed OmniStore application to a public production URL (e.g. Vercel, Netlify, Cloud Run).',
            'Configure GitHub Actions for automated linting and build verification on push.',
            'Draft a comprehensive README.md detailing system architecture, state flow diagram, and setup instructions.',
            'Record a 2-3 minute loom or screen recording demonstrating responsive UI, catalog filtering, and checkout.'
          ],
          expectedOutput: 'Live production URL, public GitHub repository with comprehensive README, and video demonstration link.',
          submissionType: 'all'
        }
      }
    },
    {
      id: 'web-track-2',
      domainId: 'web-dev',
      trackIndex: 1,
      trackTitle: 'CarePulse - Healthcare Patient Management & Telehealth Consultation Portal',
      projectDescription: 'Engineer a secure medical practice web portal for doctor appointment booking, patient health records telemetry, and prescription tracking.',
      realWorldScope: 'Digital Health & Telemedicine Services',
      techStack: ['React', 'TypeScript', 'Tailwind CSS', 'FullCalendar / Lucide', 'Zod'],
      tasks: {
        task2: {
          title: 'Task 2: Patient Onboarding, Doctor Roster & Appointment Scheduling Engine',
          objective: 'Build intuitive patient intake forms, interactive physician directory, and calendar slot booking engine.',
          description: 'Construct the patient intake flow and interactive appointment scheduling calendar with dynamic slot availability.',
          difficulty: 'Intermediate',
          instructions: [
            'Build patient registration with medical history tags, emergency contacts, and blood group selection.',
            'Develop an interactive physician directory searchable by specialty, hospital affiliation, and rating.',
            'Implement an interactive calendar interface showing real-time available consultation slots.',
            'Handle double-booking prevention and display booking confirmation modals.'
          ],
          expectedOutput: 'Interactive appointment booking interface with calendar slot selection and validation.',
          submissionType: 'github_and_demo'
        },
        task3: {
          title: 'Task 3: Patient Medical History Timeline & Digital Prescription Vault',
          objective: 'Develop chronological health records timeline, lab report viewer, and PDF prescription generator.',
          description: 'Build patient clinical record visualizations including vital statistics history, dosage schedules, and past appointments.',
          difficulty: 'Intermediate',
          instructions: [
            'Create an interactive medical timeline visualizing past consultations and lab results.',
            'Implement a digital prescription viewer showing medication name, dosage frequency, and refill alerts.',
            'Provide printable clinical summary cards for patient records.',
            'Add patient notification alerts for upcoming appointment reminders.'
          ],
          expectedOutput: 'Patient medical dashboard with interactive timeline and prescription management.',
          submissionType: 'github_and_demo'
        },
        task4: {
          title: 'Task 4: HIPAA-Conscious Form Validation, Access Control & Unit Testing',
          objective: 'Incorporate strict schema validation, simulated role-based access for Doctors vs Patients, and comprehensive tests.',
          description: 'Enforce strict schema validation on patient intake, restrict sensitive doctor notes, and verify booking logic with unit tests.',
          difficulty: 'Advanced',
          instructions: [
            'Implement Zod schema validation for all patient medical input fields.',
            'Simulate Role-Based Access Control (Patient View vs Doctor Clinical View).',
            'Sanitize and mask patient identification numbers (PID/SSN) in UI representations.',
            'Write unit tests verifying slot collision avoidance logic.'
          ],
          expectedOutput: 'Secure health portal with validated intake, role switching, and verified test suite.',
          submissionType: 'github_only'
        },
        task5: {
          title: 'Task 5: Production Cloud Deployment, Documentation & Walkthrough',
          objective: 'Deploy CarePulse to production, finalize clinical workflow documentation, and provide walkthrough recording.',
          description: 'Publish production application, document architecture and compliance design, and demonstrate patient scheduling flow.',
          difficulty: 'Advanced',
          instructions: [
            'Deploy CarePulse to a public URL (Vercel, Render, or Netlify).',
            'Write professional README with system workflow diagrams and medical entity schemas.',
            'Record a short video walkthrough showcasing appointment booking and prescription viewer.'
          ],
          expectedOutput: 'Live production URL, public GitHub repository with comprehensive README, and video demonstration link.',
          submissionType: 'all'
        }
      }
    },
    {
      id: 'web-track-3',
      domainId: 'web-dev',
      trackIndex: 2,
      trackTitle: 'CollabCanvas - Real-Time Team Markdown Docs & Kanban Workspace',
      projectDescription: 'Build a productivity workspace combining synchronized Markdown documentation with interactive Kanban task boards and real-time team activity logs.',
      realWorldScope: 'Developer Productivity & Team Collaboration SaaS',
      techStack: ['React', 'TypeScript', 'Tailwind CSS', 'Drag-and-Drop', 'Markdown Parser'],
      tasks: {
        task2: {
          title: 'Task 2: Interactive Kanban Board with Drag-and-Drop Task Lifecycle',
          objective: 'Develop drag-and-drop task columns (Backlog, In Progress, Review, Done) with priority labels and assignee tags.',
          description: 'Construct the core Kanban interface with fluid drag interactions, task creation modals, and column metric badges.',
          difficulty: 'Intermediate',
          instructions: [
            'Implement multi-column Kanban board with smooth drag-and-drop or state-driven reordering.',
            'Build task card component with priority chips (Urgent, High, Normal), due dates, and assignee avatars.',
            'Allow inline task editing, subtask progress checklist, and filter by assignee.',
            'Persist board modifications to local state storage.'
          ],
          expectedOutput: 'Interactive Kanban workspace with task creation, editing, and status movement.',
          submissionType: 'github_and_demo'
        },
        task3: {
          title: 'Task 3: Split-Pane Markdown Documentation Editor with Live Preview',
          objective: 'Build split-screen Markdown documentation engine with live HTML syntax rendering, code highlighting, and export.',
          description: 'Develop rich documentation editor supporting tables, checklist markdown, code snippet blocks, and PDF/HTML export.',
          difficulty: 'Intermediate',
          instructions: [
            'Build synchronized side-by-side Markdown editor with instant live preview.',
            'Support code syntax highlighting for JS/TS, Python, and SQL.',
            'Implement document revision history tracking with timestamped snapshots.',
            'Provide one-click export to Markdown file (.md) and formatted PDF.'
          ],
          expectedOutput: 'Live split-pane markdown documentation studio with syntax highlighting and export.',
          submissionType: 'github_and_demo'
        },
        task4: {
          title: 'Task 4: Workspace Search Indexing, Keyboard Shortcuts & Unit Tests',
          objective: 'Implement quick global search palette (Ctrl/Cmd+K), keyboard navigation, and board state unit tests.',
          description: 'Build command palette search across all tasks and docs, add keyboard shortcuts for power users, and write unit tests.',
          difficulty: 'Advanced',
          instructions: [
            'Build a Cmd+K command palette modal for instant task and document search.',
            'Implement keyboard shortcuts (e.g. "N" for new task, "Escape" to close modally).',
            'Write automated tests for column transitions and subtask percentage calculation.'
          ],
          expectedOutput: 'Keyboard-accelerated workspace with command palette and verified unit tests.',
          submissionType: 'github_only'
        },
        task5: {
          title: 'Task 5: Production Deployment, Architecture Blueprint & Video Demo',
          objective: 'Publish CollabCanvas live on the web, compile technical documentation, and record a walkthrough video.',
          description: 'Deploy to public hosting, provide detailed architecture documentation, and submit demonstration link.',
          difficulty: 'Advanced',
          instructions: [
            'Deploy CollabCanvas live to production (e.g. Vercel, Netlify).',
            'Create detailed README with workflow GIFs, component hierarchy, and setup instructions.',
            'Record a short video walkthrough showcasing Kanban transitions and markdown editor.'
          ],
          expectedOutput: 'Live production URL, public GitHub repository with comprehensive README, and video demonstration link.',
          submissionType: 'all'
        }
      }
    },
    {
      id: 'web-track-4',
      domainId: 'web-dev',
      trackIndex: 3,
      trackTitle: 'FinPulse - SaaS Subscription Management & Personal Wealth Dashboard',
      projectDescription: 'Construct a financial analytics application tracking recurring SaaS subscriptions, expenditure forecasting, budget variance, and monthly cash flow.',
      realWorldScope: 'FinTech & Personal Finance Analytics',
      techStack: ['React', 'TypeScript', 'Tailwind CSS', 'Chart.js / Recharts', 'Currency API'],
      tasks: {
        task2: {
          title: 'Task 2: Financial Account Overview & Recurring Subscription Tracker',
          objective: 'Develop recurring expense monitoring, billing cycle renewal countdowns, and categorization engine.',
          description: 'Build the financial overview dashboard with subscription cards, monthly spend aggregation, and category breakdown.',
          difficulty: 'Intermediate',
          instructions: [
            'Build dynamic subscription cards showing monthly cost, billing date, renewal alerts, and status.',
            'Implement quick-add subscription modal with category tagging (Entertainment, Utilities, Software).',
            'Calculate total monthly recurring burn rate and yearly projection in real-time.',
            'Implement multi-currency toggle (USD, EUR, INR) with live conversion simulation.'
          ],
          expectedOutput: 'Financial subscription dashboard with real-time spend calculations and currency switching.',
          submissionType: 'github_and_demo'
        },
        task3: {
          title: 'Task 3: Expenditure Analytics Charts & Budget Variance Forecasts',
          objective: 'Integrate interactive data visualization graphs (spending trends, category distribution, upcoming bills calendar).',
          description: 'Build graphical representations of cash flow trends, budget limit warnings, and projected savings.',
          difficulty: 'Intermediate',
          instructions: [
            'Render interactive line and bar charts illustrating monthly expense trends over 12 months.',
            'Build a donut chart illustrating percentage distribution across expense categories.',
            'Implement budget threshold alerts when category spending exceeds user-set targets.',
            'Provide CSV export of annual transaction and subscription ledgers.'
          ],
          expectedOutput: 'Interactive financial visualization dashboard with dynamic charts and budget alert triggers.',
          submissionType: 'github_and_demo'
        },
        task4: {
          title: 'Task 4: Financial Calculation Rigor, Data Encryption & Unit Testing',
          objective: 'Audit precision math calculations, sanitize numerical inputs, and write comprehensive test suites.',
          description: 'Ensure floating-point arithmetic precision (prevent rounding errors), mask account numbers, and write unit tests.',
          difficulty: 'Advanced',
          instructions: [
            'Implement floating-point safe arithmetic for currency math.',
            'Mask account identifiers and sensitive financial notes.',
            'Write automated tests covering annual cost compounding and currency exchange calculations.'
          ],
          expectedOutput: 'Mathematically robust financial portal with verified unit test suites.',
          submissionType: 'github_only'
        },
        task5: {
          title: 'Task 5: Production Deployment, Financial Architecture Blueprint & Walkthrough',
          objective: 'Deploy FinPulse to production, write engineering documentation, and produce a recorded demonstration.',
          description: 'Publish production application, document analytics formulas, and provide video walkthrough.',
          difficulty: 'Advanced',
          instructions: [
            'Deploy FinPulse to a public URL.',
            'Write comprehensive README outlining financial metrics, chart integration, and data schema.',
            'Record video demonstration highlighting subscription management and chart interactivity.'
          ],
          expectedOutput: 'Live production URL, public GitHub repository with comprehensive README, and video demonstration link.',
          submissionType: 'all'
        }
      }
    }
  ],
  'ai-ml': [
    {
      id: 'ai-track-1',
      domainId: 'ai-ml',
      trackIndex: 0,
      trackTitle: 'DocuMind - Multimodal Document Q&A and Enterprise RAG Knowledge Base',
      projectDescription: 'Build an enterprise Retrieval-Augmented Generation (RAG) assistant that indexes PDFs, extracts vector embeddings, and answers queries with citations.',
      realWorldScope: 'Generative AI & Enterprise Knowledge Engineering',
      techStack: ['Python', 'FastAPI', 'LangChain', 'ChromaDB / Pinecone', 'Open-Source Sentence Transformers / Vector Embeddings'],
      tasks: {
        task2: {
          title: 'Task 2: PDF Parsing, Chunking Pipeline & Vector Store Ingestion',
          objective: 'Construct the document ingestion pipeline, recursive text chunking, and embedding generation.',
          description: 'Build the foundational vector indexing pipeline for DocuMind with chunk overlap and similarity search.',
          difficulty: 'Intermediate',
          instructions: [
            'Implement document extraction for PDF, DOCX, and TXT files.',
            'Apply recursive character text splitting with 500-token chunks and 50-token overlap.',
            'Generate embeddings and persist to a local vector store (ChromaDB or FAISS).',
            'Write cosine similarity query tests to verify document retrieval accuracy.'
          ],
          expectedOutput: 'Document ingestion pipeline indexing files into vector storage with similarity search.',
          submissionType: 'github_and_demo'
        },
        task3: {
          title: 'Task 3: Conversational Memory, Query Rewriting & Grounded Citations',
          objective: 'Build conversational retrieval chain with chat history context and grounded page source citations.',
          description: 'Implement multi-turn conversation flow with hallucination guardrails and page citation metadata.',
          difficulty: 'Intermediate',
          instructions: [
            'Implement conversational memory buffering past user queries and agent responses.',
            'Format prompt templates instructing LLM to answer strictly from retrieved chunks with citations.',
            'Add fallback handling when query context is outside document scope.',
            'Build a clean FastAPI endpoint streaming response tokens.'
          ],
          expectedOutput: 'Streaming RAG API endpoint providing grounded responses with exact source references.',
          submissionType: 'github_and_demo'
        },
        task4: {
          title: 'Task 4: Hallucination Evaluation, RAG Benchmarking & Unit Testing',
          objective: 'Audit retrieval precision, benchmark answer faithfulness, and implement automated tests.',
          description: 'Measure context recall, evaluate response faithfulness with synthetic QA pairs, and test edge cases.',
          difficulty: 'Advanced',
          instructions: [
            'Construct a benchmark dataset of 15 domain queries with ground-truth answers.',
            'Measure Context Precision and Answer Relevance metrics.',
            'Sanitize user prompts to prevent prompt injection and system jailbreaks.',
            'Write unit tests for chunking logic and token counter limits.'
          ],
          expectedOutput: 'Evaluation test suite reporting RAG precision metrics and security validation.',
          submissionType: 'github_only'
        },
        task5: {
          title: 'Task 5: Production Cloud Deployment, Architecture Blueprint & Video Walkthrough',
          objective: 'Deploy the RAG application to cloud infrastructure with UI, and document system architecture.',
          description: 'Deploy API and web interface, document architecture diagrams, and record a technical walkthrough.',
          difficulty: 'Advanced',
          instructions: [
            'Deploy the RAG backend to Cloud Run, Render, or AWS ECS.',
            'Connect an interactive UI (Streamlit or React) allowing users to upload documents and query.',
            'Write README with architecture sequence diagrams and embedding configurations.',
            'Record a 2-3 minute video demonstration demonstrating document ingestion and grounded responses.'
          ],
          expectedOutput: 'Live production URL, public GitHub repository with comprehensive README, and video demonstration link.',
          submissionType: 'all'
        }
      }
    },
    {
      id: 'ai-track-2',
      domainId: 'ai-ml',
      trackIndex: 1,
      trackTitle: 'VisionGuard - Real-Time Computer Vision & Industrial Defect Detection',
      projectDescription: 'Develop a computer vision defect inspection pipeline using YOLOv8/ResNet to detect manufacturing irregularities in video streams.',
      realWorldScope: 'Edge AI & Industrial Computer Vision Automation',
      techStack: ['Python', 'OpenCV', 'PyTorch', 'YOLOv8', 'FastAPI'],
      tasks: {
        task2: {
          title: 'Task 2: Dataset Preprocessing, Annotation & Image Augmentation Pipeline',
          objective: 'Curate image dataset, apply geometric/color augmentations, and establish baseline classifier.',
          description: 'Construct the computer vision preprocessing pipeline with bounding box normalization.',
          difficulty: 'Intermediate',
          instructions: [
            'Prepare and split image dataset (70% train, 15% val, 15% test).',
            'Apply augmentations (random flips, rotations, gaussian blur, contrast adjustment).',
            'Verify bounding box coordinates after transformations.',
            'Build an automated data loader with PyTorch DataLoader.'
          ],
          expectedOutput: 'Augmented dataset loader with visual inspection plots and verification tests.',
          submissionType: 'github_and_demo'
        },
        task3: {
          title: 'Task 3: Model Training, Transfer Learning & Hyperparameter Tuning',
          objective: 'Fine-tune pre-trained vision backbone and evaluate precision-recall curves.',
          description: 'Train custom object detection/classification model and track loss convergence.',
          difficulty: 'Intermediate',
          instructions: [
            'Fine-tune pre-trained YOLOv8 or ResNet model on custom dataset.',
            'Monitor training/validation loss, mAP@0.5, and F1-score across 25+ epochs.',
            'Export best weights and generate confusion matrix across defect classes.',
            'Implement confidence threshold filtering for inference.'
          ],
          expectedOutput: 'Trained model weights with validation metrics plots and confusion matrix.',
          submissionType: 'github_and_demo'
        },
        task4: {
          title: 'Task 4: Inference Latency Optimization & Model Quantization',
          objective: 'Quantize model to ONNX / TensorRT format and benchmark frames per second (FPS).',
          description: 'Optimize inference speed for edge deployment and conduct regression tests.',
          difficulty: 'Advanced',
          instructions: [
            'Export PyTorch model to ONNX runtime format with FP16 quantization.',
            'Benchmark latency before and after optimization on CPU and GPU.',
            'Ensure bounding box detection accuracy remains within 2% of unquantized baseline.',
            'Write automated tests verifying inference output format consistency.'
          ],
          expectedOutput: 'Optimized ONNX model achieving 2x+ inference acceleration with benchmark report.',
          submissionType: 'github_only'
        },
        task5: {
          title: 'Task 5: Production Video Stream Inference API & Video Demonstration',
          objective: 'Deploy real-time video inference service with webcam/video upload and walkthrough demo.',
          description: 'Deploy inference microservice with video stream processing, and submit video walkthrough.',
          difficulty: 'Advanced',
          instructions: [
            'Build FastAPI service accepting video upload or webcam RTSP stream with bounding box overlay.',
            'Deploy service to cloud or containerized Docker host.',
            'Write exhaustive README detailing model architecture, mAP metrics, and setup.',
            'Record a 2-3 minute demonstration showcasing live video defect detection.'
          ],
          expectedOutput: 'Live demo URL, public GitHub repository with comprehensive README, and video demonstration link.',
          submissionType: 'all'
        }
      }
    }
  ],
  'python-dev': [
    {
      id: 'py-track-1',
      domainId: 'python-dev',
      trackIndex: 0,
      trackTitle: 'PyDataFlow - Automated Distributed Web Scraping & ETL Data Pipeline',
      projectDescription: 'Construct a multi-threaded web data extraction and transformation pipeline with deduplication, scheduling, and PostgreSQL persistence.',
      realWorldScope: 'Data Engineering & Backend Automation',
      techStack: ['Python 3', 'BeautifulSoup4', 'Playwright / Selenium', 'Celery / Redis', 'PostgreSQL'],
      tasks: {
        task2: {
          title: 'Task 2: Resilient Web Crawler Architecture & Data Extraction Engine',
          objective: 'Develop asynchronous scraping engine with proxy rotation, rate-limiting, and schema parsing.',
          description: 'Build the core extraction engine handling dynamic DOM rendering, pagination, and retries.',
          difficulty: 'Intermediate',
          instructions: [
            'Build modular scraper classes extracting structured product/news data.',
            'Implement exponential backoff retries and User-Agent randomization.',
            'Handle pagination up to 50+ pages without memory leaks.',
            'Validate extracted fields using Pydantic models.'
          ],
          expectedOutput: 'Functional scraper extracting structured records with schema validation.',
          submissionType: 'github_and_demo'
        },
        task3: {
          title: 'Task 3: ETL Transformation Pipeline, Deduplication & Database Persistence',
          objective: 'Construct transformation pipeline cleaning nulls, deduplicating records, and bulk inserting to database.',
          description: 'Implement data cleaning, currency normalization, upsert logic, and daily scheduled execution.',
          difficulty: 'Intermediate',
          instructions: [
            'Standardize text fields, dates, and currency values.',
            'Implement hash-based deduplication preventing repeated database records.',
            'Write batch upsert queries with SQLAlchemy or asyncpg.',
            'Configure cron or APScheduler for periodic automated execution.'
          ],
          expectedOutput: 'End-to-end ETL script loading clean data into database with zero duplicates.',
          submissionType: 'github_and_demo'
        },
        task4: {
          title: 'Task 4: Concurrency Profiling, Memory Optimization & Unit Testing',
          objective: 'Profile async throughput, benchmark memory usage with tracemalloc, and write unit tests.',
          description: 'Optimize concurrent tasks with asyncio/ThreadPoolExecutor and write mocking tests.',
          difficulty: 'Advanced',
          instructions: [
            'Benchmark scraping performance comparing synchronous vs asyncio approaches.',
            'Profile memory consumption during large payload transformations.',
            'Write pytest test suite with responses/pytest-mock testing network failure resilience.',
            'Achieve 85%+ test coverage on data validation and transformation modules.'
          ],
          expectedOutput: 'Benchmarked async pipeline with 85%+ test coverage and profiling report.',
          submissionType: 'github_only'
        },
        task5: {
          title: 'Task 5: Containerized Deployment, Cloud Scheduler & Walkthrough Recording',
          objective: 'Package ETL service in Docker, deploy to cloud with automated alerts, and record walkthrough.',
          description: 'Containerize solution, configure automated Telegram/Email completion alerts, and record video.',
          difficulty: 'Advanced',
          instructions: [
            'Write multi-stage Dockerfile and docker-compose.yml with PostgreSQL and Redis.',
            'Deploy to public cloud or automated runner.',
            'Implement failure webhook alert to Discord/Slack on failed pipeline runs.',
            'Record a 2-3 minute video demonstration walking through pipeline execution.'
          ],
          expectedOutput: 'Live repository with Docker setup, cloud scheduler logs, and video demonstration link.',
          submissionType: 'all'
        }
      }
    }
  ]
};

// Generic Domain Fallback Track Generator for all domains
export function getDomainTracksForDomain(domainId: string, domainName: string): DomainProjectTrack[] {
  if (DOMAIN_TRACKS[domainId] && DOMAIN_TRACKS[domainId].length > 0) {
    return DOMAIN_TRACKS[domainId];
  }

  // 4 distinct production tracks tailored to the domain
  const trackThemes: { title: string; desc: string; focus: string }[] = [
    {
      title: `Enterprise ${domainName} Platform - Core Infrastructure & Scalable Systems`,
      desc: `Architect a resilient, production-grade ${domainName} system implementing enterprise best practices, modular architecture, and real-time data handling.`,
      focus: 'Enterprise Scalability & Distributed Systems'
    },
    {
      title: `Intelligent ${domainName} Solution - Real-Time Telemetry & Cloud Integration`,
      desc: `Develop an advanced ${domainName} pipeline integrating automated data ingestion, event processing, and real-time dashboard analytics.`,
      focus: 'Real-Time Telemetry & Cloud Services'
    },
    {
      title: `Security-Hardened ${domainName} Suite - Automated Auditing & Compliance`,
      desc: `Build a hardened ${domainName} environment with automated verification, input sanitization, vulnerability scanning, and audit logs.`,
      focus: 'Cyber Resilience & Compliance Automation'
    },
    {
      title: `Next-Gen ${domainName} Workstation - Predictive Analytics & Smart Workflows`,
      desc: `Engineer an interactive ${domainName} application featuring predictive modeling, workflow automation, and executive reporting.`,
      focus: 'Predictive Modeling & Automation Workflows'
    }
  ];

  return trackThemes.map((theme, idx) => ({
    id: `${domainId}-track-${idx + 1}`,
    domainId,
    trackIndex: idx,
    trackTitle: theme.title,
    projectDescription: theme.desc,
    realWorldScope: theme.focus,
    techStack: [domainName, 'Modern Architecture', 'REST APIs', 'Cloud Services', 'CI/CD'],
    tasks: {
      task2: {
        title: `Task 2: Core Architecture & ${theme.focus} Baseline`,
        objective: `Establish foundational data models, configure modular architecture, and construct your initial ${domainName} prototype.`,
        description: `Implement the baseline system structure for "${theme.title}". Ensure clean separation of concerns and robust error handling using free open-source tools.`,
        difficulty: 'Intermediate',
        instructions: [
          `Set up your local workspace using free tools (VS Code, Git, or browser-based IDE). Zero paid software required.`,
          `Implement foundational data models, configuration pipelines, and business logic adhering to modern ${domainName} standards.`,
          'Incorporate comprehensive error handling, input validation, and informative console/UI logs.',
          'Commit all code to a free public GitHub repository with clean, descriptive commit messages.'
        ],
        expectedOutput: `Functional baseline implementation of ${theme.title} with clear documentation.`,
        submissionType: 'github_and_demo'
      },
      task3: {
        title: `Task 3: Dynamic Feature Pipeline & External Service Integration`,
        objective: `Expand the system with interactive data ingestion, dynamic processing, and external API or database connectors.`,
        description: `Advance ${theme.title} by building responsive data-driven modules and handling real-world edge cases.`,
        difficulty: 'Intermediate',
        instructions: [
          'Integrate asynchronous data streams, public free RESTful endpoints, or local mock databases (SQLite/IndexedDB).',
          'Develop interactive workflows enabling end-user customization, filtering, and data processing.',
          'Implement client-side caching or state preservation for smooth responsiveness.',
          'Ensure responsive UI or CLI feedback across loading, empty, and error states.'
        ],
        expectedOutput: 'Interactive project modules deployed with demonstration recording or repository link.',
        submissionType: 'github_and_demo'
      },
      task4: {
        title: `Task 4: Performance Profiling, Security Hardening & Unit Tests`,
        objective: `Optimize execution throughput, audit security controls, and implement automated unit and regression test coverage.`,
        description: `Harden ${theme.title} against edge-case failures, optimize resource consumption, and achieve high test coverage.`,
        difficulty: 'Advanced',
        instructions: [
          'Profile system bottlenecks and apply targeted algorithmic, caching, or code-splitting optimizations.',
          'Enforce strict input validation, data sanitization, and secure handling of environment variables.',
          'Write automated unit and integration tests verifying core business logic using free test frameworks (Jest/Vitest/pytest).',
          'Document benchmark performance improvements in your project repository.'
        ],
        expectedOutput: 'Optimized codebase with passing automated test suite and security audit report.',
        submissionType: 'github_only'
      },
      task5: {
        title: `Task 5: Production Deployment, System Documentation & Video Demo`,
        objective: `Deploy the capstone ${domainName} system to production, finalize architectural documentation, and record a walkthrough.`,
        description: `Finalize the production release of ${theme.title} with continuous integration and comprehensive engineering submission.`,
        difficulty: 'Advanced',
        instructions: [
          'Deploy the completed project to a free public cloud hosting platform (Vercel, Netlify, Render, GitHub Pages, or Colab).',
          'Draft a comprehensive README.md containing project overview, setup commands, architecture diagram, and feature screenshots.',
          'Configure a free GitHub Actions workflow for automated linting or build verification.',
          'Record a 2-3 minute free screen recording (Loom or clip) demonstrating core project features.'
        ],
        expectedOutput: 'Live production URL, public GitHub repository with comprehensive README, and video demonstration link.',
        submissionType: 'all'
      }
    }
  }));
}

export const DEFAULT_TASK_RUBRIC: Record<string, number> = {
  functionality: 30,
  requirements: 25,
  quality: 20,
  documentation: 10,
  errorHandling: 10,
  originality: 5
};

// Generate the complete 5 tasks for a student given their domain and unique student UID
export function generateStudentTasks(domainId: string, domainName: string, userId?: string): ProjectTask[] {
  const tracks = getDomainTracksForDomain(domainId, domainName);
  const trackIdx = getStudentTrackIndex(userId, tracks.length);
  const assignedTrack = tracks[trackIdx];

  const tasks: ProjectTask[] = [];

  const task1Instructions = [
    'Preview and verify your pre-attached official VirIntern Internship Offer Letter (customized to your name & domain).',
    'Open and subscribe to the official YouTube Channel (@virintern) and provide your channel handle for community verification.',
    'Share your official offer letter announcement on LinkedIn and paste your post link.',
    'Submit this onboarding milestone for mentor review and verification to unlock Task 2 and start your domain project!'
  ];

  // TASK 1: Dedicated 100% EXCLUSIVELY to Onboarding: Offer Letter Post Verification + YouTube Channel Subscription + LinkedIn Verification
  tasks.push({
    id: `${domainId}-task-1`,
    taskId: `${domainId}-task-1`,
    domainId,
    domain: domainId,
    taskNumber: 1,
    title: 'Task 1: Official Onboarding & Verification (Offer Letter + YouTube & LinkedIn Verification)',
    objective: 'Review & verify your official VirIntern Internship Offer Letter, subscribe to the official YouTube Channel (@virintern), and share & verify your LinkedIn commencement announcement post.',
    description: `Welcome to your VirIntern Virtual Internship in ${domainName}! Task 1 is dedicated exclusively to enrollment, YouTube community membership, and LinkedIn commencement post verification. Once completed, your assigned domain virtual internship project (${assignedTrack.trackTitle}) will be unlocked in Task 2.`,
    difficulty: 'Beginner',
    requirements: task1Instructions,
    instructions: task1Instructions,
    expectedOutput: 'Verified Offer Letter Acceptance + Official YouTube Community Membership + Verified LinkedIn Announcement Post Link.',
    submissionType: 'document_or_link',
    allowedSubmissionTypes: ['text', 'pdf', 'image', 'file'],
    evaluationRubric: DEFAULT_TASK_RUBRIC,
    passingScore: 70,
    maximumAttempts: 3,
    verificationRequirement: 'Pre-Attached Official Offer Letter Review + YouTube Community Verification + Verified LinkedIn Post',
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

  // TASKS 2-5: Assigned Unique Virtual Internship Project Track as per domain (Won't repeat for other students)
  const t = assignedTrack.tasks;

  // Task 2
  tasks.push({
    id: `${domainId}-task-2`,
    taskId: `${domainId}-task-2`,
    domainId,
    domain: domainId,
    taskNumber: 2,
    title: `Task 2: [${assignedTrack.trackTitle}] - Core Architecture & Baseline Prototype`,
    objective: t.task2.objective,
    description: `Project Scope: ${assignedTrack.projectDescription}\n\nTask Objective: ${t.task2.description}`,
    difficulty: t.task2.difficulty as any,
    requirements: t.task2.instructions,
    instructions: t.task2.instructions,
    expectedOutput: t.task2.expectedOutput,
    submissionType: t.task2.submissionType,
    allowedSubmissionTypes: ['text', 'github', 'project_url', 'pdf', 'image', 'file'],
    evaluationRubric: DEFAULT_TASK_RUBRIC,
    passingScore: 70,
    maximumAttempts: 3,
    resources: [
      { title: 'Domain Architecture Guide', url: 'https://developer.mozilla.org' },
      { title: 'Clean Code Checklist', url: 'https://github.com' }
    ],
    isActive: true,
    createdAt: new Date().toISOString()
  });

  // Task 3
  tasks.push({
    id: `${domainId}-task-3`,
    taskId: `${domainId}-task-3`,
    domainId,
    domain: domainId,
    taskNumber: 3,
    title: `Task 3: [${assignedTrack.trackTitle}] - Dynamic Features & External Integration`,
    objective: t.task3.objective,
    description: `Project Scope: ${assignedTrack.projectDescription}\n\nTask Objective: ${t.task3.description}`,
    difficulty: t.task3.difficulty as any,
    requirements: t.task3.instructions,
    instructions: t.task3.instructions,
    expectedOutput: t.task3.expectedOutput,
    submissionType: t.task3.submissionType,
    allowedSubmissionTypes: ['text', 'github', 'project_url', 'pdf', 'image', 'file'],
    evaluationRubric: DEFAULT_TASK_RUBRIC,
    passingScore: 70,
    maximumAttempts: 3,
    resources: [
      { title: 'API Integration Patterns', url: 'https://github.com' },
      { title: 'State Management Best Practices', url: 'https://github.com' }
    ],
    isActive: true,
    createdAt: new Date().toISOString()
  });

  // Task 4
  tasks.push({
    id: `${domainId}-task-4`,
    taskId: `${domainId}-task-4`,
    domainId,
    domain: domainId,
    taskNumber: 4,
    title: `Task 4: [${assignedTrack.trackTitle}] - Performance Optimization & Testing`,
    objective: t.task4.objective,
    description: `Project Scope: ${assignedTrack.projectDescription}\n\nTask Objective: ${t.task4.description}`,
    difficulty: t.task4.difficulty as any,
    requirements: t.task4.instructions,
    instructions: t.task4.instructions,
    expectedOutput: t.task4.expectedOutput,
    submissionType: t.task4.submissionType,
    allowedSubmissionTypes: ['text', 'github', 'project_url', 'pdf', 'image', 'file'],
    evaluationRubric: DEFAULT_TASK_RUBRIC,
    passingScore: 70,
    maximumAttempts: 3,
    resources: [
      { title: 'Security Best Practices & OWASP Guidelines', url: 'https://owasp.org' },
      { title: 'Automated Testing Guide', url: 'https://github.com' }
    ],
    isActive: true,
    createdAt: new Date().toISOString()
  });

  // Task 5
  tasks.push({
    id: `${domainId}-task-5`,
    taskId: `${domainId}-task-5`,
    domainId,
    domain: domainId,
    taskNumber: 5,
    title: `Task 5: [${assignedTrack.trackTitle}] - Production Deployment, CI/CD & Video Walkthrough`,
    objective: t.task5.objective,
    description: `Project Scope: ${assignedTrack.projectDescription}\n\nTask Objective: ${t.task5.description}`,
    difficulty: t.task5.difficulty as any,
    requirements: t.task5.instructions,
    instructions: t.task5.instructions,
    expectedOutput: t.task5.expectedOutput,
    submissionType: t.task5.submissionType,
    allowedSubmissionTypes: ['text', 'github', 'project_url', 'pdf', 'image', 'file'],
    evaluationRubric: DEFAULT_TASK_RUBRIC,
    passingScore: 70,
    maximumAttempts: 3,
    resources: [
      { title: 'Production Deployment Best Practices', url: 'https://vercel.com' },
      { title: 'Engineering Documentation Standards', url: 'https://github.com' }
    ],
    isActive: true,
    createdAt: new Date().toISOString()
  });

  return tasks;
}

// Full 20-Task Library Generator across 4 sequential difficulty levels for each domain
export function generateDomainTaskLibrary(domainId: string, domainName: string): ProjectTask[] {
  const library: ProjectTask[] = [];

  const defaultRubric: RubricCriterion[] = [
    { criterion: 'Deliverable Completeness & Specifications', maxMarks: 35 },
    { criterion: 'Code Quality, Clean Architecture & Standards', maxMarks: 25 },
    { criterion: 'Input Validation, Error Handling & Tests', maxMarks: 20 },
    { criterion: 'Documentation, Technical Clarity & Demo', maxMarks: 20 }
  ];

  // LEVEL 1: EASY / BEGINNER (5 Distinct Tasks)
  const easyTasksData = [
    {
      num: 1,
      title: `Level 1 - Task 1: Environment Setup, Official Onboarding & Architecture Scaffolding`,
      obj: `Establish a clean workspace for ${domainName}, review official internship offer letter, and verify community onboarding.`,
      desc: `Initialize your ${domainName} project directory with recommended directory layout, git version control, and dependencies. Review your official VirIntern appointment documentation and complete onboarding verification.`,
      instructions: [
        `Clone or initialize a dedicated git repository with an appropriate .gitignore and license.`,
        `Set up your local or cloud IDE with necessary language linters, formatters, and runtime engines.`,
        `Preview and verify your official VirIntern Internship Appointment Offer Letter.`,
        `Auto-verify your subscription to the official YouTube community (@virintern) and verify your commencement post.`
      ],
      output: `Initialized repository with clean README and confirmed onboarding verification.`,
      duration: `2-4 hours`,
      tools: ['Git', 'VS Code', 'GitHub', 'Terminal']
    },
    {
      num: 2,
      title: `Level 1 - Task 2: Core Data Modeling & Static Interface Scaffolding`,
      obj: `Build the foundational data schemas, type contracts, and static UI/CLI components for ${domainName}.`,
      desc: `Create the core structure of your application. Define strongly typed models, establish clear separation between presentation and data, and ensure responsive layout.`,
      instructions: [
        `Define domain-specific data entities and interfaces representing key entities.`,
        `Scaffold the primary layout views or command-line entry points.`,
        `Implement clean visual styling or formatted terminal output with accessible contrast.`,
        `Commit initial component milestones with descriptive commit messages.`
      ],
      output: `Static prototype displaying domain entities with clean type definitions.`,
      duration: `4-6 hours`,
      tools: ['TypeScript / Python', 'Git', 'Editor', 'Linters']
    },
    {
      num: 3,
      title: `Level 1 - Task 3: Interactive User Input & Form Validation Pipeline`,
      obj: `Implement robust input handling, sanitization, and immediate visual feedback.`,
      desc: `Capture user inputs safely. Build interactive forms or input parsers with validation rules, preventing malformed submissions and displaying clear error messages.`,
      instructions: [
        `Construct input controls for creating and updating ${domainName} records.`,
        `Enforce validation rules (required fields, regex pattern matching, value ranges).`,
        `Provide accessible feedback banners and error indicators next to input fields.`,
        `Test valid and boundary inputs to verify graceful degradation.`
      ],
      output: `Interactive input interface with comprehensive client-side validation.`,
      duration: `4-6 hours`,
      tools: ['Validation Schema (Zod/Regex)', 'Git', 'IDE']
    },
    {
      num: 4,
      title: `Level 1 - Task 4: Responsive Navigation, Filter Bar & Search Index`,
      obj: `Implement multi-criteria filtering, search debouncing, and fluid responsive views.`,
      desc: `Enable users to discover and inspect ${domainName} assets efficiently through search keywords, category chips, and sort order controls.`,
      instructions: [
        `Build a responsive navigation header and drawer menu optimized for mobile and desktop.`,
        `Implement a keyword search input with 300ms debounce to prevent redundant iterations.`,
        `Add multi-attribute filter chips and sorting dropdowns (e.g. by date, name, priority).`,
        `Display friendly empty states when zero items match active filter queries.`
      ],
      output: `Searchable, filterable catalog component with responsive mobile layout.`,
      duration: `4-6 hours`,
      tools: ['CSS / Tailwind', 'TypeScript', 'Git']
    },
    {
      num: 5,
      title: `Level 1 - Task 5: State Persistence & Local Cache Storage Engine`,
      obj: `Preserve application state across session reloads using browser local storage or indexed cache.`,
      desc: `Ensure student progress and configuration settings persist seamlessly when users refresh the browser or restart the process.`,
      instructions: [
        `Implement a state synchronization hook or manager persisting to localStorage/IndexedDB.`,
        `Handle corrupted or legacy cached data schemas with fallback migration defaults.`,
        `Add a clear cache / reset state utility for convenient testing.`,
        `Verify persistent behavior across page refreshes and browser tabs.`
      ],
      output: `Stateful prototype retaining user modifications and drafts after browser refresh.`,
      duration: `4-6 hours`,
      tools: ['LocalStorage / IndexedDB', 'Git', 'Browser DevTools']
    }
  ];

  easyTasksData.forEach((t) => {
    library.push({
      id: `${domainId}-easy-${t.num}`,
      taskId: `${domainId}-easy-${t.num}`,
      domainId,
      domain: domainId,
      taskNumber: t.num as any,
      title: t.title,
      objective: t.obj,
      description: t.desc,
      difficulty: 'Beginner',
      level: 'Easy',
      progressionLevel: 'Level 1 - Easy',
      learningObjectives: [t.obj, 'Git version control hygiene', 'Foundational software design principles'],
      prerequisites: ['Basic programming syntax', 'Command-line familiarity'],
      requiredTools: t.tools,
      requirements: t.instructions,
      instructions: t.instructions,
      expectedOutput: t.output,
      submissionType: 'all',
      allowedSubmissionTypes: ['text', 'github', 'project_url', 'pdf', 'image', 'file'],
      evaluationRubric: DEFAULT_TASK_RUBRIC,
      maximumAttempts: 3,
      estimatedDuration: t.duration,
      passingScore: 70,
      rubricCriteria: defaultRubric,
      resources: [
        { title: `${domainName} Developer Fundamentals`, url: 'https://developer.mozilla.org' },
        { title: 'Clean Architecture Principles', url: 'https://github.com' }
      ],
      isActive: true,
      status: 'published',
      version: '1.0',
      createdAt: new Date().toISOString()
    });
  });

  // LEVEL 2: INTERMEDIATE (5 Distinct Tasks)
  const intermediateTasksData = [
    {
      num: 1,
      title: `Level 2 - Task 1: Asynchronous REST API Ingestion & Dynamic Data Fetching`,
      obj: `Connect your ${domainName} architecture to live asynchronous endpoints with loading and error boundaries.`,
      desc: `Integrate remote data sources. Implement asynchronous request lifecycles, handle HTTP status codes, and display skeleton loading indicators.`,
      instructions: [
        `Configure an HTTP client service with base URLs, timeout guards, and request headers.`,
        `Fetch remote resources asynchronously and populate domain views.`,
        `Design polished skeleton loading cards and informative retry buttons on network failure.`,
        `Implement error boundaries preventing full-app crash during external service outages.`
      ],
      output: `Live asynchronous integration with graceful loading states and retry recovery.`,
      duration: `6-8 hours`,
      tools: ['Fetch / Axios', 'Async/Await', 'Git']
    },
    {
      num: 2,
      title: `Level 2 - Task 2: Multi-Step Interactive Workflow & Stepper Wizard`,
      obj: `Architect an end-to-end multi-step workflow with stage validation and state retention.`,
      desc: `Design a guided user journey (e.g. multi-step order checkout, complex parameter wizard, or diagnostic audit flow) that validates each step before allowing progression.`,
      instructions: [
        `Create a visual progress stepper indicating current, completed, and upcoming stages.`,
        `Enforce step-specific completion checks before enabling the "Next" action.`,
        `Enable bidirectional navigation allowing users to revisit and adjust previous inputs.`,
        `Generate a final review summary displaying all captured parameters prior to submission.`
      ],
      output: `Completed multi-step wizard with validation guards and confirmation review.`,
      duration: `6-8 hours`,
      tools: ['State Management', 'Modular Components', 'Git']
    },
    {
      num: 3,
      title: `Level 2 - Task 3: Relational Data Operations & Dynamic CRUD Actions`,
      obj: `Implement complete Create, Read, Update, and Delete capabilities with optimistic UI feedback.`,
      desc: `Empower users to manage collections of ${domainName} items with instant interface updates, confirmation dialogs, and rollback on error.`,
      instructions: [
        `Build modal dialogs or inline forms for editing existing entity records.`,
        `Implement delete confirmation modals with warning prompts to avoid accidental loss.`,
        `Apply optimistic UI updates rendering edits immediately before backend network confirmation.`,
        `Include toast notifications confirming successful operation completion.`
      ],
      output: `Full CRUD workflow with responsive optimistic UI and confirmation dialogues.`,
      duration: `6-8 hours`,
      tools: ['CRUD APIs', 'Optimistic UI', 'Git']
    },
    {
      num: 4,
      title: `Level 2 - Task 4: Client-Side Authentication Simulation & Role-Based Views`,
      obj: `Implement role-based authorization differentiating Student, Mentor, and Admin interfaces.`,
      desc: `Simulate role-based access control (RBAC). Restrict privileged routes, conditionally render action buttons, and manage authenticated session tokens securely.`,
      instructions: [
        `Implement route guards redirecting unauthorized visitors to a login or forbidden notice.`,
        `Conditionally render management buttons based on current active user role permissions.`,
        `Provide an interactive role switcher previewing views as standard user vs administrator.`,
        `Store authentication tokens safely and purge state completely upon logout.`
      ],
      output: `Role-protected interface with navigation guards and conditional action controls.`,
      duration: `6-8 hours`,
      tools: ['RBAC', 'Context / Store', 'Git']
    },
    {
      num: 5,
      title: `Level 2 - Task 5: Dynamic Export Engine & Printable Document Generator`,
      obj: `Generate downloadable PDF reports, CSV data tables, and print-ready document summaries.`,
      desc: `Enable users to export data summaries from their ${domainName} system into industry-standard PDF or spreadsheet formats.`,
      instructions: [
        `Implement client-side CSV export formatting arrays into comma-separated text blobs.`,
        `Apply print media queries (@media print) formatting a clean printable view without headers/buttons.`,
        `Generate dynamic PDF or printable invoice/record summaries with unique timestamps.`,
        `Test export functionality across Chrome, Firefox, and mobile browsers.`
      ],
      output: `Export utility generating downloadable CSVs and clean print-optimized summaries.`,
      duration: `6-8 hours`,
      tools: ['Canvas / Blob / Print CSS', 'FileSaver', 'Git']
    }
  ];

  intermediateTasksData.forEach((t) => {
    library.push({
      id: `${domainId}-intermediate-${t.num}`,
      taskId: `${domainId}-intermediate-${t.num}`,
      domainId,
      domain: domainId,
      taskNumber: t.num as any,
      title: t.title,
      objective: t.obj,
      description: t.desc,
      difficulty: 'Intermediate',
      level: 'Intermediate',
      progressionLevel: 'Level 2 - Intermediate',
      learningObjectives: [t.obj, 'Asynchronous state management', 'Component modularity & RBAC'],
      prerequisites: ['Level 1 completion', 'DOM / Async event loop understanding'],
      requiredTools: t.tools,
      requirements: t.instructions,
      instructions: t.instructions,
      expectedOutput: t.output,
      submissionType: 'all',
      allowedSubmissionTypes: ['text', 'github', 'project_url', 'pdf', 'image', 'file'],
      evaluationRubric: DEFAULT_TASK_RUBRIC,
      maximumAttempts: 3,
      estimatedDuration: t.duration,
      passingScore: 70,
      rubricCriteria: defaultRubric,
      resources: [
        { title: 'Asynchronous Programming Patterns', url: 'https://javascript.info' },
        { title: 'RESTful API Design Standards', url: 'https://restfulapi.net' }
      ],
      isActive: true,
      status: 'published',
      version: '1.0',
      createdAt: new Date().toISOString()
    });
  });

  // LEVEL 3: HARD / ADVANCED APPLICATION (5 Distinct Tasks)
  const hardTasksData = [
    {
      num: 1,
      title: `Level 3 - Task 1: Real-Time Telemetry, Event Bus & WebSocket Live Streaming`,
      obj: `Incorporate bi-directional real-time communication for live status updates and event broadcasts.`,
      desc: `Upgrade the ${domainName} architecture to handle instantaneous data broadcasts. Connect live event streams, maintain connection recovery, and visualize live metric changes.`,
      instructions: [
        `Set up a real-time subscriber (WebSocket / Server-Sent Events / BroadcastChannel).`,
        `Implement automatic reconnect back-off logic when connectivity is temporarily lost.`,
        `Render live pulse indicators and dynamic chart / telemetry animations upon receiving payloads.`,
        `Throttle or buffer high-frequency event spikes to maintain 60fps UI responsiveness.`
      ],
      output: `Real-time live telemetry dashboard reacting to external events with zero page reload.`,
      duration: `8-12 hours`,
      tools: ['WebSockets / SSE', 'BroadcastChannel', 'Git']
    },
    {
      num: 2,
      title: `Level 3 - Task 2: Security Hardening, Input Sanitization & OWASP Compliance Audit`,
      obj: `Harden system against common vulnerabilities (XSS, CSRF, Injection) and conduct a security audit.`,
      desc: `Inspect and secure all attack surfaces. Sanitize dynamic user content, implement strict Content Security Policy directives, and enforce token expiration policies.`,
      instructions: [
        `Sanitize rich text and external URLs using DOMPurify or equivalent sanitization libraries.`,
        `Implement defense-in-depth protection against cross-site scripting (XSS) and injection attacks.`,
        `Store sensitive authentication secrets exclusively in environment variables, never source code.`,
        `Document a security review checklist detailing mitigations implemented across the project.`
      ],
      output: `Security-hardened codebase with zero vulnerable dependencies and security checklist.`,
      duration: `8-12 hours`,
      tools: ['DOMPurify / OWASP ZAP', 'Security Linters', 'Git']
    },
    {
      num: 3,
      title: `Level 3 - Task 3: Performance Profiling, Memory Optimization & Algorithmic Tuning`,
      obj: `Profile execution bottlenecks, eliminate redundant computations, and optimize resource footprints.`,
      desc: `Conduct diagnostic performance audits using browser profilers or memory snapshots. Apply memoization, virtualization for large lists, and debounced operations to achieve peak speed.`,
      instructions: [
        `Profile application runtime using Chrome DevTools Performance or Node.js inspect profiler.`,
        `Implement virtualized scrolling for lists containing hundreds of items.`,
        `Optimize high-complexity algorithmic routines (e.g. reducing O(N²) iterations to O(N log N)).`,
        `Benchmark Core Web Vitals (LCP, CLS, INP) achieving high Lighthouse or benchmark metrics.`
      ],
      output: `Documented performance report with before-and-after benchmarks and 90+ Lighthouse score.`,
      duration: `8-12 hours`,
      tools: ['Chrome DevTools Profiler', 'Lighthouse', 'Git']
    },
    {
      num: 4,
      title: `Level 3 - Task 4: Automated Testing Suite (Unit, Integration & E2E Verification)`,
      obj: `Write a robust test suite covering critical business logic and user interaction flows with 80%+ coverage.`,
      desc: `Guarantee code reliability through automated tests. Construct unit tests for core utilities, integration tests for API services, and end-to-end user workflow simulations.`,
      instructions: [
        `Configure test runner (Vitest / Jest / Pytest) with coverage reporters.`,
        `Write comprehensive unit tests covering pure business functions and edge-case boundary values.`,
        `Simulate user interaction flows testing asynchronous state updates and form validation errors.`,
        `Achieve at least 80% statement coverage across primary service modules.`
      ],
      output: `Passing automated test suite with generated code coverage report.`,
      duration: `8-12 hours`,
      tools: ['Vitest / Jest / Pytest', 'Testing Library', 'Git']
    },
    {
      num: 5,
      title: `Level 3 - Task 5: Microservice Architecture & Modular Service Separation`,
      obj: `Refactor monolithic code into decoupled, domain-driven service modules with clear interfaces.`,
      desc: `Structure enterprise-grade architecture. Decompose tightly coupled files into autonomous services with clean dependency injection, dedicated repositories, and shared utilities.`,
      instructions: [
        `Organize codebase according to Clean Architecture / Domain-Driven Design (DDD) layers.`,
        `Isolate business domain logic from framework-specific rendering libraries.`,
        `Create a unified dependency injection or service locator pattern for easy mocking and testing.`,
        `Document system interaction flows using a clear C4 or component diagram in the repository.`
      ],
      output: `Decoupled multi-tier codebase accompanied by architectural component diagram.`,
      duration: `8-12 hours`,
      tools: ['Clean Architecture', 'Mermaid.js / C4', 'Git']
    }
  ];

  hardTasksData.forEach((t) => {
    library.push({
      id: `${domainId}-hard-${t.num}`,
      taskId: `${domainId}-hard-${t.num}`,
      domainId,
      domain: domainId,
      taskNumber: t.num as any,
      title: t.title,
      objective: t.obj,
      description: t.desc,
      difficulty: 'Advanced',
      level: 'Hard',
      progressionLevel: 'Level 3 - Hard',
      learningObjectives: [t.obj, 'System security & performance tuning', 'Automated testing and architecture design'],
      prerequisites: ['Level 2 completion', 'Software testing & algorithmic fundamentals'],
      requiredTools: t.tools,
      requirements: t.instructions,
      instructions: t.instructions,
      expectedOutput: t.output,
      submissionType: 'all',
      allowedSubmissionTypes: ['text', 'github', 'project_url', 'pdf', 'image', 'file'],
      evaluationRubric: DEFAULT_TASK_RUBRIC,
      maximumAttempts: 3,
      estimatedDuration: t.duration,
      passingScore: 70,
      rubricCriteria: defaultRubric,
      resources: [
        { title: 'OWASP Security Guidelines', url: 'https://owasp.org' },
        { title: 'Web Performance & Profiling Deep-Dive', url: 'https://web.dev' }
      ],
      isActive: true,
      status: 'published',
      version: '1.0',
      createdAt: new Date().toISOString()
    });
  });

  // LEVEL 4: ADVANCED / CAPSTONE PROJECT (5 Distinct Tasks including Capstone)
  const advancedTasksData = [
    {
      num: 1,
      title: `Level 4 - Task 1: Containerization with Docker & Multi-Stage Production Builds`,
      obj: `Package your ${domainName} solution into lightweight, secure container images for cloud deployment.`,
      desc: `Prepare your system for cloud-native infrastructure. Write production Dockerfiles using multi-stage builds to minimize image size and configure docker-compose orchestration.`,
      instructions: [
        `Write a multi-stage Dockerfile separating build dependencies from the final minimal runtime image.`,
        `Create a docker-compose.yml orchestrating application services with environment variable injection.`,
        `Implement container healthcheck instructions verifying container uptime automatically.`,
        `Verify container builds locally and test execution in isolated container runtime.`
      ],
      output: `Verified Dockerfile and docker-compose configuration producing minimal secure image.`,
      duration: `10-14 hours`,
      tools: ['Docker', 'Docker Compose', 'Git']
    },
    {
      num: 2,
      title: `Level 4 - Task 2: Continuous Integration & Automated Cloud Deployment Pipeline (CI/CD)`,
      obj: `Automate build verification, linting, test suites, and public cloud deployment on every git push.`,
      desc: `Simulate high-velocity software engineering practices. Build automated GitHub Actions or cloud build pipelines that test, build, and deploy changes to live production.`,
      instructions: [
        `Create workflow configuration (.github/workflows/deploy.yml) triggered on main branch pushes.`,
        `Execute automated lint checks, TypeScript verification, and test suites within runner jobs.`,
        `Deploy passing builds to a live cloud host (e.g. Google Cloud Run, Vercel, Netlify, or Render).`,
        `Add automated build status badge to your repository README.md.`
      ],
      output: `Live public URL with green CI/CD pipeline build badge in GitHub repository.`,
      duration: `10-14 hours`,
      tools: ['GitHub Actions', 'Cloud Hosting', 'Git']
    },
    {
      num: 3,
      title: `Level 4 - Task 3: Production Observability, Structured Logging & Healthcheck Telemetry`,
      obj: `Implement centralized structured logging, error tracking telemetry, and service health endpoints.`,
      desc: `Ensure production readiness. Expose standardized healthcheck endpoints, integrate runtime exception capture, and maintain audit logs of critical user operations.`,
      instructions: [
        `Expose a /healthz or /api/health endpoint reporting service uptime, memory usage, and status.`,
        `Format all application logs as structured JSON containing timestamp, severity, and request ID.`,
        `Implement client-side exception capture capturing unhandled promise rejections.`,
        `Document diagnostic runbooks for troubleshooting common runtime alerts.`
      ],
      output: `Live healthcheck endpoint and structured logging telemetry documented in project manual.`,
      duration: `10-14 hours`,
      tools: ['Telemetry / Healthcheck', 'JSON Logging', 'Git']
    },
    {
      num: 4,
      title: `Level 4 - Task 4: High-Concurrency Stress Testing & Disaster Recovery Plan`,
      obj: `Simulate heavy concurrent load, identify breaking points, and formulate a disaster recovery plan.`,
      desc: `Test the limits of your ${domainName} architecture. Run simulated stress tests, analyze error rates under peak traffic, and draft a business continuity protocol.`,
      instructions: [
        `Perform synthetic load tests using tools like Autocannon, k6, or Artillery.`,
        `Measure response latency percentiles (p50, p95, p99) under escalating concurrent requests.`,
        `Identify system bottlenecks (database connection limits, CPU throttling, memory spikes).`,
        `Formulate a disaster recovery runbook detailing backup procedures and recovery time objectives (RTO).`
      ],
      output: `Load testing report with latency charts and documented disaster recovery runbook.`,
      duration: `10-14 hours`,
      tools: ['k6 / Autocannon', 'Load Testing', 'Git']
    },
    {
      num: 5,
      title: `Level 4 - Task 5: Flagship Integrated Capstone Solution & Video Demonstration`,
      obj: `Deliver your comprehensive flagship ${domainName} capstone project with public URL and video walkthrough.`,
      desc: `Synthesize everything learned across all four levels into a polished, production-grade flagship capstone. Includes comprehensive case study, live public URL, architecture diagrams, and video walkthrough.`,
      instructions: [
        `Deliver the finalized flagship capstone application fulfilling all ${domainName} enterprise specifications.`,
        `Deploy the application publicly and confirm live functionality across multiple devices.`,
        `Draft an exhaustive README.md detailing problem statement, technical stack, architecture, and instructions.`,
        `Record a concise 2-4 minute video presentation demonstrating core features and architectural decisions.`
      ],
      output: `Live production URL, public GitHub repository with comprehensive README, and video demonstration link.`,
      duration: `14-20 hours`,
      tools: ['Full Production Stack', 'Loom / Video Recording', 'Git']
    }
  ];

  advancedTasksData.forEach((t) => {
    library.push({
      id: `${domainId}-advanced-${t.num}`,
      taskId: `${domainId}-advanced-${t.num}`,
      domainId,
      domain: domainId,
      taskNumber: t.num as any,
      title: t.title,
      objective: t.obj,
      description: t.desc,
      difficulty: 'Advanced',
      level: 'Advanced',
      progressionLevel: 'Level 4 - Capstone',
      learningObjectives: [t.obj, 'Cloud-native deployment & CI/CD', 'Flagship portfolio presentation'],
      prerequisites: ['Level 3 completion', 'Full-stack engineering lifecycle mastery'],
      requiredTools: t.tools,
      requirements: t.instructions,
      instructions: t.instructions,
      expectedOutput: t.output,
      submissionType: 'all',
      allowedSubmissionTypes: ['text', 'github', 'project_url', 'pdf', 'image', 'file'],
      evaluationRubric: DEFAULT_TASK_RUBRIC,
      maximumAttempts: 3,
      estimatedDuration: t.duration,
      passingScore: 70,
      rubricCriteria: defaultRubric,
      resources: [
        { title: 'The Twelve-Factor App Methodology', url: 'https://12factor.net' },
        { title: 'Production Deployment & Cloud Guidelines', url: 'https://cloud.google.com' }
      ],
      isActive: true,
      status: 'published',
      version: '1.0',
      createdAt: new Date().toISOString()
    });
  });

  return library;
}

