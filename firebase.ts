import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  initializeFirestore,
  memoryLocalCache,
  setLogLevel,
  doc,
  getDocFromServer
} from 'firebase/firestore';
import { firebaseConfig } from './config';

// Silence Firestore internal offline connection warnings in preview/restricted sandbox environments
try {
  setLogLevel('silent');
} catch (e) {
  // Ignore
}

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

// Initialize Firestore with memoryLocalCache to avoid sandboxed iframe IndexedDB errors
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  localCache: memoryLocalCache()
});

export const googleProvider = new GoogleAuthProvider();

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'settings', 'global'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
if (typeof window !== 'undefined') {
  testConnection();
}

export default app;
