/**
 * Rules come out of the sheet as plain lines. Headings and bullets are inferred
 * from shape rather than parsed as markdown — the tab is written by people who
 * are not writing markdown.
 */
export function Rules({ rules }: { rules: string[] }) {
  if (rules.length === 0) {
    return (
      <p className="panel px-4 py-6 text-center text-sm text-parchment-faint">
        No rules text found in the rules tab.
      </p>
    );
  }

  return (
    <div className="panel px-4 py-4">
      <div className="space-y-2.5">
        {rules.map((line, index) => {
          const numbered = /^(\d+[.)]|rule\s+\d+)/i.test(line);
          const bulleted = /^[-•*]\s+/.test(line);
          // A short line that is neither numbered nor bulleted reads as a heading.
          const heading = !numbered && !bulleted && line.length < 48;

          if (heading) {
            return (
              <h3
                key={index}
                className={`font-display text-base font-semibold text-gold ${index === 0 ? "" : "pt-3"}`}
              >
                {line}
              </h3>
            );
          }

          return (
            <p
              key={index}
              className={`text-sm leading-relaxed text-parchment-dim ${bulleted || numbered ? "pl-1" : ""}`}
            >
              {bulleted ? line.replace(/^[-•*]\s+/, "· ") : line}
            </p>
          );
        })}
      </div>
    </div>
  );
}
