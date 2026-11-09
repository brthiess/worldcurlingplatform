import { ScoresView } from "@/components/scores-view";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ event?: string | string[] }>;
}) {
  const requested = (await searchParams).event;
  const eventId = requested === "main-triple-2026" ? requested : "prairie-2026";
  return <ScoresView key={eventId} eventId={eventId} home />;
}
