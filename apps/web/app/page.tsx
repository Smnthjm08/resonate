import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <ol>
          <li>
            <code>apps/web</code>
          </li>
          <li>
            <code>apps/server</code>
          </li>
          <li>
            <code>packages/chess</code>(game core engine)
          </li>
        </ol>
      </main>
    </div>
  );
}
