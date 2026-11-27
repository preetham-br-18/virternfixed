export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBpyARaUpuo1xVM0LUESV7gLsg0xdkmP-s",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "virintern-daa89.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "virintern-daa89",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "virintern-daa89.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "798231047358",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:798231047358:web:8295d39f9260f19d9d02ef",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-HLQTJJR1DN"
};

export const YOUTUBE_CONFIG = {
  apiKey: import.meta.env.VITE_YOUTUBE_API_KEY || "AIzaSyCMPkpZgelu7Fz0iEbRuvh0wBnvM7mKAkg",
  clientId: import.meta.env.VITE_YOUTUBE_CLIENT_ID || "618723640587-stk6jd1mj942hilcet9ucgjs51s06tta.apps.googleusercontent.com",
  channelId: import.meta.env.VITE_YOUTUBE_CHANNEL_ID || "UCsh6bRKoIQs0IO-o9EcOsmw",
  channelHandle: "@virintern",
  channelName: "VirIntern",
  channelUrl: "https://youtube.com/@virintern?sub_confirmation=1"
};

export const ADMIN_EMAILS = [
  "preethamirl@gmail.com",
  "preethu1845@gmail.com"
];

export const DEFAULT_ADMIN_EMAIL = "preethamirl@gmail.com";
export const ADMIN_UID = "fEzJGHdgeASWWwE86wkUqhJ2Vs92";

export const isAuthorizedAdmin = (uid?: string | null, email?: string | null): boolean => {
  // Authorized admin UID or any designated admin email
  if (uid && uid === ADMIN_UID) return true;
  if (email) {
    const clean = email.toLowerCase().trim();
    if (ADMIN_EMAILS.some(e => e.toLowerCase() === clean)) {
      return true;
    }
  }
  return false;
};
