import { redirect } from "next/navigation";
import { getOnboarding, listVoices } from "@brandloop/db";
import { getAccount } from "@/lib/account";
import { OnboardingFlow } from "@/components/onboarding/flow";

export default async function OnboardingPage() {
  const account = await getAccount();
  const profile = account.currentProfile;
  if (!profile) redirect("/");
  // Read straight from the database, not the cached account, so a refresh resumes exactly where the last save left off.
  const [state, voices] = await Promise.all([getOnboarding(profile.id), listVoices(profile.id)]);
  return (
    <OnboardingFlow
      initialStep={state.step}
      answers={state.answers}
      completed={state.completed}
      defaults={{ fullName: profile.fullName ?? account.user.name ?? "", timezone: profile.timezone }}
      presets={voices.filter((v) => v.kind === "PRESET").map((v) => ({ id: v.id, name: v.name, tagline: v.tagline }))}
      selectedVoiceId={profile.voiceStyleId}
    />
  );
}
