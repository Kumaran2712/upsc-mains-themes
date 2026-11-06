import { auth, api, ensureAuth, acceptSession, signOut, accountDeleted, type AuthState, type Usage } from './api';

export function initialiseAccount() {
  const root = document.querySelector<HTMLElement>('[data-account]'); if (!root) return;
  const find = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const dialog = find<HTMLDialogElement>('[data-account-dialog]');
  const form = find<HTMLFormElement>('[data-account-form]');
  const password = form.elements.namedItem('password') as HTMLInputElement;
  const recovery = form.elements.namedItem('recoveryCode') as HTMLInputElement;
  const message = find<HTMLElement>('[data-auth-message]');
  const outerMessage = find<HTMLElement>('[data-account-message]');
  let mode: 'login' | 'signup' | 'recover' = 'login', busy = false;
  function setMode(value: typeof mode) {
    mode = value; message.textContent = '';
    find<HTMLElement>('[data-recovery-field]').hidden = value !== 'recover'; recovery.required = value === 'recover';
    find<HTMLElement>('[data-password-label]').textContent = value === 'recover' ? 'New password' : 'Password';
    password.autocomplete = value === 'login' ? 'current-password' : 'new-password';
    find<HTMLButtonElement>('[data-auth-submit]').textContent = value === 'login' ? 'Sign in' : value === 'signup' ? 'Create free account' : 'Reset password';
    root!.querySelectorAll<HTMLButtonElement>('[data-auth-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.authMode === value)));
  }
  root.querySelectorAll<HTMLButtonElement>('[data-auth-mode]').forEach((b) => b.addEventListener('click', () => { if (!busy) setMode(b.dataset.authMode as typeof mode); }));
  function open() {
    if (dialog.open) return;
    find<HTMLElement>('[data-auth-fields]').hidden = false; find<HTMLElement>('[data-recovery-result]').hidden = true;
    message.textContent = ''; dialog.showModal();
  }
  find<HTMLButtonElement>('[data-account-open]').addEventListener('click', open);
  window.addEventListener('stage0-sign-in', open);
  find<HTMLButtonElement>('[data-account-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { password.value = ''; recovery.value = ''; find<HTMLInputElement>('[data-recovery-code]').value = ''; });
  function render() {
    find<HTMLButtonElement>('[data-account-open]').hidden = Boolean(auth.user);
    find<HTMLButtonElement>('[data-account-open]').disabled = !auth.loaded || !auth.reachable;
    find<HTMLButtonElement>('[data-account-logout]').hidden = !auth.user;
    find<HTMLElement>('[data-account-manage]').hidden = !auth.user;
    find<HTMLElement>('[data-account-label]').textContent = !auth.loaded ? 'Connecting to your learning account…' : !auth.reachable ? 'The learning service is unavailable. The free concepts and prompts are still here.' : auth.user ? `Learning as ${auth.user.username}` : 'Sign in to save progress and use the free tutor.';
    find<HTMLElement>('[data-account-usage]').textContent = !auth.ready && auth.loaded && auth.reachable ? 'Live AI is not activated yet. You can save concepts to revisit.' : auth.user && auth.usage ? `${auth.usage.remaining} of ${auth.usage.limit} free tutor attempts left today · replies and check answers share this allowance · resets at midnight IST` : '';
    if (!auth.user) { const deletion = find<HTMLFormElement>('[data-account-delete]'); deletion.reset(); }
  }
  window.addEventListener('stage0-auth', render); window.addEventListener('stage0-live-progress', render); render();
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (busy || !form.reportValidity()) return; busy = true;
    const button = find<HTMLButtonElement>('[data-auth-submit]'); button.disabled = true; message.textContent = 'Working…';
    try {
      const data = new FormData(form);
      const result = await api<{ user: AuthState['user']; csrf: string; usage: Usage; recoveryCode?: string }>(`/auth/${mode}`, { username: data.get('username'), password: data.get('password'), recoveryCode: data.get('recoveryCode') });
      password.value = ''; recovery.value = ''; acceptSession(result);
      if (result.recoveryCode) {
        find<HTMLElement>('[data-auth-fields]').hidden = true; find<HTMLElement>('[data-recovery-result]').hidden = false;
        find<HTMLInputElement>('[data-recovery-code]').value = result.recoveryCode;
        message.textContent = 'Account ready. Save your recovery code before closing this dialog.';
      } else { dialog.close(); outerMessage.textContent = 'Signed in. Your account progress is ready.'; }
    } catch (error) { message.textContent = (error as Error).message; }
    finally { busy = false; button.disabled = false; }
  });
  find<HTMLButtonElement>('[data-copy-recovery]').addEventListener('click', async () => {
    const field = find<HTMLInputElement>('[data-recovery-code]');
    try { await navigator.clipboard.writeText(field.value); message.textContent = 'Recovery code copied. Save it somewhere private.'; }
    catch { field.focus(); field.select(); message.textContent = 'Code selected. Use your device’s Copy command.'; }
  });
  find<HTMLButtonElement>('[data-account-logout]').addEventListener('click', async () => {
    try { await signOut(); outerMessage.textContent = 'Signed out. Your saved learning data stays in your account.'; }
    catch (error) { outerMessage.textContent = (error as Error).message; }
  });
  find<HTMLButtonElement>('[data-account-export]').addEventListener('click', async () => {
    try {
      const data = await api('/account/export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'my-stage0-learning.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { outerMessage.textContent = (error as Error).message; }
  });
  find<HTMLFormElement>('[data-account-delete]').addEventListener('submit', async (event) => {
    event.preventDefault(); const deletion = event.currentTarget as HTMLFormElement;
    if (busy || !deletion.reportValidity()) return; busy = true;
    const button = deletion.querySelector<HTMLButtonElement>('button')!; button.disabled = true;
    try {
      await api('/account/delete', { password: new FormData(deletion).get('password') });
      deletion.reset(); accountDeleted(); outerMessage.textContent = 'Your account and learning data have been deleted.';
    } catch (error) { outerMessage.textContent = (error as Error).message; }
    finally { busy = false; button.disabled = false; }
  });
  void ensureAuth();
}
