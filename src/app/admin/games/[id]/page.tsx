import { ScoringEditor } from "@/components/scoring-editor";
export default async function ScoringPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <ScoringEditor gameId={(await params).id} />;
}
