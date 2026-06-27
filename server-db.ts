import fs from "fs";
import path from "path";

const DB_FILE = path.join(process.cwd(), "planz_db.json");

interface LocalDbSchema {
  users: any[];
  tasks: any[];
  habits: any[];
  feedback: any[];
}

function loadDb(): LocalDbSchema {
  if (!fs.existsSync(DB_FILE)) {
    const initial = { users: [], tasks: [], habits: [], feedback: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  } catch (err) {
    console.error("Failed to parse planz_db.json, recreating empty db:", err);
    return { users: [], tasks: [], habits: [], feedback: [] };
  }
}

function saveDb(data: LocalDbSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write to planz_db.json:", err);
  }
}

export const localDb = {
  getCollection(name: "users" | "tasks" | "habits" | "feedback") {
    const db = loadDb();
    return db[name] || [];
  },

  getItem(name: "users" | "tasks" | "habits" | "feedback", id: string) {
    const db = loadDb();
    return (db[name] || []).find((item: any) => item.id === id);
  },

  insertItem(name: "users" | "tasks" | "habits" | "feedback", item: any) {
    const db = loadDb();
    if (!db[name]) db[name] = [];
    const newItem = { ...item, id: item.id || Math.random().toString(36).substring(2, 11) };
    db[name].push(newItem);
    saveDb(db);
    return newItem;
  },

  updateItem(name: "users" | "tasks" | "habits" | "feedback", id: string, data: any) {
    const db = loadDb();
    if (!db[name]) db[name] = [];
    const index = db[name].findIndex((item: any) => item.id === id);
    if (index !== -1) {
      db[name][index] = { ...db[name][index], ...data, id };
      saveDb(db);
      return db[name][index];
    }
    return null;
  },

  deleteItem(name: "users" | "tasks" | "habits" | "feedback", id: string) {
    const db = loadDb();
    if (!db[name]) db[name] = [];
    const initialLength = db[name].length;
    db[name] = db[name].filter((item: any) => item.id !== id);
    if (db[name].length !== initialLength) {
      saveDb(db);
      return true;
    }
    return false;
  }
};
