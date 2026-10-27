export default function Status({ state }) {
  if (state.loading) return <p className="muted">Loading…</p>;
  if (state.error) return <p className="error">{state.error.message}</p>;
  return null;
}
