export function Card({ className = "", children, ...rest }) {
  return (
    <section
      className={`overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${className}`.trim()}
      {...rest}
    >
      {children}
    </section>
  );
}

function CardHeader({ className = "", children }) {
  return (
    <header
      className={`flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 ${className}`.trim()}
    >
      {children}
    </header>
  );
}

function CardToolbar({ className = "", children }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-3 py-2 ${className}`.trim()}
    >
      {children}
    </div>
  );
}

function CardBody({ className = "", padded = true, children }) {
  return <div className={`${padded ? "p-4" : ""} ${className}`.trim()}>{children}</div>;
}

Card.Header = CardHeader;
Card.Toolbar = CardToolbar;
Card.Body = CardBody;
