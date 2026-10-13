import { test, expect } from '@playwright/test';

test.describe('Aegis SOC Platform E2E Suite', () => {
  
  test.beforeEach(async ({ context }) => {
    // Set default cookies for test runs to bypass auth and use Playwright default org & role (Admin)
    await context.addCookies([
      { name: 'playwright_role', value: 'Admin', domain: 'localhost', path: '/' },
      { name: 'playwright_org_id', value: 'org_playwright_test', domain: 'localhost', path: '/' }
    ]);
  });

  test('RBAC Enforcement & Switcher Integration', async ({ page, context }) => {
    // 1. Log in as Viewer first using cookies
    await context.addCookies([
      { name: 'playwright_role', value: 'Viewer', domain: 'localhost', path: '/' }
    ]);

    await page.goto('/settings');

    // Make sure we are on Settings page
    await expect(page.locator('h1')).toContainText('Platform Settings');
    
    // Viewer lacks write:settings. Fill log source form and try to register
    await page.fill('input#source-name', 'test-log-source-viewer');
    
    // Set up dialog handler to catch permission failure alert using waitForEvent('dialog')
    const dialogPromise = page.waitForEvent('dialog');
    await page.click('button:has-text("Register")');
    const dialog = await dialogPromise;
    expect(dialog.message()).toContain('Failed to register');
    await dialog.accept();

    // 2. Change role to Admin using the sidebar role switcher
    await expect(page.locator('#playwright-role-switcher')).toBeVisible();
    await page.selectOption('#playwright-role-switcher', 'Admin');
    await page.waitForTimeout(1500); // Wait for React hydration and page reload stability

    // Assert that the page reloaded and the user session role displays Admin
    await expect(page.locator('#playwright-role-switcher')).toHaveValue('Admin');

    // Now try to register log source as Admin (should succeed)
    await page.fill('input#source-name', 'test-log-source-admin');
    await page.click('button:has-text("Register")');
    await page.waitForTimeout(1000);

    // Verify it appeared in the log sources table
    await expect(page.locator('table')).toContainText('test-log-source-admin');
  });

  test('Overview & SOC Globe Canvas Load', async ({ page }) => {
    await page.goto('/overview');
    
    // Check that dashboard header is loaded
    await expect(page.locator('text=SOC Operations Terminal')).toBeVisible();
    
    // Globe Canvas is rendered as part of Threat Globe or Threat Map
    await page.goto('/threat-map');
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('Log Ingestion Workstation', async ({ page }) => {
    await page.goto('/ingestion');

    // Paste sample logs
    const mockLog = '185.220.101.4 - - [25/Jun/2026:17:55:00 +0000] "GET /api/v1/ingest?q=union%20select%20* HTTP/1.1" 400 120\n';
    await page.fill('textarea[placeholder*="Paste log lines"]', mockLog);
    await page.click('button:has-text("Parse Text Ingestion")');

    // Wait for Parsed Preview Queue to update
    await expect(page.locator('text=Parsed Preview Queue')).toContainText('1');
    await expect(page.locator('table')).toContainText('185.220.101.4');

    // Trigger process stream
    await page.click('button:has-text("Process Ingestion Stream")');
    await page.waitForSelector('text=Threat Detection Summary');

    // Verify results panel appeared
    await expect(page.locator('text=Ingested Events')).toBeVisible();
  });

  test('Threat Feed, Filtering, and AI Triage Analysis', async ({ page }) => {
    await page.goto('/threats');

    // Search input
    await page.fill('input[placeholder*="Search IPs"]', '185.220.101.4');
    await page.waitForTimeout(1000); // Debounce / loading

    // Filter severity by clicking "CRITICAL"
    await page.click('button:has-text("CRITICAL")');
    await page.waitForTimeout(1000);

    // Open first triage log dialog if items exist
    const triageButtons = page.locator('button:has-text("Triage Log")');
    if (await triageButtons.count() > 0) {
      await triageButtons.first().click();
      await page.waitForSelector('text=TRIAGE TELEMETRY DETAIL');

      // Verify cURL helper block
      await expect(page.locator('pre')).toContainText('curl -X POST');

      // Click AI summary generation
      const aiBtn = page.locator('button:has-text("Audit Log Analysis")');
      if (await aiBtn.isVisible()) {
        await aiBtn.click();
        // Wait for AI results prose text box to appear
        await page.waitForSelector('.prose');
        await expect(page.locator('.prose')).not.toBeEmpty();
      }

      // Close dialog
      await page.keyboard.press('Escape');
    }
  });

  test('Incidents & Case Workspace Lifecycle', async ({ page }) => {
    // 1. Create Case
    await page.goto('/cases');
    await page.waitForTimeout(1500); // Wait for React hydration and DOM stability

    await page.click('button:has-text("CREATE CASE")');
    await page.fill('input[placeholder="e.g. Host Compromise Cluster 01"]', 'Playwright Automated Case');
    await page.fill('textarea[placeholder*="Provide detailed logs"]', 'E2E Testing of Aegis SOC platform Case escalation flows');
    await page.selectOption('select:has-text("LOW")', 'HIGH');
    await page.fill('input[placeholder*="Analyst Name"]', 'Playwright Tester');
    
    await page.click('button:has-text("CONFIRM CASE")');
    await page.waitForTimeout(1500); // Wait for create mutation

    // Check case list has the new case
    await expect(page.locator('table')).toContainText('Playwright Automated Case');

    // 2. Link Incident
    // Select the new case in table (click row with case name)
    await page.click('text=Playwright Automated Case');
    await page.waitForSelector('text=CASE DETAILS');

    const selectIncident = page.locator('select:has-text("-- Select Incident --")');
    if (await selectIncident.isVisible() && (await selectIncident.locator('option').count()) > 1) {
      await selectIncident.selectOption({ index: 1 });
      await page.click('button:has-text("LINK")');
      await page.waitForTimeout(1000);
      
      // Verify linked list is not empty
      await expect(page.locator('text=Attached Incidents')).toContainText('1');
    }
  });

  test('Evidence Vault Mock Upload', async ({ page }) => {
    await page.goto('/vault');
    await page.waitForTimeout(1500); // Wait for React hydration stability

    // Prepare buffer as a mock file upload
    const mockFileBuffer = Buffer.from('AEGIS SECURITY TELEMETRY EXPLOIT PROOF LOGS');
    await page.setInputFiles('input[type="file"]', {
      name: 'playwright_exploit_proof.log',
      mimeType: 'text/plain',
      buffer: mockFileBuffer,
    });

    // Check file state loaded client-side
    await expect(page.locator('form')).toContainText('playwright_exploit_proof.log');

    // Upload
    await page.click('button:has-text("UPLOAD EVIDENCE")');
    await page.waitForSelector('text=uploaded and isolated in tenant space successfully');

    // Verify it appeared in Isolated Vault Documents table
    await expect(page.locator('table')).toContainText('playwright_exploit_proof.log');
  });

  test('Threat Hunting Workstation AQL Query', async ({ page }) => {
    await page.goto('/hunt');
    await page.waitForTimeout(1500); // Wait for React hydration stability

    // Type query
    await page.fill('input[placeholder*="severity:CRITICAL"]', 'severity:CRITICAL');
    await page.click('button:has-text("Run Search")');

    // Wait for results
    await expect(page.locator('text=Search Results')).toBeVisible();
  });

  test('Compliance Posture Audit & Reports Center', async ({ page }) => {
    // 1. Run compliance checklist audit
    await page.goto('/compliance');
    await page.waitForTimeout(1500);

    await page.click('button:has-text("Run Compliance Audit")');
    await page.waitForSelector('text=Compliance audit scan execution completed');

    // 2. Generate a Security PDF Report
    await page.goto('/reports');
    await page.waitForTimeout(1500);

    await page.selectOption('form select', 'compliance');
    await page.fill('input[placeholder*="Defaults to standard CISO"]', 'Playwright Compliance Audit CISO Document');
    await page.click('button:has-text("Generate Audit Report")');

    // Wait for preview to update
    await page.waitForSelector('text=Playwright Compliance Audit CISO Document');
    await expect(page.locator('#report-preview-sheet')).toContainText('Playwright Compliance Audit CISO Document');
  });

  test('AI Copilot RAG Streaming Chat & Documents', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(1500); // Wait for React hydration stability

    // Verify chatbot session title
    await expect(page.locator('text=SESSION_LOGS')).toBeVisible();

    // Create a new empty session to guarantee the suggestions grid is visible and active
    await page.click('#new-session-btn');
    await page.waitForTimeout(1500); // Wait for session creation mutation

    // Trigger one suggestion button
    await page.click('button:has-text("Explain recent SQL")');

    // Wait for bot response to complete
    await page.waitForSelector('text=RAG_DIAGNOSTICS_TAPE');
    await expect(page.locator('.prose').last()).not.toBeEmpty();
  });

});
