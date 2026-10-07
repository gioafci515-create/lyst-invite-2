"use client";

import { useActionState } from "react";
import { login } from "../actions";
import styles from "../admin.module.css";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <main className={styles.loginWrap}>
      <form action={action} className={styles.loginCard}>
        <p className={styles.mark}>LYST / admin</p>
        <h1 className={styles.h1}>Sign in</h1>
        <label className={styles.label}>
          Password
          <input name="password" type="password" required autoFocus className={styles.input} />
        </label>
        {state?.error && (
          <p role="alert" className={styles.error}>
            {state.error}
          </p>
        )}
        <button className={styles.btn} disabled={pending}>
          {pending ? "Checking…" : "Enter"}
        </button>
      </form>
    </main>
  );
}
