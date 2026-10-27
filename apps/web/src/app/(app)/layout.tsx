import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getAccount, toShellAccount } from "@/lib/account";
import { onboardingRedirect } from "@/lib/onboarding-gate";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccount();
  // First-run setup comes before anything else; the account read is cached under the "account" tag, which the onboarding actions expire.
  const to = onboardingRedirect(account.currentProfile);
  if (to) redirect(to);
  return <AppShell account={toShellAccount(account)}>{children}</AppShell>;
}
