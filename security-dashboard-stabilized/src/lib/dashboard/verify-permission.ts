import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { Permission, hasPermission } from "./permissions";
import { getOrCreateOrganization } from "./get-or-create-org";

export async function getOrCreateUserAndRole() {
  if (process.env.NODE_ENV === "production" && process.env.PLAYWRIGHT_TEST === "true") throw new Error("Test auth forbidden in production");
  if (process.env.PLAYWRIGHT_TEST === "true") {
    const cookieStore = await cookies();
    const mockRole = cookieStore.get("playwright_role")?.value || "Admin";
    const mockOrgId = cookieStore.get("playwright_org_id")?.value || "org_playwright_test";

    // Ensure mock organization exists
    let dbOrg = await prisma.organization.findUnique({
      where: { clerkOrgId: mockOrgId }
    });
    if (!dbOrg) {
      dbOrg = await prisma.organization.create({
        data: {
          clerkOrgId: mockOrgId,
          name: "Playwright Testing Org",
        }
      });
    }

    // Ensure mock user exists
    let dbUser = await prisma.user.findUnique({
      where: { clerkUserId: `user_${mockRole.toLowerCase()}` }
    });
    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          clerkUserId: `user_${mockRole.toLowerCase()}`,
          email: `${mockRole.toLowerCase()}@playwright-test.com`,
          organizationId: dbOrg.id,
          lastLoginAt: new Date(),
        }
      });
    }

    // Ensure mock user role exists
    let roleRecord = await prisma.organizationRole.findUnique({
      where: {
        organizationId_userId: {
          organizationId: dbOrg.id,
          userId: dbUser.id
        }
      }
    });
    if (!roleRecord || roleRecord.role !== mockRole) {
      if (roleRecord) {
        roleRecord = await prisma.organizationRole.update({
          where: {
            organizationId_userId: {
              organizationId: dbOrg.id,
              userId: dbUser.id
            }
          },
          data: { role: mockRole }
        });
      } else {
        roleRecord = await prisma.organizationRole.create({
          data: {
            organizationId: dbOrg.id,
            userId: dbUser.id,
            role: mockRole,
            status: "Active"
          }
        });
      }
    }

    return {
      user: dbUser,
      role: roleRecord.role,
      status: roleRecord.status,
      org: dbOrg
    };
  }

  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    throw new Error("Unauthorized");
  }

  // Fetch organization name from Clerk Backend SDK
  let orgName: string | undefined = undefined;
  try {
    const client = await clerkClient();
    const clerkOrg = await client.organizations.getOrganization({ organizationId: orgId });
    orgName = clerkOrg.name;
  } catch (e) {
    console.error("Failed to fetch organization from Clerk B2B SDK:", e);
  }

  // Get or create the organization in our database
  const dbOrg = await getOrCreateOrganization(orgId, orgName);

  // Get current user details from Clerk
  const clerkUser = await currentUser();
  if (!clerkUser) {
    throw new Error("User details not found in Clerk");
  }
  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) {
    throw new Error("User has no email address in Clerk");
  }

  const now = new Date();

  // Find user by clerkUserId or email
  let dbUser = await prisma.user.findUnique({
    where: { clerkUserId: userId }
  });

  if (!dbUser) {
    dbUser = await prisma.user.findUnique({
      where: { email }
    });

    if (dbUser) {
      dbUser = await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          clerkUserId: userId,
          organizationId: dbOrg.id,
          lastLoginAt: now,
        }
      });
    } else {
      dbUser = await prisma.user.create({
        data: {
          clerkUserId: userId,
          email,
          organizationId: dbOrg.id,
          lastLoginAt: now,
        }
      });
    }
  } else {
    dbUser = await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        organizationId: dbOrg.id,
        lastLoginAt: now,
      }
    });
  }

  // Resolve the OrganizationRole for the user in this organization
  let roleRecord = await prisma.organizationRole.findUnique({
    where: {
      organizationId_userId: {
        organizationId: dbOrg.id,
        userId: dbUser.id
      }
    }
  });

  if (!roleRecord) {
    // If no role exists, determine the role
    const clerkOrgRole = (await auth()).orgRole;
    let initialRole = "Viewer";
    if (clerkOrgRole === "org:admin" || clerkOrgRole === "admin") {
      initialRole = "Admin";
    } else if (clerkOrgRole === "org:member" || clerkOrgRole === "member") {
      initialRole = "Analyst";
    } else {
      // Check if this is the first user in the organization. If so, make them Admin.
      const rolesCount = await prisma.organizationRole.count({
        where: { organizationId: dbOrg.id }
      });
      if (rolesCount === 0) {
        initialRole = "Admin";
      }
    }

    roleRecord = await prisma.organizationRole.create({
      data: {
        organizationId: dbOrg.id,
        userId: dbUser.id,
        role: initialRole,
        status: "Active"
      }
    });

    // Write audit log for new user registration
    await prisma.auditLog.create({
      data: {
        organizationId: dbOrg.id,
        userId: dbUser.id,
        userEmail: email,
        action: "User Registered",
        metadata: {
          role: initialRole,
          clerkUserId: userId
        }
      }
    });
  } else {
    // Log user login if last login was more than 1 hour ago
    const lastLogin = dbUser.lastLoginAt;
    const timeDiff = lastLogin ? now.getTime() - lastLogin.getTime() : Infinity;
    if (timeDiff > 1000 * 60 * 60) {
      await prisma.auditLog.create({
        data: {
          organizationId: dbOrg.id,
          userId: dbUser.id,
          userEmail: email,
          action: "User Login",
          metadata: {
            role: roleRecord.role,
            lastLoginAt: lastLogin ? lastLogin.toISOString() : null
          }
        }
      });
    }
  }

  return {
    user: dbUser,
    role: roleRecord.role,
    status: roleRecord.status,
    org: dbOrg
  };
}

export async function verifyPermission(requiredPermission: Permission) {
  const context = await getOrCreateUserAndRole();

  if (context.status === "Disabled") {
    throw new Error("Account has been disabled. Please contact your organization administrator.");
  }

  const allowed = hasPermission(context.role, requiredPermission);
  if (!allowed) {
    throw new Error(`Forbidden: Required permission '${requiredPermission}' not granted for role '${context.role}'.`);
  }

  return context;
}
