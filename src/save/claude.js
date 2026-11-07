// claude.ai hosting: when the game runs as a published Artifact, saves go to the artifact's
// database under the player's own private path, and the world market is a shared collection.

export const inClaude = () => typeof window !== 'undefined' && !!window.claude && typeof window.claude.use === 'function';

let backend = null;

// Resolves { db, user, uid, ok }. `ok` = this viewer can keep an online save.
export async function claudeBackend() {
  if (backend) return backend;
  if (!inClaude()) return (backend = { ok: false });
  const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
  const uid = user ? await user.id() : null;
  backend = { db, user, uid, ok: !!(db && uid) };
  return backend;
}

export function saveDoc(b) {
  return b.db.doc(`data/users/${b.uid}/save`);
}

export async function downloadsApi() {
  if (!inClaude()) return null;
  try { return await window.claude.use('downloads'); } catch { return null; }
}
