import "./ErrorNotice.css";

export default function ErrorNotice({ error }) {
  if (!error) return null;
  return (
    <div role="alert" className="lf-error">
      {error}
    </div>
  );
}
