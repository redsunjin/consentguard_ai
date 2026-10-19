/**
 * Popup UI Controller (popup/index.ts)
 * IndexedDB 동의 보관함(Vault) 목록 렌더링 및 개인정보보호법 제37조 철회 서식 원클릭 생성/복사
 */

import { deleteVaultRecord, listVaultRecords } from '../utils/vault-db';
import type { VaultRecord } from '@consent-guard/shared-schema';

function buildRevokeText(record: VaultRecord): string {
  const today = new Date().toISOString().split('T')[0];
  const targets =
    record.consentedOptionals.length > 0
      ? record.consentedOptionals.map((t) => `   - ${t}`).join('\n')
      : '   - 개인정보 제3자 제공 및 마케팅 수신 동의 일체';

  return [
    `수신: ${record.serviceName} (${record.domain}) 개인정보보호책임자`,
    `제목: [개인정보보호법 제37조] 개인정보 제3자 제공 및 마케팅 동의 철회 요청`,
    ``,
    `본인은 개인정보보호법 제37조(개인정보의 처리정지 등)에 의거하여 귀사 서비스 가입 시 동의한 아래 선택 항목에 대한 동의를 철회하며 즉각적인 파기를 요청합니다.`,
    ``,
    `1. 철회 대상 항목:`,
    targets,
    `2. 요청 일자: ${today}`,
    `3. 요청 근거: 개인정보보호법 제37조 제1항`,
  ].join('\n');
}

export async function renderPopupVault(): Promise<void> {
  const root = document.getElementById('vault-root');
  const revokeBox = document.getElementById('revoke-output');
  if (!root) return;

  try {
    const records = await listVaultRecords();
    if (records.length === 0) {
      root.innerHTML = `<div style="padding:16px 0;text-align:center;color:#64748b;">보관된 동의 이력이 없습니다.</div>`;
      return;
    }

    root.innerHTML = records
      .map(
        (rec) => `
        <div class="record-card" data-id="${rec.id}">
          <div class="record-header">
            <strong>${rec.serviceName}</strong>
            <span style="font-size:10px;color:#94a3b8;">${rec.consentedAt.slice(0, 10)} (${rec.overallRiskLevel})</span>
          </div>
          <div style="font-size:11px;color:#94a3b8;">
            차단된 선택 항목: ${rec.rejectedOptionals.length}건
          </div>
          <div class="btn-row">
            <button class="btn btn-revoke" data-revoke-id="${rec.id}">📋 제37조 철회서 복사</button>
            <button class="btn btn-delete" data-delete-id="${rec.id}">삭제</button>
          </div>
        </div>
      `
      )
      .join('');

    root.querySelectorAll<HTMLButtonElement>('[data-revoke-id]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const targetId = btn.dataset.revokeId;
        const found = records.find((r) => r.id === targetId);
        if (!found || !revokeBox) return;

        const text = buildRevokeText(found);
        revokeBox.style.display = 'block';
        revokeBox.textContent = text;
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        }
        btn.textContent = '✅ 클립보드 복사됨!';
      });
    });

    root.querySelectorAll<HTMLButtonElement>('[data-delete-id]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const targetId = btn.dataset.deleteId;
        if (!targetId) return;
        await deleteVaultRecord(targetId);
        await renderPopupVault();
      });
    });
  } catch {
    root.innerHTML = `<div style="color:#f87171;">IndexedDB 보관함을 불러올 수 없습니다.</div>`;
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    void renderPopupVault();
  });
}
