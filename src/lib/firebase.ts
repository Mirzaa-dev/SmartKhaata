import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// @ts-ignore
import firebaseConfigData from '../../firebase-applet-config.json';

const firebaseConfig = firebaseConfigData || {};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// @ts-ignore
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

export default app;
