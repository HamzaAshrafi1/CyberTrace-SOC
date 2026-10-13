import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clear existing data (in reverse dependency order to avoid foreign key failures)
  console.log("Cleaning database...");
  await prisma.complianceCheck.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.threatEvent.deleteMany();
  await prisma.logSource.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  console.log("Seeding demo organization and user...");
  // Create Demo Organization
  const org = await prisma.organization.create({
    data: {
      clerkOrgId: "org_2df9s8d7f8d7f",
      name: "Alpha Security Corp",
    },
  });

  // Create Demo User
  await prisma.user.create({
    data: {
      clerkUserId: "user_1as2d3f4g5h6j",
      email: "analyst@alphasec.com",
      organizationId: org.id,
    },
  });

  console.log("Seeding log sources...");
  // Create Log Sources
  await prisma.logSource.createMany({
    data: [
      { organizationId: org.id, name: "k8s-ingress-node", apiKey: "ls_key_k8s_ingress_001" },
      { organizationId: org.id, name: "customer-portal-api", apiKey: "ls_key_cust_portal_002" },
      { organizationId: org.id, name: "postgres-main-db", apiKey: "ls_key_pg_main_003" },
    ],
  });

  console.log("Seeding threat events...");
  // Create Threat Events
  await prisma.threatEvent.createMany({
    data: [
      {
        organizationId: org.id,
        sourceIp: "185.220.101.12",
        target: "k8s-ingress-node",
        severity: "critical",
        description: "DDoS Attempt",
        rawPayload: "TCP SYN flood, rate 15k/sec, sig: SYNC_FLOOD",
      },
      {
        organizationId: org.id,
        sourceIp: "185.220.101.4",
        target: "customer-portal-api",
        severity: "critical",
        description: "SQL Injection",
        rawPayload: "POST /v1/login HTTP/1.1; username=admin' OR '1'='1",
      },
      {
        organizationId: org.id,
        sourceIp: "192.168.1.104",
        target: "postgres-main-db",
        severity: "high",
        description: "SSH Brute Force",
        rawPayload: "pam_unix(ssh:auth): authentication failure; logname= uid=0 euid=0 ruser= rhost=192.168.1.104 user=root",
      },
    ],
  });

  console.log("Seeding incidents...");
  // Create Incidents
  await prisma.incident.createMany({
    data: [
      {
        organizationId: org.id,
        title: "Intrusion Alert (Severity 9.8)",
        status: "open",
        assignedTo: "Unassigned",
      },
      {
        organizationId: org.id,
        title: "DDoS Mitigation Activated",
        status: "investigating",
        assignedTo: "analyst@alphasec.com",
      },
    ],
  });

  console.log("Seeding compliance checks...");
  // Create Compliance Checks
  await prisma.complianceCheck.createMany({
    data: [
      {
        organizationId: org.id,
        framework: "SOC2 Type II",
        score: 100,
        status: "compliant",
      },
      {
        organizationId: org.id,
        framework: "ISO 27001",
        score: 94,
        status: "warning",
      },
      {
        organizationId: org.id,
        framework: "GDPR",
        score: 80,
        status: "failed",
      },
    ],
  });

  console.log("Seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
