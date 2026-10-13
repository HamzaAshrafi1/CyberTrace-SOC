import { cookies } from "next/headers";

export async function auth() {
  const cookieStore = await cookies();
  const mockRole = cookieStore.get("playwright_role")?.value || "Admin";
  const mockOrgId = cookieStore.get("playwright_org_id")?.value || "org_playwright_test";
  
  return {
    userId: `user_${mockRole.toLowerCase()}`,
    orgId: mockOrgId,
    orgRole: mockRole === "Admin" ? "org:admin" : (mockRole === "Analyst" ? "org:member" : "org:viewer"),
    orgSlug: mockOrgId,
    orgName: "Playwright Testing Org",
    protect: () => {},
  };
}

export async function currentUser() {
  const cookieStore = await cookies();
  const mockRole = cookieStore.get("playwright_role")?.value || "Admin";
  return {
    id: `user_${mockRole.toLowerCase()}`,
    firstName: "Playwright",
    lastName: mockRole,
    emailAddresses: [{ emailAddress: `${mockRole.toLowerCase()}@playwright-test.com` }],
  };
}

export async function clerkClient() {
  return {
    organizations: {
      getOrganization: async ({ organizationId }: { organizationId: string }) => {
        return {
          id: organizationId,
          name: "Playwright Testing Org",
          slug: "playwright-test-org",
        };
      },
      createOrganizationInvitation: async () => {
        return { id: "mock_inv_id" };
      },
      getOrganizationInvitationList: async () => {
        return [];
      },
      revokeOrganizationInvitation: async () => {
        return { success: true };
      },
      updateOrganizationMembership: async () => {
        return { success: true };
      },
      deleteOrganizationMembership: async () => {
        return { success: true };
      },
    }
  };
}

export function clerkMiddleware(handler: any) {
  return async (req: any, event: any) => {
    const mockAuthObj = async () => {
      const cookieStore = await cookies();
      const mockRole = cookieStore.get("playwright_role")?.value || "Admin";
      const mockOrgId = cookieStore.get("playwright_org_id")?.value || "org_playwright_test";
      return {
        userId: `user_${mockRole.toLowerCase()}`,
        orgId: mockOrgId,
        orgRole: mockRole === "Admin" ? "org:admin" : (mockRole === "Analyst" ? "org:member" : "org:viewer"),
        orgSlug: mockOrgId,
      };
    };
    return handler(mockAuthObj, req, event);
  };
}

export function createRouteMatcher() {
  return () => false;
}
