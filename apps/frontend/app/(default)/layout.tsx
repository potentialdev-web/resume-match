import Link from "next/link";
import { FileText, LayoutDashboard, Settings } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";

export default function DefaultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Top nav */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 flex h-14 items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-semibold text-white">
            <FileText className="w-5 h-5 text-indigo-400" />
            <span>ResumeGen</span>
          </Link>

          <div className="flex items-center gap-1 ml-4">
            <Link
              href="/generate"
              className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              Generate
            </Link>
            <Link
              href="/dashboard"
              className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/settings"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4" />
              Settings
            </Link>
            <LogoutButton />
          </div>
        </div>
      </nav>

      <main className="flex-1">{children}</main>
    </div>
  );
}
