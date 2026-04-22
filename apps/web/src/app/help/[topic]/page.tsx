import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getDict, t } from "@/lib/i18n";
import { HelpContentDict } from "./help-content";

type Props = {
  params: Promise<{ topic: string }>;
};

export function generateStaticParams() {
  return Object.keys(HelpContentDict).map((topic) => ({ topic }));
}

export default async function HelpTopicPage({ params }: Props) {
  const { topic } = await params;
  const entry = HelpContentDict[topic];
  if (!entry) notFound();

  const locale = await getLocale();
  const dict = getDict(locale);
  const isRu = locale === "ru";
  const title = isRu ? entry.titleRu : entry.titleEn;
  const content = isRu ? entry.contentRu : entry.contentEn;

  return (
    <main className="content" style={{ maxWidth: 860, margin: "0 auto", width: "100%" }}>
      <div className="page-head" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
        <Link href="/help" style={{ color: "var(--accent)", fontSize: 12.5 }}>
          ← {t(dict, "help.back")}
        </Link>
        <h1 data-testid="help-topic-title" className="page-title">{title}</h1>
      </div>
      <div className="card">
        <div data-testid="help-topic-content" className="card-body">{content}</div>
      </div>
    </main>
  );
}
