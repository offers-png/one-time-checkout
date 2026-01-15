import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const createLinkSchema = z.object({
  price: z.number().positive("Price must be greater than 0").max(999999, "Price cannot exceed $999,999"),
});

export type CreateLinkInput = z.infer<typeof createLinkSchema>;

export interface PaymentLink {
  id: number;
  sessionId: string;
  used: boolean;
  expiresAt: number;
  privateUrl: string;
}

export interface CreateLinkResponse {
  private_url: string;
}

export interface ApiError {
  error: string;
}
