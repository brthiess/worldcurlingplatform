import { PlayerView } from "@/components/player-view";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <PlayerView id={(await params).id} />;
}
