import { PageBody, PageHeader } from "@/components/page";
import { TemplatesLibrary } from "@/components/templates/templates-library";

export const metadata = { title: "Templates" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Templates"
        subtitle="Post structures and opening lines that work. Save the ones you like, or use one to start a draft in your voice."
      />
      <PageBody>
        <TemplatesLibrary />
      </PageBody>
    </>
  );
}
