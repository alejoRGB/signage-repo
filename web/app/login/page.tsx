import LoginPageClient from "./login-page-client";

type LoginPageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
    const resolvedSearchParams = searchParams ? await searchParams : {};
    const registered = resolvedSearchParams.registered;
    const isRegisteredSuccess = Array.isArray(registered)
        ? registered.includes("true")
        : registered === "true";

    return <LoginPageClient isRegisteredSuccess={isRegisteredSuccess} />;
}
