import CinematicStage from "@/components/CinematicStage";

interface HomeProps {
  searchParams: Promise<{ portals?: string }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  return <CinematicStage skipToPortals={params.portals === "true"} />;
}
