import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { UserReport } from './types.js';

const dataPath = resolve(process.cwd(), 'server/data/reports.json');
const seedPath = resolve(process.cwd(), 'server/data/reports.seed.json');

function ensureDataFile(): void {
  if (!existsSync(dirname(dataPath))) {
    mkdirSync(dirname(dataPath), { recursive: true });
  }

  if (!existsSync(dataPath)) {
    copyFileSync(seedPath, dataPath);
  }
}

export function readReports(): UserReport[] {
  ensureDataFile();

  try {
    const raw = readFileSync(dataPath, 'utf-8');
    const parsed = JSON.parse(raw) as UserReport[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeReports(reports: UserReport[]): void {
  ensureDataFile();
  writeFileSync(dataPath, JSON.stringify(reports, null, 2), 'utf-8');
}
