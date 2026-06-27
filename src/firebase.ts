/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from "firebase/app";

// Initialize standard Firebase client for any secondary requirements
const firebaseConfig = {
  projectId: "striking-grid-dwrl4",
  appId: "1:87224077387:web:9f06a829b442482648d1ce",
  apiKey: "AIzaSyBL_2NqF6V3GmxqNq26x1aWJGAxg71qkSg",
  authDomain: "striking-grid-dwrl4.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-planz-f0310597-7e0a-4339-96c9-02612d992a1c",
  storageBucket: "striking-grid-dwrl4.firebasestorage.app",
  messagingSenderId: "87224077387"
};

export const app = initializeApp(firebaseConfig);

// Proxy reference for Database and Auth
export const db = { isProxy: true };
export const auth = { isProxy: true };
export const getAuth = () => auth;

// Dummy auth methods
export const signInWithEmailAndPassword = async (authObj: any, email: string, pass: string) => {
  return { user: { uid: "dummy-uid" } };
};

// Firestore Proxies
export const collection = (dbObj: any, path: string) => {
  return { path };
};

export const doc = (dbObj: any, path: string, id: string) => {
  return { path, id };
};

export const query = (col: any, ...constraints: any[]) => {
  return { path: col.path, constraints };
};

export const where = (field: string, op: string, value: any) => {
  return { type: "where", field, op, value };
};

// Generic AJAX/fetch helper for APIs
async function apiRequest(method: string, url: string, body?: any) {
  const token = localStorage.getItem("planz_jwt");
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const options: RequestInit = {
    method,
    headers,
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(errData.error || `HTTP error ${res.status}`);
  }
  return res.json().catch(() => ({}));
}

export const getDocs = async (q: any) => {
  const path = q.path;
  const items = await apiRequest("GET", `/api/db/${path}`);
  
  return {
    forEach: (callback: (doc: any) => void) => {
      items.forEach((item: any) => {
        callback({
          id: item.id,
          data: () => item
        });
      });
    }
  };
};

export const addDoc = async (col: any, data: any) => {
  const path = col.path;
  const result = await apiRequest("POST", `/api/db/${path}`, data);
  return { id: result.id };
};

export const setDoc = async (docRef: any, data: any) => {
  const { path, id } = docRef;
  await apiRequest("PUT", `/api/db/${path}/${id}`, data);
};

export const updateDoc = async (docRef: any, data: any) => {
  const { path, id } = docRef;
  await apiRequest("PATCH", `/api/db/${path}/${id}`, data);
};

export const deleteDoc = async (docRef: any) => {
  const { path, id } = docRef;
  await apiRequest("DELETE", `/api/db/${path}/${id}`);
};
