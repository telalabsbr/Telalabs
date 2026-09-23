"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { connections as demoConnections, workspace as demoWorkspace } from "@/data/mock";
import { socialPlatforms, type ConnectionStatus, type SocialPlatform } from "@/domain/social";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type TenantSource = "loading" | "demo" | "supabase" | "needs_setup";

export interface TenantBrand {
  id: string;
  name: string;
  initials: string;
  organizationId?: string;
  timezone?: string;
}

export interface TenantConnection {
  id: string;
  platform: SocialPlatform;
  status: ConnectionStatus;
  handle?: string;
  displayName?: string;
  brandId?: string | null;
  sourceStatus?: string;
}

export interface TenantCommerceConnection {
  id: string;
  provider: string;
  status: string;
  displayName: string;
  brandId?: string | null;
}

interface TenantState {
  source: TenantSource;
  loading: boolean;
  user: User | null;
  organization: { id: string; name: string; planCode?: string } | null;
  brands: TenantBrand[];
  activeBrand: TenantBrand;
  connections: TenantConnection[];
  commerceConnections: TenantCommerceConnection[];
  error: string | null;
  refresh: () => Promise<void>;
  bootstrapAccount: (brandName: string) => Promise<{ error?: string }>;
}

const demoBrand: TenantBrand = {
  id: demoWorkspace.id,
  name: demoWorkspace.name,
  initials: demoWorkspace.initials,
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("") || "TS";
}

function normalizePlatform(value: string): SocialPlatform | null {
  return (socialPlatforms as readonly string[]).includes(value) ? value as SocialPlatform : null;
}

function normalizeStatus(value: string): ConnectionStatus {
  if (value === "CONNECTED") return "connected";
  if (value === "EXPIRING" || value === "REAUTH_REQUIRED") return "expired";
  if (value === "ERROR") return "error";
  return "disconnected";
}

const TenantContext = createContext<TenantState | null>(null);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [source, setSource] = useState<TenantSource>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<TenantState["organization"]>(null);
  const [brands, setBrands] = useState<TenantBrand[]>([]);
  const [connections, setConnections] = useState<TenantConnection[]>([]);
  const [commerceConnections, setCommerceConnections] = useState<TenantCommerceConnection[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    const client = createSupabaseBrowserClient();

    if (!client) {
      setSource("demo");
      setUser(null);
      setOrganization(null);
      setBrands([demoBrand]);
      setConnections(demoConnections.map((connection, index) => ({
        id: "demo-" + connection.platform + "-" + index,
        ...connection,
      })));
      setCommerceConnections([]);
      return;
    }

    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError) setError(authError.message);

    const currentUser = authData.user;
    setUser(currentUser);

    if (!currentUser) {
      setSource("loading");
      setOrganization(null);
      setBrands([]);
      setConnections([]);
      setCommerceConnections([]);
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        const next = window.location.pathname + window.location.search;
        window.location.replace("/login?next=" + encodeURIComponent(next));
      }
      return;
    }

    const membershipResult = await client
      .from("memberships")
      .select("organization_id,role,status")
      .eq("status", "ACTIVE")
      .limit(1)
      .maybeSingle();

    if (membershipResult.error) {
      setError(membershipResult.error.message);
      setSource("needs_setup");
      setOrganization(null);
      setBrands([]);
      setConnections([]);
      setCommerceConnections([]);
      return;
    }

    const membership = membershipResult.data;
    if (!membership) {
      setSource("needs_setup");
      setOrganization(null);
      setBrands([]);
      setConnections([]);
      setCommerceConnections([]);
      return;
    }

    const organizationId = membership.organization_id;
    const [organizationResult, brandsResult, socialResult, commerceResult] = await Promise.all([
      client.from("organizations").select("id,name,plan_code").eq("id", organizationId).maybeSingle(),
      client.from("brands").select("id,name,organization_id,status,timezone").eq("organization_id", organizationId).eq("status", "ACTIVE").order("created_at"),
      client.from("social_connections").select("id,provider,connection_status,display_name,username,brand_id").eq("organization_id", organizationId).order("created_at"),
      client.from("commerce_connections").select("id,provider,connection_status,display_name,brand_id").eq("organization_id", organizationId).order("created_at"),
    ]);

    const firstError = organizationResult.error ?? brandsResult.error ?? socialResult.error ?? commerceResult.error;
    if (firstError) setError(firstError.message);

    const org = organizationResult.data;
    setOrganization(org ? { id: org.id, name: org.name, planCode: org.plan_code } : null);

    const mappedBrands = (brandsResult.data ?? []).map(brand => ({
      id: brand.id,
      name: brand.name,
      initials: initials(brand.name),
      organizationId: brand.organization_id,
      timezone: brand.timezone,
    }));
    setBrands(mappedBrands);

    const mappedConnections = (socialResult.data ?? []).flatMap(connection => {
      const platform = normalizePlatform(connection.provider);
      if (!platform) return [];
      return [{
        id: connection.id,
        platform,
        status: normalizeStatus(connection.connection_status),
        handle: connection.username ? (connection.username.startsWith("@") ? connection.username : "@" + connection.username) : connection.display_name,
        displayName: connection.display_name,
        brandId: connection.brand_id,
        sourceStatus: connection.connection_status,
      }];
    });
    setConnections(mappedConnections);

    setCommerceConnections((commerceResult.data ?? []).map(connection => ({
      id: connection.id,
      provider: connection.provider,
      status: connection.connection_status,
      displayName: connection.display_name,
      brandId: connection.brand_id,
    })));

    setSource("supabase");
  }

  useEffect(() => {
    let active = true;
    void load();

    const client = createSupabaseBrowserClient();
    const subscription = client?.auth.onAuthStateChange(() => {
      if (active) void load();
    });

    return () => {
      active = false;
      subscription?.data.subscription.unsubscribe();
    };
  }, []);

  async function bootstrapAccount(brandName: string) {
    const client = createSupabaseBrowserClient();
    if (!client) return { error: "Supabase não configurado." };
    const cleanName = brandName.trim() || "Minha marca";
    const result = await client.rpc("bootstrap_account", { p_brand_name: cleanName });
    if (result.error) return { error: result.error.message };
    await load();
    return {};
  }

  const activeBrand = brands[0] ?? (source === "demo" ? demoBrand : {
    id: "unconfigured",
    name: organization?.name ?? "Minha marca",
    initials: initials(organization?.name ?? "Minha marca"),
  });

  const value = useMemo<TenantState>(() => ({
    source,
    loading: source === "loading",
    user,
    organization,
    brands,
    activeBrand,
    connections,
    commerceConnections,
    error,
    refresh: load,
    bootstrapAccount,
  }), [source, user, organization, brands, activeBrand, connections, commerceConnections, error]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenantData() {
  const value = useContext(TenantContext);
  if (!value) throw new Error("useTenantData deve ser usado dentro de TenantProvider");
  return value;
}
