import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DashboardNav } from "../app/components/DashboardShell";
import { validateLeaveApplication } from "../app/employee/apply/page";
import { LoginForm, validateLogin } from "../app/login/page";
import type { User } from "../app/lib/types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("../app/context/AuthContext", () => ({
  useAuth: () => ({
    loginUser: vi.fn(),
    notify: vi.fn(),
  }),
}));

describe("login form", () => {
  it("renders email, password, and submit controls", () => {
    const html = renderToStaticMarkup(<LoginForm />);
    expect(html).toContain("Email");
    expect(html).toContain("Password");
    expect(html).toContain("Sign in");
  });

  it("validates login input", () => {
    expect(validateLogin("bad-email", "Demo@123")).toBe("Enter a valid email address");
    expect(validateLogin("admin@example.com", "")).toBe("Password is required");
    expect(validateLogin("admin@example.com", "Demo@123")).toBe("");
  });
});

describe("leave application validation", () => {
  it("rejects missing type and invalid date range", () => {
    expect(
      validateLeaveApplication({
        leaveTypeId: "",
        startDate: "2026-07-20",
        endDate: "2026-07-21",
        reason: "Family event",
      }),
    ).toBe("Select a leave type");

    expect(
      validateLeaveApplication({
        leaveTypeId: "annual",
        startDate: "2026-07-22",
        endDate: "2026-07-20",
        reason: "Family event",
      }),
    ).toBe("End date must be on or after start date");
  });
});

describe("role-based navigation", () => {
  it("does not show admin navigation to employees", () => {
    const user: User = {
      id: "employee-1",
      name: "Employee User",
      email: "employee@example.com",
      role: "EMPLOYEE",
    };

    const html = renderToStaticMarkup(<DashboardNav user={user} />);
    expect(html).toContain("Apply Leave");
    expect(html).not.toContain("Users");
    expect(html).not.toContain("Reports");
  });
});
