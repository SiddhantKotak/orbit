import { HomeChat } from "@/components/chat/home-chat";
import { HomeCards } from "@/components/home/home-cards";
import { getAccount } from "@/lib/account";
import { greetingFor } from "@/lib/greeting";
import { promptParam } from "@/lib/prompt-param";
import { latestChatOf, summarizeStrategy } from "@/lib/home-summary";
import { ownTemplateBySlug } from "@/lib/templates-api";
import { getSelectedVoice, getLatestChat, getStrategy, listVoices } from "@brandloop/db";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = await searchParams;
  const initialText = promptParam(params.prompt);
  const account = await getAccount();
  const profile = account.currentProfile;
  const timeZone = profile?.timezone ?? "UTC";
  const now = new Date();
  const slug = params.template;
  const template = profile && typeof slug === "string" ? await ownTemplateBySlug(profile.id, slug) : null;
  const [voices, selected, strategy, latest] = profile
    ? await Promise.all([listVoices(profile.id), getSelectedVoice(profile.id), getStrategy(profile.id), getLatestChat(profile.id)])
    : [[], null, null, null];
  return (
    <HomeChat
      greeting={greetingFor(now, timeZone)}
      cards={<HomeCards strategy={summarizeStrategy(strategy, now, timeZone)} latestChat={latestChatOf(latest ? [latest] : [])} now={now} />}
      voices={voices.map((v) => ({ id: v.id, name: v.name, tagline: v.tagline, own: v.kind === "OWN" }))}
      selectedVoiceId={selected?.id ?? null}
      initialText={initialText}
      pinnedTemplate={template && template.type === "POST" ? { slug: template.slug, title: template.title } : null}
    />
  );
}
