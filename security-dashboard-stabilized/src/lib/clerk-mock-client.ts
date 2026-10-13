export function ClerkProvider({ children }: { children: any }) {
  return children;
}

export function useAuth() {
  let mockOrgId = "org_playwright_test";
  let mockRole = "Admin";
  if (typeof window !== "undefined") {
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
    };
    mockOrgId = getCookie("playwright_org_id") || "org_playwright_test";
    mockRole = getCookie("playwright_role") || "Admin";
  }
  return {
    isLoaded: true,
    isSignedIn: true,
    userId: `user_${mockRole.toLowerCase()}`,
    orgId: mockOrgId,
    orgRole: mockRole === "Admin" ? "org:admin" : (mockRole === "Analyst" ? "org:member" : "org:viewer"),
    orgSlug: mockOrgId,
    signOut: () => {},
  };
}

export function useUser() {
  let mockRole = "Admin";
  if (typeof window !== "undefined") {
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
    };
    mockRole = getCookie("playwright_role") || "Admin";
  }
  return {
    isLoaded: true,
    isSignedIn: true,
    user: {
      id: `user_${mockRole.toLowerCase()}`,
      firstName: "Playwright",
      lastName: mockRole,
      primaryEmailAddress: { emailAddress: `${mockRole.toLowerCase()}@playwright-test.com` },
    }
  };
}

export function UserButton() {
  return null;
}

export function OrganizationSwitcher() {
  return null;
}

export function OrganizationList() {
  return null;
}

export function SignIn() {
  return null;
}

export function SignUp() {
  return null;
}
