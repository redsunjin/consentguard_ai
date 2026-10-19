/**
 * F-04. 로컬 동의 보관함 (vault-db.ts)
 * 브라우저 내장 IndexedDB를 사용하여 가입 시점의 동의 이력을 온디바이스에만 저장
 */

import type { VaultRecord } from '@consent-guard/shared-schema';

const DB_NAME = 'ConsentGuardVaultDB';
const DB_VERSION = 1;
const STORE_NAME = 'consent_records';

function openVaultDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('domain', 'domain', { unique: false });
        store.createIndex('consentedAt', 'consentedAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveVaultRecord(record: VaultRecord): Promise<void> {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listVaultRecords(): Promise<VaultRecord[]> {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as VaultRecord[]);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteVaultRecord(id: string): Promise<void> {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
