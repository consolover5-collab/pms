import Link from "next/link";
import { BackButton } from "@/components/back-button";

const configSections = [
  {
    title: "Room Types",
    href: "/configuration/room-types",
    description: "Manage room categories, occupancy limits, and base rates",
    icon: "bed",
  },
  {
    title: "Rate Plans",
    href: "/configuration/rate-plans",
    description: "Configure rate codes and pricing strategies",
    icon: "currency",
  },
  {
    title: "Property Settings",
    href: "/configuration/property",
    description: "Hotel details, check-in/out times, currency",
    icon: "building",
  },
  {
    title: "Transaction Codes",
    href: "/configuration/transaction-codes",
    description: "View charge and payment codes for folio postings",
    icon: "receipt",
  },
];

export default function ConfigurationPage() {
  return (
    <main className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Configuration</h1>
      <p className="text-gray-600 mb-8">
        Manage system settings and reference data
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        {configSections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="block p-6 bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow"
          >
            <h2 className="text-xl font-semibold mb-2">{section.title}</h2>
            <p className="text-gray-600 text-sm">{section.description}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <BackButton fallbackHref="/" label="Back to Home" />
      </div>
    </main>
  );
}
