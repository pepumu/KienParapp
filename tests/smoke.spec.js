// Smoke tests for the PartyMatch (KienParapp) static front end.
//
// app.js imports the real Firebase SDK from https://www.gstatic.com at
// module load time. These tests intercept those requests and serve
// tests/fixtures/firebase-stub.js instead (see that file), so the suite
// never depends on live network access or real Firebase credentials -
// it only exercises the app's own static UI and routing logic, which is
// identical no matter which Firebase project js/firebase-config.js
// points at. They also intentionally stop short of submitting the
// create/join forms, since that's the point where the app would start
// talking to a real Firestore project.

const path = require("path");
const { test, expect } = require("@playwright/test");

const FIREBASE_SDK_GLOB = "https://www.gstatic.com/firebasejs/**/*";
const STUB_PATH = path.join(__dirname, "fixtures", "firebase-stub.js");

test.beforeEach(async ({ page }) => {
  await page.route(FIREBASE_SDK_GLOB, (route) =>
    route.fulfill({ path: STUB_PATH, contentType: "application/javascript" })
  );
});

test.describe("home view", () => {
  test("loads with title and both entry points", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    await page.goto("/");

    await expect(page).toHaveTitle(/PartyMatch/);
    await expect(page.locator("h1")).toHaveText("PartyMatch");
    await expect(page.locator("#btn-go-create")).toBeVisible();
    await expect(page.locator("#btn-go-join")).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});

test.describe("navigation", () => {
  test("Host a party opens the create-party form", async ({ page }) => {
    await page.goto("/");
    await page.locator("#btn-go-create").click();

    await expect(page.locator("#view-create")).toBeVisible();
    await expect(page.locator("#view-home")).toBeHidden();
    await expect(page.locator("#create-name")).toBeVisible();

    // The consent acknowledgement checkbox is required before a host
    // can create a party at all - it should never be optional.
    await expect(page.locator("#create-consent-ack")).toHaveAttribute("required", "");
  });

  test("I have a party code opens the join form", async ({ page }) => {
    await page.goto("/");
    await page.locator("#btn-go-join").click();

    await expect(page.locator("#view-join")).toBeVisible();
    await expect(page.locator("#join-code")).toBeVisible();
  });

  test("back button returns to home from create", async ({ page }) => {
    await page.goto("/#create");
    await expect(page.locator("#view-create")).toBeVisible();

    await page.locator("#view-create .back-btn").click();

    await expect(page.locator("#view-home")).toBeVisible();
    await expect(page.locator("#view-create")).toBeHidden();
  });

  test("back button returns to home from join", async ({ page }) => {
    await page.goto("/#join");
    await expect(page.locator("#view-join")).toBeVisible();

    await page.locator("#view-join .back-btn").click();

    await expect(page.locator("#view-home")).toBeVisible();
    await expect(page.locator("#view-join")).toBeHidden();
  });
});

test.describe("create-party form", () => {
  test("requires a party name and the consent checkbox", async ({ page }) => {
    await page.goto("/#create");

    const nameInput = page.locator("#create-name");
    const consentCheckbox = page.locator("#create-consent-ack");

    await expect(nameInput).toHaveAttribute("required", "");
    await expect(consentCheckbox).toHaveAttribute("required", "");

    await expect(page.locator("#create-bring-friends")).not.toBeChecked();
  });
});

test.describe("default activities", () => {
  test("app module defines Kiss as an ordinary, removable activity", async ({ page }) => {
    // Not reachable through the UI without a live party, so this is
    // asserted directly against the served source instead of the DOM -
    // guards against someone accidentally hard-coding Kiss as special.
    const response = await page.request.get("/js/app.js");
    const src = await response.text();
    expect(src).toContain('{ name: "Kiss"');
  });
});
