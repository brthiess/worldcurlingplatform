import "./styles.css";
export const metadata = {
  title: "Scores | World Curling Platform",
  description:
    "Curling scores and event context. Fictional review environment.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <a className="wordmark" href="/">
            World Curling <span>Platform</span>
          </a>
          <nav aria-label="Main navigation">
            <a href="/">Scores</a>
            <a href="/events">Events</a>
            <a href="/rankings">Rankings</a>
            <a href="/players">Players</a>
            <a href="/teams">Teams</a>
            <a href="/news">News</a>
            <a href="/search">Search &amp; favorites</a>
            <a href="/account">Your account</a>
            <a href="/admin">Sign in / workspace</a>
          </nav>
        </header>
        {children}
        <footer>
          World Curling Platform · Independent initial-offer demonstration
        </footer>
      </body>
    </html>
  );
}
