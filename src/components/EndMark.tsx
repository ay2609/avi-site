import { END_MARK_PATH, END_MARK_VIEW } from "@/lib/icon/end-mark";

/**
 * The end mark, cut from the watch's own copper (scripts/end-mark.py). Put it
 * anywhere: it takes the colour of the text around it and sits on its line, at
 * 0.72em unless given a `size` (a number is px, or any CSS length). Spacing
 * belongs to the place it's used, through `className`. It's decoration, hidden
 * from screen readers, unless given a `label`.
 */
export default function EndMark({
  size = "0.72em",
  className,
  label,
}: {
  size?: number | string;
  className?: string;
  label?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${END_MARK_VIEW} ${END_MARK_VIEW}`}
      width={size}
      height={size}
      fill="currentColor"
      fillRule="evenodd"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={className}
      style={{ display: "inline-block", verticalAlign: "-0.06em" }}
    >
      <path d={END_MARK_PATH} />
    </svg>
  );
}
