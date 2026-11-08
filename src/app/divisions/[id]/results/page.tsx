import { PublicFinalResults } from "@/components/division-finalization";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <PublicFinalResults id={(await params).id} />;
}
