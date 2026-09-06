/** Only same-origin paths, so `?next=` can't be used to bounce off the app. */
export function safeNext(next: string | undefined, fallback = "/lobby") {
  return next?.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
