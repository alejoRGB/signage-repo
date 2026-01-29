import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white p-6 text-center">
      <div className="max-w-xl space-y-6">
        <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 sm:text-6xl">
          Cloud Signage
        </h1>
        <p className="text-lg text-gray-600">
          Manage your digital displays remotely with ease. Upload content, organize playlists, and sync securely.
        </p>
        <div className="mt-8 flex items-center justify-center gap-x-6">
          <Link
            href="/login"
            className="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Get Started
          </Link>
        </div>
      </div>
    </div>
  );
}
