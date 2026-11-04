import { describe, expect, it } from "vitest";
import { createStaffSchema } from "./staff-account-schema";

const good = {
  fullName: "Tendai Moyo",
  email: "Tendai@Example.com",
  phone: "0771234567",
  role: "finance",
};

describe("createStaffSchema", () => {
  it("accepts finance and admin", () => {
    expect(createStaffSchema.parse(good).email).toBe("tendai@example.com");
    expect(createStaffSchema.parse({ ...good, role: "admin" }).role).toBe(
      "admin",
    );
  });
  it("normalises the phone number", () => {
    expect(createStaffSchema.parse(good).phone).toBe("+263771234567");
  });
  it("refuses super_admin and anything else", () => {
    expect(createStaffSchema.safeParse({ ...good, role: "super_admin" }).success).toBe(false);
    expect(createStaffSchema.safeParse({ ...good, role: "member" }).success).toBe(false);
  });
  it("refuses a bad email or phone", () => {
    expect(createStaffSchema.safeParse({ ...good, email: "nope" }).success).toBe(false);
    expect(createStaffSchema.safeParse({ ...good, phone: "12" }).success).toBe(false);
  });
});
