import { coreServices, serviceCatalog as fallbackCatalog, ServiceCatalogItem } from "@/lib/services";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";

type ServiceCatalogRow = {
  id: string;
  name?: string | null;
  category?: string | null;
  base_minutes?: number | null;
  price_cents?: number | null;
  description?: string | null;
};

export const revalidate = 60; // refresh catalog data hourly if cached

const formatPrice = (cents: number) => `$${(cents / 100).toFixed(0)}`;

const formatDuration = (minutes: number) => {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs && mins) return `${hrs}h ${mins}m`;
  if (hrs) return `${hrs}h`;
  return `${mins}m`;
};

async function loadServiceCatalog(): Promise<ServiceCatalogItem[]> {
  const admin = createServiceRoleClient();
  const client = admin ?? (await createClient());
  if (!client) return fallbackCatalog;

  const { data, error } = await client
    .from("service_catalog")
    .select("id, name, category, base_minutes, price_cents, description")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("Error loading service catalog:", error.message);
    return fallbackCatalog;
  }

  const rows = (data ?? []) as ServiceCatalogRow[];
  const mapped = rows.map<ServiceCatalogItem>((row) => ({
    id: row.id,
    name: row.name ?? row.id,
    category: row.category ?? "Uncategorized",
    baseMinutes: row.base_minutes ?? 60,
    priceCents: row.price_cents ?? 0,
    description: row.description ?? undefined,
  }));

  return mapped.length ? mapped : fallbackCatalog;
}

export default async function ServicesPage() {
  const catalog = await loadServiceCatalog();

  const grouped = catalog.reduce<Record<string, ServiceCatalogItem[]>>((acc, item) => {
    acc[item.category] = acc[item.category] ? [...acc[item.category], item] : [item];
    return acc;
  }, {});

  const featured = catalog.slice(0, 6);

  return (
    <div className="grid gap-8">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Handyman menu</p>
        <h1 className="text-3xl font-semibold text-slate-900">Services we handle</h1>
        <p className="text-sm text-slate-600">Book online, pick your time, and pay securely by card.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2">
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Most requested</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {featured.length
              ? featured.map((service) => (
                  <div key={service.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">{service.name}</h2>
                        {service.description && <p className="mt-2 text-sm text-slate-600">{service.description}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">{formatPrice(service.priceCents)}</p>
                        <p className="text-xs text-slate-500">{formatDuration(service.baseMinutes)}</p>
                      </div>
                    </div>
                  </div>
                ))
              : coreServices.map((service) => (
                  <div key={service.name} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">{service.name}</h2>
                        <p className="mt-2 text-sm text-slate-600">{service.description}</p>
                      </div>
                      <div className="text-right">
                        {service.price && <p className="text-sm font-semibold text-slate-900">{service.price}</p>}
                        <p className="text-xs text-slate-500">{service.duration}</p>
                      </div>
                    </div>
                  </div>
                ))}
          </div>
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 text-sm text-indigo-900">
          Need something not listed? Add it in the request notes and we will confirm if it fits our scope (non-licensed handyman tasks).
          <div className="mt-3 rounded-lg border border-indigo-200 bg-white/70 px-3 py-2 text-indigo-800">
            Pricing shown is typical; exact quote may vary if the site conditions are unique.
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">{category}</h3>
              <p className="text-xs text-slate-500">{items.length} tasks</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 p-4 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                      {item.description && <p className="mt-1 text-xs text-slate-600">{item.description}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">{formatPrice(item.priceCents)}</p>
                      <p className="text-xs text-slate-500">{formatDuration(item.baseMinutes)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
