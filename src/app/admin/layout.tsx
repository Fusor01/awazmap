import { Logo } from "@/components/logo";
import { AdminNav } from "@/components/admin/admin-nav";

export const metadata = { title: "Admin — AwaazMap" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[14rem_1fr]">
      <aside className="border-b bg-card p-3 md:min-h-screen md:border-b-0 md:border-r md:p-4">
        <div className="mb-3 md:mb-6"><Logo href="/admin" /></div>
        <AdminNav />
      </aside>
      <main className="flex flex-col gap-5 p-4 md:p-8">{children}</main>
    </div>
  );
}
