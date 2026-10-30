export function Toast({ message, error }: { message: string; error?: boolean }) {
  return (
    <div className={`toast ${error ? 'error' : ''}`} role="status">
      <span className="toast-dot" />
      {message}
    </div>
  )
}
