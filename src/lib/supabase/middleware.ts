import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "./config";

const publicAuthPaths = ["/login", "/atualizar-senha", "/auth", "/api/oauth", "/api/internal"];

function isPublicAuthPath(pathname: string) {
  return publicAuthPaths.some(path => pathname === path || pathname.startsWith(path + "/"));
}

function safeNext(pathname: string, search: string) {
  return pathname + search;
}

export async function updateSession(request: NextRequest) {
  if (!supabaseConfig.url || !supabaseConfig.publicKey) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseConfig.url,
    supabaseConfig.publicKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { data, error } = await supabase.auth.getUser();
  const user = error ? null : data.user;
  const pathname = request.nextUrl.pathname;

  if (!user && !isPublicAuthPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", safeNext(pathname, request.nextUrl.search));
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === "/login") {
    const next = request.nextUrl.searchParams.get("next");
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = next && next.startsWith("/") && !next.startsWith("//")
      ? next.split("?")[0]
      : "/publicacoes/nova";
    redirectUrl.search = next?.includes("?") ? "?" + next.split("?").slice(1).join("?") : "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
