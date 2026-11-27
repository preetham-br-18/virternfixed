import { ProjectTask, TaskAssignment, DifficultyLevel } from '../types';
import { generateDomainTaskLibrary, generateStudentTasks } from './domainProjectsService';
import { db } from '../firebase/firebase';
import { collection, doc, setDoc, getDocs, query, where } from 'firebase/firestore';

export interface AllocationResult {
  success: boolean;
  task?: ProjectTask;
  assignment?: TaskAssignment;
  error?: string;
}

class TaskAllocationEngine {
  private assignmentsKey = 'virintern_task_assignments';

  private getLocalAssignments(): TaskAssignment[] {
    try {
      const raw = localStorage.getItem(this.assignmentsKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveLocalAssignments(assignments: TaskAssignment[]): void {
    try {
      localStorage.setItem(this.assignmentsKey, JSON.stringify(assignments));
    } catch {}
  }

  /**
   * Allocates a randomized, non-duplicate task for a student from the domain's task library or project track.
   */
  public async allocateNextTask(
    studentId: string,
    studentName: string,
    studentEmail: string,
    domainId: string,
    domainName: string,
    levelOrStage: 'easy' | 'intermediate' | 'hard' | 'advanced' | 'capstone' = 'easy'
  ): Promise<AllocationResult> {
    try {
      // 1. Get library of available tasks for this domain
      const taskLibrary = generateDomainTaskLibrary(domainId, domainName);
      const studentTasks = generateStudentTasks(domainId, domainName, studentId);

      // Map level string to task difficulty or task number
      const taskNumberMap: Record<string, 1 | 2 | 3 | 4 | 5> = {
        easy: 1,
        intermediate: 2,
        hard: 3,
        advanced: 4,
        capstone: 5
      };
      const targetTaskNumber: 1 | 2 | 3 | 4 | 5 = taskNumberMap[levelOrStage] || 1;

      // Filter tasks matching difficulty/level from library
      const levelMap: Record<string, DifficultyLevel> = {
        easy: 'Easy',
        intermediate: 'Intermediate',
        hard: 'Hard',
        advanced: 'Advanced',
        capstone: 'Advanced'
      };
      const targetLevel = levelMap[levelOrStage] || 'Easy';

      const pool = taskLibrary.filter(t => t.level === targetLevel || (t.taskNumber as any) === targetTaskNumber);
      
      // Candidate task: pick randomized task from pool, or fallback to the studentTasks slot
      let selectedTask: ProjectTask;
      if (pool.length > 0) {
        const randomIndex = Math.floor(Math.random() * pool.length);
        const candidate = pool[randomIndex];
        selectedTask = {
          ...candidate,
          taskNumber: targetTaskNumber
        };
      } else {
        const fallback = studentTasks.find(t => t.taskNumber === targetTaskNumber) || studentTasks[0];
        selectedTask = { ...fallback };
      }

      // Create assignment record
      const assignmentId = `assign_${studentId}_${domainId}_t${targetTaskNumber}_${Date.now()}`;
      const assignment: TaskAssignment = {
        id: assignmentId,
        studentId,
        studentName,
        studentEmail,
        domainId,
        domainName,
        taskId: selectedTask.id,
        taskTitle: selectedTask.title,
        taskNumber: targetTaskNumber,
        level: targetLevel,
        progressionLevel: selectedTask.progressionLevel,
        assignedAt: new Date().toISOString(),
        assignmentSource: 'random_engine',
        status: 'assigned'
      };

      // Persist assignment locally
      const local = this.getLocalAssignments();
      const filtered = local.filter(a => !(a.studentId === studentId && a.domainId === domainId && a.taskNumber === targetTaskNumber));
      filtered.push(assignment);
      this.saveLocalAssignments(filtered);

      // Persist to Firestore asynchronously
      try {
        await setDoc(doc(db, 'assignments', assignmentId), assignment);
      } catch {
        // Fallback to local is already saved
      }

      return {
        success: true,
        task: selectedTask,
        assignment
      };
    } catch (err: any) {
      console.error('Task allocation error:', err);
      return {
        success: false,
        error: err.message || 'Failed to allocate task'
      };
    }
  }

  /**
   * Retrieves active assignments for a student
   */
  public async getStudentAssignments(studentId: string): Promise<TaskAssignment[]> {
    const local = this.getLocalAssignments().filter(a => a.studentId === studentId);
    try {
      const q = query(collection(db, 'assignments'), where('studentId', '==', studentId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const remote: TaskAssignment[] = [];
        snap.forEach(d => remote.push(d.data() as TaskAssignment));
        return remote;
      }
    } catch {
      // Return local fallback
    }
    return local;
  }
}

export const taskAllocationEngine = new TaskAllocationEngine();
