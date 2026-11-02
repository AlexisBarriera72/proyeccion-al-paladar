// Where the reservation sheet keeps a session's draft and receipt in this tab's storage. Shared
// by the session page (which loads first) and the sheet (loaded on demand).
import {readJson} from '../lib/storage.ts';

export const draftKey = (sessionId: string) => `pap-draft:${sessionId}`;
export const receiptKey = (sessionId: string) => `pap-receipt:${sessionId}`;

/** This tab holds a receipt for the session: its private link must stay reachable. */
export const hasReceipt = (sessionId: string) => readJson('session', receiptKey(sessionId)) !== null;
