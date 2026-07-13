import { useCallback, useEffect, useState, type CSSProperties } from 'react';

type HealthResponse = {
  status: string;
  info?: Record<string, { status: string }>;
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ok'; data: HealthResponse }
  | { kind: 'error'; message: string };

const API_URL = 'http://localhost:3000';

async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_URL}/health`);
  if (!res.ok) throw new Error(`Health check failed (${res.status})`);
  return res.json();
}

export default function App() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const data = await fetchHealth();
      setState({ kind: 'ok', data });
    } catch (e) {
      setState({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Unknown error',
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main style={styles.page}>
      <h1 style={styles.title}>Family Media</h1>
      <p style={styles.subtitle}>Private family network — browser preview</p>

      <section style={styles.card}>
        <p style={styles.label}>API connection</p>
        <code style={styles.code}>{API_URL}</code>

        {state.kind === 'loading' && <p>Checking…</p>}

        {state.kind === 'ok' && (
          <div>
            <p style={styles.ok}>OK — {state.data.status}</p>
            <p>Database: {state.data.info?.database?.status ?? 'unknown'}</p>
            <p>Redis: {state.data.info?.redis?.status ?? 'unknown'}</p>
          </div>
        )}

        {state.kind === 'error' && (
          <div>
            <p style={styles.error}>Offline</p>
            <p>{state.message}</p>
            <p style={styles.hint}>Run: npm run api:fast</p>
          </div>
        )}

        <button style={styles.button} onClick={() => void load()}>
          Retry
        </button>
      </section>

      <nav style={styles.tabs}>
        <span style={styles.tabActive}>🏠 Home</span>
        <span style={styles.tab}>🌳 Tree</span>
        <span style={styles.tab}>💬 Chat</span>
        <span style={styles.tab}>👤 Profile</span>
      </nav>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { maxWidth: 480, margin: '0 auto', padding: '48px 24px 24px' },
  title: { fontSize: 28, fontWeight: 700, margin: 0 },
  subtitle: { color: '#666', marginTop: 4 },
  card: {
    marginTop: 32,
    padding: 20,
    borderRadius: 16,
    background: '#fff',
    border: '1px solid #eee',
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  code: { display: 'block', margin: '8px 0 16px', fontSize: 13 },
  ok: { color: '#15803d', fontWeight: 700, fontSize: 18 },
  error: { color: '#b91c1c', fontWeight: 700, fontSize: 18 },
  hint: { color: '#888', fontSize: 13 },
  button: {
    marginTop: 16,
    padding: '10px 16px',
    borderRadius: 8,
    border: 'none',
    background: '#111',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  },
  tabs: {
    display: 'flex',
    justifyContent: 'space-around',
    marginTop: 48,
    padding: '12px 0',
    borderTop: '1px solid #eee',
    color: '#888',
  },
  tabActive: { color: '#111', fontWeight: 600 },
  tab: {},
};
